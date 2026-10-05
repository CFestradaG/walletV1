import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/engines/financial_engine.dart';
import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';
import '../../core/utils/formatters.dart';

class AccountsView extends ConsumerWidget {
  const AccountsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(signedInUserProvider);
    if (profile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final data = ref.watch(accountsProvider(profile.id));
    final hide =
        ref.watch(settingsProvider(profile.id)).valueOrNull?.hideBalances ??
            false;
    return Scaffold(
      appBar: AppBar(title: const Text('Cuentas')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openAccountForm(context, ref, profile.id),
        icon: const Icon(Icons.add),
        label: const Text('Nueva cuenta'),
      ),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) =>
            _ErrorBody(message: 'No se pudieron cargar las cuentas: $e'),
        data: (accounts) {
          final active = accounts.where((a) => !a.isArchived).toList();
          final totals = calculatePortfolioTotals(accounts);
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
            children: [
              Card(
                  child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Disponible',
                          style: Theme.of(context).textTheme.labelLarge),
                      const SizedBox(height: 4),
                      Text(formatGTQ(totals.available, hide: hide),
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(
                            child: _MiniMetric(
                                label: 'Deuda',
                                value: formatGTQ(totals.debt, hide: hide))),
                        Expanded(
                            child: _MiniMetric(
                                label: 'Balance neto',
                                value: formatGTQ(totals.net, hide: hide))),
                      ]),
                    ]),
              )),
              const SizedBox(height: 8),
              if (active.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                        child: Text(
                            'Aún no tienes cuentas. Agrega una para empezar.'))),
              for (final account in accounts)
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                        child: Text(account.icon.isEmpty
                            ? _accountEmoji(account.type)
                            : account.icon)),
                    title: Text(account.name),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                            '${_accountTypeName(account.type)}${account.isArchived ? ' · Archivada' : ''}${account.subtitle == null || account.subtitle!.isEmpty ? '' : ' · ${account.subtitle}'}'),
                        if (account.isCreditCard)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.calendar_today,
                                          size: 11, color: Colors.amber),
                                      const SizedBox(width: 3),
                                      Text(
                                        'Corte: día ${account.cutoffDay ?? 15}',
                                        style: const TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.amber),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.lightBlue
                                        .withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.alarm,
                                          size: 11, color: Colors.lightBlue),
                                      const SizedBox(width: 3),
                                      Text(
                                        'Pago: día ${account.paymentDueDay ?? 5}',
                                        style: const TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.lightBlue),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                              formatGTQ(account.currentBalance.abs(),
                                  hide: hide),
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          if (account.isCreditCard)
                            Text(
                                account.currentBalance < 0
                                    ? 'Deuda'
                                    : 'Disponible',
                                style: Theme.of(context).textTheme.labelSmall),
                        ]),
                    onTap: () => _openAccountForm(context, ref, profile.id,
                        account: account),
                    onLongPress: account.isArchived
                        ? null
                        : () => _archiveAccount(context, ref, account),
                  ),
                ),
              if (accounts.any((a) => a.isArchived))
                Padding(
                    padding: const EdgeInsets.all(8),
                    child: Text(
                        'Mantén presionada una cuenta activa para archivarla.',
                        style: Theme.of(context).textTheme.bodySmall)),
            ],
          );
        },
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        Text(value,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w600))
      ]);
}

