import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/engines/period_engine.dart';
import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';

class PeriodsView extends ConsumerWidget {
  const PeriodsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(signedInUserProvider);
    if (user == null)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final periodsAsync = ref.watch(periodsProvider(user.id));
    final settingsAsync = ref.watch(settingsProvider(user.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Períodos financieros')),
      floatingActionButton: periodsAsync.hasValue && settingsAsync.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => _editPeriod(context, ref, user.id,
                  periodsAsync.value!, settingsAsync.value!),
              icon: const Icon(Icons.add),
              label: const Text('Nuevo período'))
          : null,
      body: periodsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) =>
            Center(child: Text('No se pudieron cargar los períodos: $e')),
        data: (periods) => settingsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) =>
              Center(child: Text('No se pudieron cargar las preferencias: $e')),
          data: (settings) {
            final sorted = [...periods]
              ..sort((a, b) => a.startDate.compareTo(b.startDate));
            return ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                children: [
                  if (sorted.isEmpty)
                    const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('No hay períodos configurados.')),
                  for (final period in sorted)
                    Card(
                        child: ListTile(
                      leading: CircleAvatar(
                          child: Icon(period.isActive
                              ? Icons.radio_button_checked
                              : Icons.calendar_month)),
                      title: Text(period.name),
                      subtitle: Text(
                          '${period.startDate} — ${period.endDate}\n${monthName(period.referenceMonth ?? DateTime.parse(period.startDate).month)} · ${_modeName(period.subdivisionMode)} · ${period.subperiods.length} subperíodos'),
                      isThreeLine: true,
                      trailing: PopupMenuButton<String>(
                        onSelected: (value) async {
                          if (value == 'edit') {
                            await _editPeriod(
                                context, ref, user.id, sorted, settings,
                                period: period);
                          } else if (value == 'active') {
                            await _activate(context, ref, user.id, sorted,
                                period, settings);
                          } else if (value == 'delete') {
                            await _delete(context, ref, user.id, sorted, period,
                                settings);
                          }
                        },
                        itemBuilder: (_) => [
                          if (!period.isActive)
                            const PopupMenuItem(
                                value: 'active',
                                child: Text('Usar como activo')),
                          const PopupMenuItem(
                              value: 'edit', child: Text('Editar')),
                          const PopupMenuItem(
                              value: 'delete', child: Text('Eliminar')),
                        ],
                      ),
                    )),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                      onPressed: () => context.push('/budget'),
                      icon: const Icon(Icons.table_chart),
                      label: const Text('Abrir Panorama Anual')),
                ]);
          },
        ),
      ),
    );
  }
}

