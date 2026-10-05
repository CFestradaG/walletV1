import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/engines/financial_engine.dart';
import '../../core/engines/period_engine.dart';
import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';
import '../../core/utils/formatters.dart';

class TransactionsView extends ConsumerStatefulWidget {
  const TransactionsView({super.key});
  @override
  ConsumerState<TransactionsView> createState() => _TransactionsViewState();
}

class _TransactionsViewState extends ConsumerState<TransactionsView> {
  String? _periodFilter;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(signedInUserProvider);
    if (user == null)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final accountsAsync = ref.watch(accountsProvider(user.id));
    final categoriesAsync = ref.watch(categoriesProvider(user.id));
    final periodsAsync = ref.watch(periodsProvider(user.id));
    final txsAsync = ref.watch(transactionsProvider(user.id));
    final settings = ref.watch(settingsProvider(user.id)).valueOrNull;
    return Scaffold(
      appBar: AppBar(title: const Text('Transacciones')),
      floatingActionButton: accountsAsync.hasValue &&
              categoriesAsync.hasValue &&
              periodsAsync.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => _openTransactionForm(context, ref, user.id,
                  accounts: accountsAsync.value!,
                  categories: categoriesAsync.value!,
                  periods: periodsAsync.value!),
              icon: const Icon(Icons.add),
              label: const Text('Nueva transacción'))
          : null,
      body: accountsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Message('No se pudieron cargar las cuentas: $e'),
        data: (accounts) => categoriesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _Message('No se pudieron cargar las categorías: $e'),
          data: (categories) => periodsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _Message('No se pudieron cargar los períodos: $e'),
            data: (periods) => txsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) =>
                  _Message('No se pudieron cargar las transacciones: $e'),
              data: (allTxs) {
                final activePeriods = [...periods]
                  ..sort((a, b) => a.startDate.compareTo(b.startDate));
                final validFilter = _periodFilter == 'all' ||
                    activePeriods.any((p) => p.id == _periodFilter);
                if (!validFilter)
                  _periodFilter = settings?.activePeriodId ?? 'all';
                final filtered = allTxs.where((tx) {
                  if (_periodFilter == null || _periodFilter == 'all')
                    return true;
                  final period = activePeriods
                      .where((p) => p.id == _periodFilter)
                      .firstOrNull;
                  return period != null &&
                      tx.date.compareTo(period.startDate) >= 0 &&
                      tx.date.compareTo(period.endDate) <= 0;
                }).toList()
                  ..sort((a, b) => b.date.compareTo(a.date));
                return ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue:
                            _periodFilter ?? settings?.activePeriodId ?? 'all',
                        decoration: const InputDecoration(
                            labelText: 'Filtrar por período'),
                        items: [
                          const DropdownMenuItem(
                              value: 'all', child: Text('Todos los períodos')),
                          for (final p in activePeriods)
                            DropdownMenuItem(value: p.id, child: Text(p.name))
                        ],
                        onChanged: (v) => setState(() => _periodFilter = v),
                      ),
                      const SizedBox(height: 12),
                      if (filtered.isEmpty)
                        const Padding(
                            padding: EdgeInsets.all(28),
                            child: Center(
                                child: Text(
                                    'No hay transacciones para este período.'))),
                      for (final tx in filtered)
                        Card(
                            child: ListTile(
                          leading:
                              CircleAvatar(child: Icon(_typeIcon(tx.type))),
                          title: Text(
                              tx.note.isEmpty ? _typeName(tx.type) : tx.note,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                          subtitle: Text(
                              '${_dateLabel(tx.date)} · ${_transactionSubtitle(tx, accounts, categories)}'),
                          trailing: Text(
                              '${tx.type == TransactionType.income ? '+' : tx.type == TransactionType.expense ? '−' : ''}${formatGTQ(tx.amount, hide: settings?.hideBalances ?? false)}',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: tx.type == TransactionType.income
                                      ? Colors.green
                                      : null)),
                          onTap: () => _openTransactionForm(
                              context, ref, user.id,
                              accounts: accounts,
                              categories: categories,
                              periods: periods,
                              transaction: tx),
                          onLongPress: () =>
                              _deleteTransaction(context, ref, tx, accounts),
                        )),
                      if (filtered.isNotEmpty)
                        Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(
                                'Toca para editar; mantén presionado para eliminar.',
                                style: Theme.of(context).textTheme.bodySmall)),
                    ]);
              },
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> _openTransactionForm(
  BuildContext context,
  WidgetRef ref,
  String uid, {
  required List<Account> accounts,
  required List<Category> categories,
  required List<FinancialPeriod> periods,
  WalletTransaction? transaction,
}) async {
  final note = TextEditingController(text: transaction?.note ?? '');
  final amount =
      TextEditingController(text: transaction?.amount.toStringAsFixed(2) ?? '');
  var type = transaction?.type ?? TransactionType.expense;
  var accountId = transaction?.accountId;
  var categoryId = transaction?.categoryId;
  var subcategoryId = transaction?.subcategoryId;
  var originId = transaction?.originAccountId ?? transaction?.accountId;
  var destinationId = transaction?.destinationAccountId;
  var date = transaction?.date ?? toIsoDate(DateTime.now());
  final formKey = GlobalKey<FormState>();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => StatefulBuilder(builder: (context, setState) {
      final usableAccounts = accounts.where((a) => !a.isArchived).toList();
      final filteredCategories = categories
          .where((c) =>
              c.isActive &&
              c.type.name ==
                  (type == TransactionType.income ? 'income' : 'expense'))
          .toList();
      if (categoryId != null &&
          !filteredCategories.any((c) => c.id == categoryId)) categoryId = null;
      final selectedCategory =
          filteredCategories.where((c) => c.id == categoryId).firstOrNull;
      return Padding(
        padding: EdgeInsets.fromLTRB(
            20, 16, 20, MediaQuery.viewInsetsOf(context).bottom + 16),
        child: Form(
            key: formKey,
            child: ListView(shrinkWrap: true, children: [
              Text(
                  transaction == null
                      ? 'Nueva transacción'
                      : 'Editar transacción',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              SegmentedButton<TransactionType>(
                segments: const [
                  ButtonSegment(
                      value: TransactionType.expense,
                      label: Text('Gasto'),
                      icon: Icon(Icons.south_west)),
                  ButtonSegment(
                      value: TransactionType.income,
                      label: Text('Ingreso'),
                      icon: Icon(Icons.north_east)),
                  ButtonSegment(
                      value: TransactionType.transfer,
                      label: Text('Transferencia'),
                      icon: Icon(Icons.swap_horiz)),
                ],
                selected: {type},
                onSelectionChanged: (selected) => setState(() {
                  type = selected.first;
                  categoryId = null;
                  subcategoryId = null;
                }),
              ),
              const SizedBox(height: 12),
              TextFormField(
                  controller: amount,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Monto', prefixText: 'Q '),
                  validator: (v) {
                    final n = double.tryParse((v ?? '').replaceAll(',', ''));
                    return n == null || n <= 0
                        ? 'Ingresa un monto mayor que cero.'
                        : null;
                  }),
              if (type == TransactionType.transfer) ...[
                DropdownButtonFormField<String>(
                    initialValue: originId,
                    decoration:
                        const InputDecoration(labelText: 'Cuenta de origen'),
                    items: [
                      for (final a in usableAccounts)
                        DropdownMenuItem(value: a.id, child: Text(a.name))
                    ],
                    onChanged: (v) => setState(() => originId = v)),
                DropdownButtonFormField<String>(
                    initialValue: destinationId,
                    decoration:
                        const InputDecoration(labelText: 'Cuenta de destino'),
                    items: [
                      for (final a in usableAccounts)
                        DropdownMenuItem(value: a.id, child: Text(a.name))
                    ],
                    onChanged: (v) => setState(() => destinationId = v)),
              ] else ...[
                DropdownButtonFormField<String>(
                    initialValue: accountId,
                    decoration: const InputDecoration(labelText: 'Cuenta'),
                    items: [
                      for (final a in usableAccounts)
                        DropdownMenuItem(value: a.id, child: Text(a.name))
                    ],
                    onChanged: (v) => setState(() => accountId = v)),
                DropdownButtonFormField<String>(
                    initialValue: categoryId,
                    decoration: const InputDecoration(labelText: 'Categoría'),
                    items: [
                      for (final c in filteredCategories)
                        DropdownMenuItem(
                            value: c.id, child: Text('${c.icon} ${c.name}'))
                    ],
                    onChanged: (v) => setState(() {
                          categoryId = v;
                          subcategoryId = null;
                        })),
                if (selectedCategory != null &&
                    selectedCategory.subcategories
                        .where((s) => s.isActive)
                        .isNotEmpty)
                  DropdownButtonFormField<String?>(
                      initialValue: subcategoryId,
                      decoration: const InputDecoration(
                          labelText: 'Subcategoría (opcional)'),
                      items: [
                        const DropdownMenuItem(
                            value: null, child: Text('Sin subcategoría')),
                        for (final s in selectedCategory.subcategories
                            .where((s) => s.isActive))
                          DropdownMenuItem(value: s.id, child: Text(s.name))
                      ],
                      onChanged: (v) => setState(() => subcategoryId = v)),
              ],
              TextFormField(
                  controller: note,
                  decoration: const InputDecoration(
                      labelText: 'Descripción (opcional)')),
              ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Fecha'),
                  subtitle: Text(date),
                  trailing: const Icon(Icons.calendar_month),
                  onTap: () async {
                    final parsed = DateTime.tryParse(date) ?? DateTime.now();
                    final picked = await showDatePicker(
                        context: context,
                        initialDate: parsed,
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100));
                    if (picked != null)
                      setState(() => date = toIsoDate(picked));
                  }),
              const SizedBox(height: 12),
              FilledButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    final value =
                        double.tryParse(amount.text.replaceAll(',', '')) ?? 0;
                    final reversed = transaction == null
                        ? accounts
                        : applyTransactionToAccounts(transaction, accounts,
                            reverse: true);
                    final error = validateTransaction(
                      userId: uid,
                      type: type,
                      amount: value,
                      date: date,
                      accounts: reversed,
                      categories: categories,
                      accountId: accountId,
                      categoryId: categoryId,
                      originAccountId: originId,
                      destinationAccountId: destinationId,
                    );
                    if (error != null) {
                      ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text(error)));
                      return;
                    }
                    final resolved = resolvePeriod(date, periods);
                    final now = DateTime.now().toIso8601String();
                    final destination = accounts
                        .where((a) => a.id == destinationId)
                        .firstOrNull;
                    final tx = WalletTransaction(
                      id: transaction?.id ??
                          'tx_${DateTime.now().microsecondsSinceEpoch}',
                      userId: uid,
                      type: type,
                      amount: roundMoney(value),
                      currency: 'GTQ',
                      accountId: type == TransactionType.transfer
                          ? originId
                          : accountId,
                      categoryId:
                          type == TransactionType.transfer ? null : categoryId,
                      subcategoryId: type == TransactionType.transfer
                          ? null
                          : subcategoryId,
                      originAccountId:
                          type == TransactionType.transfer ? originId : null,
                      destinationAccountId: type == TransactionType.transfer
                          ? destinationId
                          : null,
                      isCreditCardPayment: type == TransactionType.transfer &&
                          destination?.isCreditCard == true,
                      date: date,
                      note: note.text.trim(),
                      periodId: resolved.period?.id,
                      subperiodId: resolved.subperiod?.id,
                      createdAt: transaction?.createdAt ?? now,
                      updatedAt: now,
                    );
                    try {
                      await ref.read(walletRepositoryProvider).saveTransaction(
                          transaction: tx);
                      if (context.mounted) Navigator.pop(context);
                    } catch (e) {
                      if (context.mounted)
                        ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('No se pudo guardar: $e')));
                    }
                  },
                  child: const Text('Guardar transacción')),
            ])),
      );
    }),
  );
  note.dispose();
  amount.dispose();
}

