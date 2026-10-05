import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/engines/financial_engine.dart';
import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';
import '../../core/utils/formatters.dart';

class DashboardView extends ConsumerWidget {
  const DashboardView({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(signedInUserProvider);
    if (user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final accountsAsync = ref.watch(accountsProvider(user.id));
    final periodsAsync = ref.watch(periodsProvider(user.id));
    final txAsync = ref.watch(transactionsProvider(user.id));
    final budgetsAsync = ref.watch(budgetsProvider(user.id));
    final categoriesAsync = ref.watch(categoriesProvider(user.id));
    final settingsAsync = ref.watch(settingsProvider(user.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet'), actions: [IconButton(onPressed: () => context.push('/periods'), tooltip: 'Períodos', icon: const Icon(Icons.calendar_month))]),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
        Text('Hola, ${user.name}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 14),
        periodsAsync.when(
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => _ErrorCard('No se pudieron leer los períodos: $e'),
          data: (periods) => settingsAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => _ErrorCard('No se pudieron leer los ajustes: $e'),
            data: (settings) {
              final selected = periods.where((p) => p.id == settings.activePeriodId).firstOrNull ?? periods.where((p) => p.isActive).firstOrNull ?? periods.firstOrNull;
              return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Período financiero', style: Theme.of(context).textTheme.labelLarge),
                if (periods.isEmpty) const Padding(padding: EdgeInsets.only(top: 8), child: Text('Crea tu primer período desde Más → Períodos financieros.'))
                else DropdownButton<String>(
                  value: selected?.id,
                  isExpanded: true,
                  items: [for (final p in periods) DropdownMenuItem(value: p.id, child: Text('${p.name} · ${p.startDate} a ${p.endDate}'))],
                  onChanged: (id) async { if (id != null && selected != null) await ref.read(walletRepositoryProvider).selectActivePeriod(user.id, periods, id, settings); },
                ),
              ])));
            },
          ),
        ),
        const SizedBox(height: 8),
        accountsAsync.when(
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => _ErrorCard('No se pudieron leer las cuentas: $e'),
          data: (accounts) {
            final totals = calculatePortfolioTotals(accounts);
            final hidden = settingsAsync.valueOrNull?.hideBalances ?? false;
            return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Disponible', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 4),
              Text(formatGTQ(totals.available, hide: hidden), style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 14),
              Row(children: [Expanded(child: _Metric(label: 'Deuda', value: formatGTQ(totals.debt, hide: hidden))), Expanded(child: _Metric(label: 'Neto', value: formatGTQ(totals.net, hide: hidden)))]),
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: () => context.go('/accounts'), icon: const Icon(Icons.account_balance_wallet_outlined), label: Text('${accounts.where((a) => !a.isArchived).length} cuentas activas')),
            ])));
          },
        ),
        const SizedBox(height: 8),
        periodsAsync.valueOrNull?.where((p) => p.id == (settingsAsync.valueOrNull?.activePeriodId ?? '')).firstOrNull != null
            ? _PeriodSummaryCard(period: periodsAsync.valueOrNull!.where((p) => p.id == settingsAsync.valueOrNull?.activePeriodId).firstOrNull,
                txAsync: txAsync, budgetAsync: budgetsAsync, categoriesAsync: categoriesAsync, hidden: settingsAsync.valueOrNull?.hideBalances ?? false)
            : const SizedBox.shrink(),
        const SizedBox(height: 8),
        Card(child: Column(children: [
          ListTile(title: const Text('Acciones rápidas'), subtitle: const Text('Registra movimientos y revisa tus metas')),
          Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
            _QuickAction(icon: Icons.add, label: 'Transacción', onTap: () => context.go('/transactions')),
            _QuickAction(icon: Icons.table_chart, label: 'Panorama', onTap: () => context.push('/budget')),
            _QuickAction(icon: Icons.insights_outlined, label: 'Análisis', onTap: () => context.go('/analytics')),
          ]),
          const SizedBox(height: 12),
        ])),
        const SizedBox(height: 8),
        txAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (allTxs) {
            final recent = [...allTxs]..sort((a, b) => b.date.compareTo(a.date));
            final top5 = recent.take(5).toList();
            if (top5.isEmpty) return const SizedBox.shrink();
            final categories = categoriesAsync.valueOrNull ?? const <Category>[];
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Movimientos recientes',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.bold)),
                        TextButton(
                            onPressed: () => context.go('/transactions'),
                            child: const Text('Ver todas')),
                      ],
                    ),
                    const Divider(height: 10),
                    for (final tx in top5)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          radius: 16,
                          child: Text(
                            categories
                                    .where((c) => c.id == tx.categoryId)
                                    .firstOrNull
                                    ?.icon ??
                                (tx.type == TransactionType.transfer
                                    ? '🔄'
                                    : tx.type == TransactionType.income
                                        ? '💵'
                                        : '💸'),
                            style: const TextStyle(fontSize: 14),
                          ),
                        ),
                        title: Text(
                            tx.note.isEmpty
                                ? (tx.type == TransactionType.expense
                                    ? 'Gasto'
                                    : tx.type == TransactionType.income
                                        ? 'Ingreso'
                                        : 'Transferencia')
                                : tx.note,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        subtitle:
                            Text(tx.date, style: const TextStyle(fontSize: 11)),
                        trailing: Text(
                          '${tx.type == TransactionType.income ? '+' : tx.type == TransactionType.expense ? '−' : ''}${formatGTQ(tx.amount, hide: settingsAsync.valueOrNull?.hideBalances ?? false)}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: tx.type == TransactionType.income
                                ? Colors.green
                                : (tx.type == TransactionType.expense
                                    ? Theme.of(context).colorScheme.error
                                    : null),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ]),
    );
  }
}

