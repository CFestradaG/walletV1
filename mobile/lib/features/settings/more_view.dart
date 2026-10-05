import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/security/lock_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';
import '../auth/auth_repository.dart';

class MoreView extends ConsumerWidget {
  const MoreView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final user = ref.watch(signedInUserProvider);
    final settings = user == null ? null : ref.watch(settingsProvider(user.id)).valueOrNull;
    final selectedMode = _themeMode(settings?.themeMode) ?? mode;
    final lock = ref.watch(lockControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Más')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.shield_outlined),
            title: const Text('Seguridad'),
            subtitle: Text(lock.config.enabled ? 'Bloqueo activado' : 'Bloqueo desactivado'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/security'),
          ),
          const Divider(),
          ListTile(leading: const Icon(Icons.category_outlined), title: const Text('Categorías'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/categories')),
          ListTile(leading: const Icon(Icons.calendar_month), title: const Text('Períodos financieros'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/periods')),
          ListTile(leading: const Icon(Icons.table_chart_outlined), title: const Text('Presupuesto & Panorama Anual'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/budget')),
          const Divider(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode), label: Text('Claro')),
                ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode), label: Text('Oscuro')),
                ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto), label: Text('Sistema')),
              ],
              selected: {selectedMode},
              onSelectionChanged: (s) async {
                final next = s.first;
                ref.read(themeModeProvider.notifier).state = next;
                if (user != null) {
                  final old = settings ?? UserSettings(userId: user.id);
                  try { await ref.read(walletRepositoryProvider).saveSettings(_settingsCopy(old, theme: _themeString(next))); }
                  catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudo sincronizar el tema: $e'))); }
                }
              },
            ),
          ),
          if (user != null)
            SwitchListTile(
              secondary: const Icon(Icons.visibility_off_outlined),
              title: const Text('Ocultar saldos'),
              subtitle: const Text('Protege los montos al usar la app'),
              value: settings?.hideBalances ?? false,
              onChanged: (hide) async {
                final old = settings ?? UserSettings(userId: user.id);
                try { await ref.read(walletRepositoryProvider).saveSettings(_settingsCopy(old, hideBalances: hide)); }
                catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudo sincronizar la preferencia: $e'))); }
              },
            ),
          const Divider(),
          if (user != null)
            ListTile(
              leading: const Icon(Icons.restart_alt, color: Colors.red),
              title: const Text('Restablecer datos financieros'),
              subtitle: const Text('Borra cuentas, movimientos, períodos y presupuestos'),
              onTap: () => _confirmReset(context, ref, user.id, settings ?? UserSettings(userId: user.id)),
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Cerrar sesión'),
            onTap: () async {
              // El PIN es del dispositivo: se borra al cerrar sesión.
              await ref.read(lockControllerProvider.notifier).disable();
              await ref.read(authRepositoryProvider).signOut();
            },
          ),
        ],
      ),
    );
  }
}

Future<void> _confirmReset(BuildContext context, WidgetRef ref, String uid, UserSettings settings) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Restablecer cuenta'),
      content: const Text('Se eliminarán tus cuentas, categorías, períodos, movimientos y presupuestos. Se conservarán tu acceso y tus preferencias. Esta acción no se puede deshacer.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Borrar datos'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;
  try {
    final profile = ref.read(signedInUserProvider);
    if (profile == null || profile.id != uid) return;
    await ref.read(walletRepositoryProvider).resetFinancialData(profile, settings);
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Los datos financieros se restablecieron.')));
  } catch (e) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudieron restablecer los datos: $e')));
  }
}

ThemeMode? _themeMode(String? value) => switch (value) {
  'light' => ThemeMode.light, 'dark' => ThemeMode.dark, 'system' => ThemeMode.system, _ => null,
};
String _themeString(ThemeMode mode) => switch (mode) { ThemeMode.light => 'light', ThemeMode.dark => 'dark', ThemeMode.system => 'system' };
UserSettings _settingsCopy(UserSettings old, {String? theme, bool? hideBalances}) => UserSettings(
  userId: old.userId, currency: old.currency, currencySymbolPosition: old.currencySymbolPosition,
  decimalPlaces: old.decimalPlaces, themeMode: theme ?? old.themeMode,
  hideBalances: hideBalances ?? old.hideBalances, activePeriodId: old.activePeriodId,
  annualProjections: old.annualProjections,
);
