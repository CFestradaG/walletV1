import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/utils/formatters.dart';

class AnalyticsView extends ConsumerStatefulWidget {
  const AnalyticsView({super.key});
  @override
  ConsumerState<AnalyticsView> createState() => _AnalyticsViewState();
}

class _AnalyticsViewState extends ConsumerState<AnalyticsView> {
  int year = DateTime.now().year;
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(signedInUserProvider);
    if (user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final txAsync = ref.watch(transactionsProvider(user.id));
    final categoriesAsync = ref.watch(categoriesProvider(user.id));
    final settings = ref.watch(settingsProvider(user.id)).valueOrNull;
    return Scaffold(appBar: AppBar(title: const Text('Análisis')), body: txAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('No se pudieron cargar los movimientos: $e')),
      data: (allTransactions) => categoriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('No se pudieron cargar las categorías: $e')),
        data: (categories) {
          final txs = allTransactions.where((tx) => tx.date.startsWith('$year-')).toList();
          final income = txs.where((tx) => tx.type == TransactionType.income).fold<double>(0, (sum, tx) => sum + tx.amount);
          final expense = txs.where((tx) => tx.type == TransactionType.expense).fold<double>(0, (sum, tx) => sum + tx.amount);
          final hide = settings?.hideBalances ?? false;
          final monthly = List.generate(12, (i) {
            final prefix = '$year-${(i + 1).toString().padLeft(2, '0')}';
            final ins = txs.where((tx) => tx.date.startsWith(prefix) && tx.type == TransactionType.income).fold<double>(0, (s, tx) => s + tx.amount);
            final outs = txs.where((tx) => tx.date.startsWith(prefix) && tx.type == TransactionType.expense).fold<double>(0, (s, tx) => s + tx.amount);
            return (income: ins, expense: outs);
          });
          final maxValue = monthly.fold<double>(1, (m, row) => [m, row.income, row.expense].reduce((a, b) => a > b ? a : b));
          final categoryTotals = <String, double>{};
          for (final tx in txs.where((t) => t.type == TransactionType.expense)) {
            final id = tx.categoryId ?? 'uncategorized';
            categoryTotals[id] = (categoryTotals[id] ?? 0) + tx.amount;
          }
          final ranked = categoryTotals.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [IconButton(onPressed: () => setState(() => year--), icon: const Icon(Icons.chevron_left)), Expanded(child: Center(child: Text('$year', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)))), IconButton(onPressed: () => setState(() => year++), icon: const Icon(Icons.chevron_right))]),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [Expanded(child: _Total(label: 'Ingresos', value: formatGTQ(income, hide: hide), color: Colors.green)), Expanded(child: _Total(label: 'Egresos', value: formatGTQ(expense, hide: hide), color: Theme.of(context).colorScheme.error)), Expanded(child: _Total(label: 'Neto', value: formatGTQ(income - expense, hide: hide), color: Theme.of(context).colorScheme.primary))]))),
            const SizedBox(height: 8),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Ingresos y egresos por mes', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              for (var i = 0; i < monthly.length; i++) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
                SizedBox(width: 36, child: Text(_months[i].substring(0, 3))),
                Expanded(child: Column(children: [
                  _Bar(value: monthly[i].income, max: maxValue, color: Colors.green),
                  const SizedBox(height: 3), _Bar(value: monthly[i].expense, max: maxValue, color: Theme.of(context).colorScheme.error),
                ])),
                const SizedBox(width: 8), SizedBox(width: 70, child: Text(formatGTQ(monthly[i].expense, hide: hide), textAlign: TextAlign.end, style: Theme.of(context).textTheme.labelSmall)),
              ])),
              const SizedBox(height: 10), const Row(children: [Icon(Icons.circle, size: 10, color: Colors.green), SizedBox(width: 4), Text('Ingresos', style: TextStyle(fontSize: 11)), SizedBox(width: 12), Icon(Icons.circle, size: 10, color: Colors.red), SizedBox(width: 4), Text('Egresos', style: TextStyle(fontSize: 11))]),
            ]))),
            const SizedBox(height: 8),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Mayores categorías de gasto', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              if (ranked.isEmpty) const Padding(padding: EdgeInsets.only(top: 12), child: Text('Aún no hay egresos este año.')),
              for (final entry in ranked.take(8)) ...[
                const SizedBox(height: 12),
                Row(children: [Expanded(child: Text(categories.where((c) => c.id == entry.key).firstOrNull?.name ?? 'Sin categoría')), Text(formatGTQ(entry.value, hide: hide), style: const TextStyle(fontWeight: FontWeight.bold))]),
                const SizedBox(height: 4), LinearProgressIndicator(value: expense <= 0 ? 0 : (entry.value / expense).clamp(0, 1).toDouble()),
              ],
            ]))),
            const SizedBox(height: 8),
            Text('Las transferencias se excluyen de los totales de ingresos y egresos.', style: Theme.of(context).textTheme.bodySmall),
          ]);
        },
      ),
    ));
  }
}

class _Total extends StatelessWidget { const _Total({required this.label, required this.value, required this.color}); final String label, value; final Color color; @override Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: Theme.of(context).textTheme.labelSmall), const SizedBox(height: 3), Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12))]); }
class _Bar extends StatelessWidget { const _Bar({required this.value, required this.max, required this.color}); final double value, max; final Color color; @override Widget build(BuildContext context) => Align(alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: (value / max).clamp(0, 1).toDouble(), child: Container(height: 7, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6))))); }
const _months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
extension _FirstOrNull<T> on Iterable<T> { T? get firstOrNull => isEmpty ? null : first; }