Future<void> _editPeriod(BuildContext context, WidgetRef ref, String uid,
    List<FinancialPeriod> existing, UserSettings settings,
    {FinancialPeriod? period}) async {
  final name = TextEditingController(text: period?.name ?? '');
  var start = period?.startDate ??
      isoDate(DateTime(DateTime.now().year, DateTime.now().month, 1));
  var end = period?.endDate ??
      isoDate(DateTime(DateTime.now().year, DateTime.now().month + 1, 0));
  var month = period?.referenceMonth ?? DateTime.parse(start).month;
  var mode = period?.subdivisionMode ?? SubdivisionMode.none;
  var activate = period?.isActive ?? existing.isEmpty;
  var error = '';
  final formKey = GlobalKey<FormState>();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => StatefulBuilder(
        builder: (context, setState) => Padding(
              padding: EdgeInsets.fromLTRB(
                  20, 18, 20, MediaQuery.viewInsetsOf(context).bottom + 16),
              child: Form(
                  key: formKey,
                  child: ListView(shrinkWrap: true, children: [
                    Text(period == null ? 'Crear período' : 'Editar período',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 14),
                    TextFormField(
                        controller: name,
                        decoration: const InputDecoration(
                            labelText: 'Nombre del período'),
                        validator: (v) => v == null || v.trim().isEmpty
                            ? 'Ingresa el nombre.'
                            : null),
                    DropdownButtonFormField<int>(
                        initialValue: month,
                        decoration: const InputDecoration(
                            labelText: 'Mes que representa en el Panorama'),
                        items: [
                          for (var m = 1; m <= 12; m++)
                            DropdownMenuItem(
                                value: m, child: Text(monthName(m)))
                        ],
                        onChanged: (v) => setState(() => month = v ?? month)),
                    Row(children: [
                      Expanded(
                          child: _DateField(
                              label: 'Inicio',
                              value: start,
                              onChanged: (v) => setState(() => start = v))),
                      const SizedBox(width: 12),
                      Expanded(
                          child: _DateField(
                              label: 'Fin',
                              value: end,
                              onChanged: (v) => setState(() => end = v))),
                    ]),
                    DropdownButtonFormField<SubdivisionMode>(
                        initialValue: mode,
                        decoration:
                            const InputDecoration(labelText: 'Subdivisión'),
                        items: [
                          for (final m in SubdivisionMode.values)
                            DropdownMenuItem(
                                value: m, child: Text(_modeName(m)))
                        ],
                        onChanged: (v) => setState(() => mode = v ?? mode)),
                    SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Establecer como período activo'),
                        value: activate,
                        onChanged: (v) => setState(() => activate = v)),
                    if (error.isNotEmpty)
                      Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(error,
                              style: TextStyle(
                                  color: Theme.of(context).colorScheme.error))),
                    FilledButton(
                        onPressed: () async {
                          if (!formKey.currentState!.validate()) return;
                          final issue = validatePeriod(
                              name: name.text,
                              start: start,
                              end: end,
                              periods: existing,
                              editingId: period?.id);
                          if (issue != null) {
                            setState(() => error = issue);
                            return;
                          }
                          final now = DateTime.now().toIso8601String();
                          final id = period?.id ??
                              'per_${DateTime.now().microsecondsSinceEpoch}';
                          final newPeriod = FinancialPeriod(
                            id: id,
                            userId: uid,
                            name: name.text.trim(),
                            referenceMonth: month,
                            startDate: start,
                            endDate: end,
                            subdivisionMode: mode,
                            status: activate ? 'active' : 'scheduled',
                            isActive: activate,
                            subperiods:
                                generateSubperiods(id, start, end, mode),
                            createdAt: period?.createdAt ?? now,
                            updatedAt: now,
                          );
                          try {
                            await ref
                                .read(walletRepositoryProvider)
                                .savePeriodAndMaybeActivate(newPeriod,
                                    activate: activate,
                                    existing: existing,
                                    settings: settings);
                            if (context.mounted) Navigator.pop(context);
                          } catch (e) {
                            setState(() =>
                                error = 'No se pudo guardar el período: $e');
                          }
                        },
                        child: const Text('Guardar período')),
                  ])),
            )),
  );
  name.dispose();
}

Future<void> _activate(
    BuildContext context,
    WidgetRef ref,
    String uid,
    List<FinancialPeriod> periods,
    FinancialPeriod period,
    UserSettings settings) async {
  try {
    await ref
        .read(walletRepositoryProvider)
        .selectActivePeriod(uid, periods, period.id, settings);
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo activar el período: $e')));
  }
}

Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    String uid,
    List<FinancialPeriod> periods,
    FinancialPeriod period,
    UserSettings settings) async {
  if (periods.length == 1) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Debe quedar al menos un período financiero.')));
    return;
  }
  final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
            title: const Text('Eliminar período'),
            content: Text(
                '¿Eliminar ${period.name}? Las transacciones no se borran.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancelar')),
              FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Eliminar'))
            ],
          ));
  if (ok != true) return;
  final next = period.isActive
      ? (periods.where((p) => p.id != period.id).firstOrNull)
      : null;
  try {
    await ref
        .read(walletRepositoryProvider)
        .deletePeriodAndSelectNext(uid, period, next, periods, settings);
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No se pudo eliminar: $e')));
  }
}

class _DateField extends StatelessWidget {
  const _DateField(
      {required this.label, required this.value, required this.onChanged});
  final String label, value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(label, style: Theme.of(context).textTheme.labelMedium),
        subtitle: Text(value),
        trailing: const Icon(Icons.calendar_month),
        onTap: () async {
          final date = DateTime.tryParse(value) ?? DateTime.now();
          final picked = await showDatePicker(
              context: context,
              initialDate: date,
              firstDate: DateTime(2000),
              lastDate: DateTime(2100));
          if (picked != null) onChanged(isoDate(picked));
        },
      );
}

String _modeName(SubdivisionMode mode) => switch (mode) {
      SubdivisionMode.none => 'Sin subdivisión',
      SubdivisionMode.weekly => 'Semanal',
      SubdivisionMode.biweekly => 'Quincenal',
      SubdivisionMode.monthly => 'Mensual',
    };

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
