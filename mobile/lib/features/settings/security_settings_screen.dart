import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/security/lock_controller.dart';
import '../lock/pin_prompt.dart';

const _timeouts = <int, String>{
  0: 'Inmediatamente',
  30: '30 segundos',
  60: '1 minuto',
  300: '5 minutos',
};

class SecuritySettingsScreen extends ConsumerWidget {
  const SecuritySettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lock = ref.watch(lockControllerProvider);
    final cfg = lock.config;
    final ctrl = ref.read(lockControllerProvider.notifier);
    final bio = ref.watch(biometricAvailabilityProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Seguridad')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Bloquear la app'),
            subtitle: const Text('Pide PIN (o biometría) al abrir y al volver a la app'),
            value: cfg.enabled,
            onChanged: (v) async {
              if (v) {
                context.push('/security/pin');
              } else if (await confirmCurrentPin(context, ref)) {
                await ctrl.disable();
              }
            },
          ),
          if (cfg.enabled) ...[
            bio.when(
              loading: () => const ListTile(title: Text('Comprobando biometría…')),
              error: (_, __) => const SizedBox.shrink(),
              data: (a) => a.available
                  ? SwitchListTile(
                      title: Text('Usar ${a.label}'),
                      subtitle: const Text('El PIN sigue disponible como respaldo'),
                      value: cfg.biometricEnabled,
                      onChanged: (v) async {
                        final ok = await ctrl.setBiometric(v);
                        if (!ok && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('No se pudo verificar la biometría.')));
                        }
                      },
                    )
                  : const ListTile(
                      leading: Icon(Icons.info_outline),
                      title: Text('Biometría no disponible'),
                      subtitle: Text(
                          'Este dispositivo no tiene huella ni rostro configurados. Se usará solo el PIN.'),
                    ),
            ),
            ListTile(
              title: const Text('Bloquear tras estar en segundo plano'),
              trailing: DropdownButton<int>(
                value: _timeouts.containsKey(cfg.timeoutSeconds) ? cfg.timeoutSeconds : 30,
                underline: const SizedBox.shrink(),
                items: [
                  for (final e in _timeouts.entries)
                    DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) {
                  if (v != null) ctrl.setTimeout(v);
                },
              ),
            ),
            ListTile(
              leading: const Icon(Icons.password),
              title: const Text('Cambiar PIN'),
              onTap: () async {
                if (await confirmCurrentPin(context, ref) && context.mounted) {
                  context.push('/security/pin');
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.lock_clock),
              title: const Text('Bloquear ahora'),
              onTap: ctrl.lockNow,
            ),
          ],
        ],
      ),
    );
  }
}