Future<void> _openAccountForm(BuildContext context, WidgetRef ref, String uid,
    {Account? account}) async {
  final name = TextEditingController(text: account?.name ?? '');
  final subtitle = TextEditingController(text: account?.subtitle ?? '');
  final balance = TextEditingController(
      text: account == null
          ? ''
          : account.initialBalance.abs().toStringAsFixed(2));
  final limit = TextEditingController(
      text: account?.creditLimit?.toStringAsFixed(2) ?? '');
  final cutoff =
      TextEditingController(text: account?.cutoffDay?.toString() ?? '15');
  final paymentDue =
      TextEditingController(text: account?.paymentDueDay?.toString() ?? '5');
  var type = account?.type ?? AccountType.cash;
  final formKey = GlobalKey<FormState>();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => StatefulBuilder(
        builder: (context, setState) => Padding(
              padding: EdgeInsets.fromLTRB(
                  20, 16, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
              child: Form(
                  key: formKey,
                  child: ListView(shrinkWrap: true, children: [
                    Text(account == null ? 'Nueva cuenta' : 'Editar cuenta',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 16),
                    TextFormField(
                        controller: name,
                        decoration: const InputDecoration(labelText: 'Nombre'),
                        validator: (v) => v == null || v.trim().isEmpty
                            ? 'Ingresa un nombre.'
                            : null),
                    TextFormField(
                        controller: subtitle,
                        decoration: const InputDecoration(
                            labelText: 'Descripción (opcional)')),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<AccountType>(
                        initialValue: type,
                        decoration:
                            const InputDecoration(labelText: 'Tipo de cuenta'),
                        items: [
                          for (final t in AccountType.values)
                            DropdownMenuItem(
                                value: t, child: Text(_accountTypeName(t)))
                        ],
                        onChanged: account == null
                            ? (v) => setState(() => type = v ?? type)
                            : null),
                    if (account == null)
                      TextFormField(
                          controller: balance,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration: const InputDecoration(
                              labelText: 'Saldo inicial', prefixText: 'Q '),
                          validator: _amountValidator),
                    if (type == AccountType.credit_card) ...[
                      TextFormField(
                          controller: limit,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration: const InputDecoration(
                              labelText: 'Límite de crédito', prefixText: 'Q '),
                          validator: _amountValidator),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: cutoff,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                  labelText: 'Día de corte', hintText: '15'),
                              validator: (v) {
                                final n = int.tryParse(v ?? '');
                                return n == null || n < 1 || n > 31
                                    ? 'Día entre 1 y 31'
                                    : null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: paymentDue,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                  labelText: 'Día límite de pago',
                                  hintText: '5'),
                              validator: (v) {
                                final n = int.tryParse(v ?? '');
                                return n == null || n < 1 || n > 31
                                    ? 'Día entre 1 y 31'
                                    : null;
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                        onPressed: () async {
                          if (!formKey.currentState!.validate()) return;
                          final now = DateTime.now().toIso8601String();
                          final opening = double.tryParse(
                                  balance.text.replaceAll(',', '')) ??
                              0;
                          final creditLimit =
                              double.tryParse(limit.text.replaceAll(',', ''));
                          final next = Account(
                            id: account?.id ??
                                ref
                                    .read(walletRepositoryProvider)
                                    .newAccountId(uid),
                            userId: uid,
                            name: name.text.trim(),
                            subtitle: subtitle.text.trim().isEmpty
                                ? null
                                : subtitle.text.trim(),
                            type: type,
                            currency: 'GTQ',
                            initialBalance: account?.initialBalance ??
                                (type == AccountType.credit_card
                                    ? -opening
                                    : opening),
                            currentBalance: account?.currentBalance ??
                                (type == AccountType.credit_card
                                    ? -opening
                                    : opening),
                            creditLimit: type == AccountType.credit_card
                                ? creditLimit
                                : null,
                            status: account?.status ?? 'active',
                            icon: account?.icon ?? _accountEmoji(type),
                            color: account?.color ?? '#10B981',
                            cutoffDay: type == AccountType.credit_card
                                ? int.tryParse(cutoff.text)
                                : null,
                            paymentDueDay: type == AccountType.credit_card
                                ? int.tryParse(paymentDue.text)
                                : null,
                            createdAt: account?.createdAt ?? now,
                            updatedAt: now,
                          );
                          try {
                            await ref
                                .read(walletRepositoryProvider)
                                .saveAccount(next);
                            if (context.mounted) Navigator.pop(context);
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text('No se pudo guardar: $e')));
                            }
                          }
                        },
                        child: const Text('Guardar cuenta')),
                  ])),
            )),
  );
  name.dispose();
  subtitle.dispose();
  balance.dispose();
  limit.dispose();
  cutoff.dispose();
  paymentDue.dispose();
}

String? _amountValidator(String? value) {
  final amount = double.tryParse((value ?? '').replaceAll(',', ''));
  return amount == null || amount < 0 ? 'Ingresa un monto válido.' : null;
}

Future<void> _archiveAccount(
    BuildContext context, WidgetRef ref, Account account) async {
  final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
            title: const Text('Archivar cuenta'),
            content: Text(
                '¿Archivar ${account.name}? No se podrá usar en nuevas transacciones.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancelar')),
              FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Archivar'))
            ],
          ));
  if (yes != true) return;
  try {
    await ref.read(walletRepositoryProvider).archiveAccount(account);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No se pudo archivar: $e')));
    }
  }
}

String _accountTypeName(AccountType type) => switch (type) {
      AccountType.cash => 'Efectivo',
      AccountType.bank => 'Cuenta bancaria',
      AccountType.savings => 'Ahorro',
      AccountType.credit_card => 'Tarjeta de crédito',
    };
String _accountEmoji(AccountType type) => switch (type) {
      AccountType.cash => '💵',
      AccountType.bank => '🏦',
      AccountType.savings => '🐖',
      AccountType.credit_card => '💳',
    };

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
      child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(message, textAlign: TextAlign.center)));
}