Future<void> _deleteTransaction(BuildContext context, WidgetRef ref,
    WalletTransaction tx, List<Account> accounts) async {
  final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
            title: const Text('Eliminar transacción'),
            content: const Text(
                'Se actualizará también el saldo de las cuentas afectadas.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancelar')),
              FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Eliminar'))
            ],
          ));
  if (yes != true) return;
  try {
    await ref
        .read(walletRepositoryProvider)
        .deleteTransaction(transaction: tx);
  } catch (e) {
    if (context.mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No se pudo eliminar: $e')));
  }
}

String _dateLabel(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null
      ? iso
      : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

IconData _typeIcon(TransactionType t) => switch (t) {
      TransactionType.expense => Icons.south_west,
      TransactionType.income => Icons.north_east,
      TransactionType.transfer => Icons.swap_horiz
    };
String _typeName(TransactionType t) => switch (t) {
      TransactionType.expense => 'Gasto',
      TransactionType.income => 'Ingreso',
      TransactionType.transfer => 'Transferencia'
    };
String _transactionSubtitle(
    WalletTransaction tx, List<Account> accounts, List<Category> categories) {
  if (tx.type == TransactionType.transfer) {
    final from = accounts
            .where((a) => a.id == (tx.originAccountId ?? tx.accountId))
            .firstOrNull
            ?.name ??
        'Cuenta';
    final to = accounts
            .where((a) => a.id == tx.destinationAccountId)
            .firstOrNull
            ?.name ??
        'Cuenta';
    return '$from → $to';
  }
  final account =
      accounts.where((a) => a.id == tx.accountId).firstOrNull?.name ?? 'Cuenta';
  final category =
      categories.where((c) => c.id == tx.categoryId).firstOrNull?.name ??
          'Categoría';
  return '$category · $account';
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _Message extends StatelessWidget {
  const _Message(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Center(
      child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(text, textAlign: TextAlign.center)));
}