class _PeriodSummaryCard extends StatelessWidget {
  const _PeriodSummaryCard({required this.period, required this.txAsync, required this.budgetAsync, required this.categoriesAsync, required this.hidden});
  final FinancialPeriod? period; final AsyncValue<List<WalletTransaction>> txAsync; final AsyncValue<List<Budget>> budgetAsync; final AsyncValue<List<Category>> categoriesAsync; final bool hidden;
  @override Widget build(BuildContext context) {
    final p = period;
    if (p == null) return const SizedBox.shrink();
    final txs = txAsync.valueOrNull ?? const <WalletTransaction>[];
    final summary = summarizeTransactions(txs, period: p);
    final budgets = budgetAsync.valueOrNull ?? const <Budget>[];
    final spent = txs.where((t) => t.type == TransactionType.expense && t.date.compareTo(p.startDate) >= 0 && t.date.compareTo(p.endDate) <= 0).fold<double>(0, (s, t) => s + t.amount);
    final limit = budgets.where((b) => b.categoryId.isNotEmpty).fold<double>(0, (s, b) => s + b.targetAmount);
    final categories = categoriesAsync.valueOrNull ?? const <Category>[];
    final over = <String>{};
    final warn80 = <String>{};
    for (final b in budgets) {
      final cat = categories.where((c) => c.id == b.categoryId).firstOrNull;
      final categorySpent = txs.where((t) => t.type == TransactionType.expense && t.categoryId == b.categoryId && t.date.compareTo(p.startDate) >= 0 && t.date.compareTo(p.endDate) <= 0).fold<double>(0, (s, t) => s + t.amount);
      if (b.alertThreshold100 && categorySpent > b.targetAmount) {
        over.add(cat?.name ?? 'Una categoría');
      } else if (b.alertThreshold80 && categorySpent >= b.targetAmount * 0.8) {
        warn80.add(cat?.name ?? 'Una categoría');
      }
    }
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Resumen del período', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      Row(children: [Expanded(child: _Metric(label: 'Ingresos', value: formatGTQ(summary.income, hide: hidden))), Expanded(child: _Metric(label: 'Egresos', value: formatGTQ(summary.expense, hide: hidden)))]),
      const Divider(height: 20),
      Row(children: [Expanded(child: Text('Resultado neto', style: Theme.of(context).textTheme.labelLarge)), Text(formatGTQ(summary.net, hide: hidden), style: const TextStyle(fontWeight: FontWeight.bold))]),
      const SizedBox(height: 6),
      Text('${summary.count} movimientos · Transferencias ${formatGTQ(summary.transfers, hide: hidden)}', style: Theme.of(context).textTheme.bodySmall),
      if (limit > 0) ...[
        const SizedBox(height: 12), Text('Egresos / metas del período', style: Theme.of(context).textTheme.labelMedium),
        LinearProgressIndicator(value: (spent / limit).clamp(0, 1).toDouble(), color: spent > limit ? Theme.of(context).colorScheme.error : null),
        Text('${formatGTQ(spent, hide: hidden)} de ${formatGTQ(limit, hide: hidden)}', style: Theme.of(context).textTheme.bodySmall),
      ],
      for (final name in over) ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: const Icon(Icons.error_outline, color: Colors.red), title: Text('$name superó su presupuesto (100%)')),
      for (final name in warn80) ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: const Icon(Icons.warning_amber, color: Colors.orange), title: Text('$name superó el 80% de su presupuesto')),
    ])));
  }
}

class _Metric extends StatelessWidget { const _Metric({required this.label, required this.value}); final String label, value; @override Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: Theme.of(context).textTheme.labelMedium), const SizedBox(height: 3), Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600))]); }
class _QuickAction extends StatelessWidget { const _QuickAction({required this.icon, required this.label, required this.onTap}); final IconData icon; final String label; final VoidCallback onTap; @override Widget build(BuildContext context) => ActionChip(avatar: Icon(icon, size: 18), label: Text(label), onPressed: onTap); }
class _ErrorCard extends StatelessWidget { const _ErrorCard(this.text); final String text; @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(text))); }
extension _FirstOrNull<T> on Iterable<T> { T? get firstOrNull => isEmpty ? null : first; }
