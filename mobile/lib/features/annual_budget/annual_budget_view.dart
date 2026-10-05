import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';
import '../../core/utils/formatters.dart';

enum _Horizon { monthly, quarterly, semiannual, annual }

class AnnualBudgetView extends ConsumerStatefulWidget {
  const AnnualBudgetView({super.key});
  @override
  ConsumerState<AnnualBudgetView> createState() => _AnnualBudgetViewState();
}

class _AnnualBudgetViewState extends ConsumerState<AnnualBudgetView> {
  _Horizon _horizon = _Horizon.monthly;
  int _year = DateTime.now().year;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(signedInUserProvider);
    if (user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final categoriesAsync = ref.watch(categoriesProvider(user.id));
    final periodsAsync = ref.watch(periodsProvider(user.id));
    final txAsync = ref.watch(transactionsProvider(user.id));
    final budgetsAsync = ref.watch(budgetsProvider(user.id));
    final settings = ref.watch(settingsProvider(user.id)).valueOrNull;
    return Scaffold(
      appBar: AppBar(title: const Text('Presupuesto & Panorama Anual')),
      body: categoriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Notice('No se pudieron cargar las categorías: $e'),
        data: (categories) => periodsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _Notice('No se pudieron cargar los períodos: $e'),
          data: (periods) => txAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _Notice('No se pudieron cargar las transacciones: $e'),
            data: (transactions) => budgetsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _Notice('No se pudieron cargar los presupuestos: $e'),
              data: (budgets) => _buildContent(context, ref, user.id, categories, periods, transactions, budgets, settings),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, String uid, List<Category> categories,
      List<FinancialPeriod> periods, List<WalletTransaction> transactions, List<Budget> budgets, UserSettings? settings) {
    final activeCategories = categories.where((c) => c.isActive).toList()..sort((a, b) {
      final t = a.type.index.compareTo(b.type.index);
      return t == 0 ? a.name.compareTo(b.name) : t;
    });
    final columns = _columns(_year, _horizon);
    final yearPlanRaw = settings?.annualProjections['$_year'];
    final yearPlan = yearPlanRaw is Map ? Map<String, dynamic>.from(yearPlanRaw) : <String, dynamic>{};
    final totals = columns.map((column) => _calculateTotals(
      column: column, year: _year, categories: activeCategories, periods: periods,
      transactions: transactions, budgets: budgets, yearPlan: yearPlan,
    )).toList();
    return ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 28), children: [
      Row(children: [
        IconButton(onPressed: () => setState(() => _year--), icon: const Icon(Icons.chevron_left)),
        Expanded(child: Center(child: Text('$_year', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)))),
        IconButton(onPressed: () => setState(() => _year++), icon: const Icon(Icons.chevron_right)),
      ]),
      SegmentedButton<_Horizon>(
        segments: const [
          ButtonSegment(value: _Horizon.monthly, label: Text('Mes')),
          ButtonSegment(value: _Horizon.quarterly, label: Text('Trimestre')),
          ButtonSegment(value: _Horizon.semiannual, label: Text('Semestre')),
          ButtonSegment(value: _Horizon.annual, label: Text('Año')),
        ],
        selected: {_horizon}, onSelectionChanged: (s) => setState(() => _horizon = s.first),
      ),
      const SizedBox(height: 8),
      if (_horizon == _Horizon.monthly)
        const Text('Toca un mes para editar la meta del período y la proyección anual base con ajustes mensuales.', style: TextStyle(fontSize: 12)),
      if (periods.isEmpty)
        const Padding(padding: EdgeInsets.all(16), child: Text('Crea un período financiero para enlazar presupuestos con el Panorama.')),
      Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Resumen comparativo', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        for (final total in totals) ...[
          const Divider(height: 14),
          Row(children: [SizedBox(width: 60, child: Text(total.column.title, style: const TextStyle(fontWeight: FontWeight.bold))), Expanded(child: _totalValue('Ingreso', total.incomeProjected, total.incomeActual, settings?.hideBalances ?? false)), Expanded(child: _totalValue('Egreso', total.expenseProjected, total.expenseActual, settings?.hideBalances ?? false))]),
          Padding(padding: const EdgeInsets.only(left: 60, top: 4), child: _totalValue('Neto', total.incomeProjected - total.expenseProjected, total.incomeActual - total.expenseActual, settings?.hideBalances ?? false)),
        ],
      ]))),
      for (final categoryType in [CategoryType.income, CategoryType.expense]) ...[
        Padding(padding: const EdgeInsets.fromLTRB(2, 20, 2, 6), child: Text(categoryType == CategoryType.income ? 'INGRESOS' : 'EGRESOS', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold))),
        for (final category in activeCategories.where((c) => c.type == categoryType))
          _CategoryBudgetCard(
            category: category, columns: columns, year: _year, horizon: _horizon,
            periods: periods, transactions: transactions, budgets: budgets,
            projection: _categoryPlan(yearPlan, category),
            hidden: settings?.hideBalances ?? false,
            onEditMonth: _horizon == _Horizon.monthly ? (monthIndex) => _editBudget(
              context, ref, uid, category, monthIndex, periods, budgets, settings,
            ) : null,
          ),
      ],
      const SizedBox(height: 12),
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Text('Las transferencias no se incluyen en ingresos ni egresos. Un presupuesto de período tiene prioridad sobre la proyección anual base. Los reales se calculan por las fechas del período financiero.', style: Theme.of(context).textTheme.bodySmall))),
    ]);
  }

  Future<void> _editBudget(BuildContext context, WidgetRef ref, String uid, Category category, int monthIndex, List<FinancialPeriod> periods, List<Budget> budgets, UserSettings? settings) async {
    final period = _findPeriod(periods, _year, monthIndex + 1);
    final existing = period == null ? null : budgets.where((b) => b.periodId == period.id && b.categoryId == category.id && b.subcategoryId == null).firstOrNull;
    final categoryPlan = settings == null ? <String, dynamic>{} : _categoryPlan(_planForYear(settings, _year), category);
    final budgetController = TextEditingController(text: existing?.targetAmount.toStringAsFixed(2) ?? '');
    final baseDefault = category.type == CategoryType.income && category.name.toLowerCase().contains('salario') ? 10300.0 : 0.0;
    final baseController = TextEditingController(text: (categoryPlan['monthlyAmount'] as num?)?.toStringAsFixed(2) ?? baseDefault.toStringAsFixed(2));
    final overrides = categoryPlan['monthlyOverrides'] is Map ? Map<String, dynamic>.from(categoryPlan['monthlyOverrides'] as Map) : <String, dynamic>{};
    final overrideController = TextEditingController(text: (overrides['$monthIndex'] as num?)?.toStringAsFixed(2) ?? '');
    final saved = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: Text('${category.name} · ${_month(monthIndex + 1)}'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (period == null) const Text('No hay un período asociado a este mes. Puedes guardar la proyección anual y crear el período después.')
        else Text('Período: ${period.name}', style: Theme.of(ctx).textTheme.bodySmall),
        if (period != null) TextField(controller: budgetController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Meta de este período', prefixText: 'Q ')),
        TextField(controller: baseController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Proyección base mensual', prefixText: 'Q ')),
        TextField(controller: overrideController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: 'Proyección específica de ${_month(monthIndex + 1)} (opcional)', prefixText: 'Q ')),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')), FilledButton(onPressed: () {
        double? parse(TextEditingController c) => c.text.trim().isEmpty ? null : double.tryParse(c.text.replaceAll(',', ''));
        if ((period != null && budgetController.text.trim().isNotEmpty && (parse(budgetController) == null || parse(budgetController)! < 0)) ||
            parse(baseController) == null || parse(baseController)! < 0 ||
            (overrideController.text.trim().isNotEmpty && (parse(overrideController) == null || parse(overrideController)! < 0))) return;
        Navigator.pop(ctx, true);
      }, child: const Text('Guardar'))],
    ));
    if (saved != true) { budgetController.dispose(); baseController.dispose(); overrideController.dispose(); return; }
    try {
      final repo = ref.read(walletRepositoryProvider);
      final value = double.tryParse(budgetController.text.replaceAll(',', ''));
      if (period != null && value != null) {
        if (value == 0) {
          if (existing != null) await repo.deleteBudget(uid, existing.id);
        } else {
        final now = DateTime.now().toIso8601String();
        await repo.saveBudget(Budget(
          id: existing?.id ?? 'bgt_${period.id}_${category.id}', userId: uid,
          periodId: period.id, categoryId: category.id, targetAmount: value,
          currency: 'GTQ', alertThreshold80: existing?.alertThreshold80 ?? true,
          alertThreshold100: existing?.alertThreshold100 ?? true,
          distributeBySubperiod: existing?.distributeBySubperiod ?? false,
          createdAt: existing?.createdAt ?? now, updatedAt: now,
        ));
        }
      }
      if (settings != null) {
        final allPlans = Map<String, dynamic>.from(settings.annualProjections);
        final yearKey = '$_year';
        final yearPlan = _planForYear(settings, _year);
        final nextCategoryPlan = _categoryPlan(yearPlan, category);
        nextCategoryPlan['monthlyAmount'] = double.parse(baseController.text.replaceAll(',', ''));
        final monthOverrides = Map<String, dynamic>.from(nextCategoryPlan['monthlyOverrides'] is Map ? nextCategoryPlan['monthlyOverrides'] as Map : const {});
        if (overrideController.text.trim().isEmpty) { monthOverrides.remove('$monthIndex'); }
        else { monthOverrides['$monthIndex'] = double.parse(overrideController.text.replaceAll(',', '')); }
        nextCategoryPlan['monthlyOverrides'] = monthOverrides;
        yearPlan[category.id] = nextCategoryPlan;
        allPlans[yearKey] = yearPlan;
        await repo.saveSettings(_copySettings(settings, annualProjections: allPlans));
      }
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudo guardar el presupuesto: $e')));
    } finally {
      budgetController.dispose(); baseController.dispose(); overrideController.dispose();
    }
  }
}

class _BudgetColumn { const _BudgetColumn(this.title, this.months); final String title; final List<int> months; }
class _PanoramaTotals { const _PanoramaTotals(this.column, this.incomeProjected, this.incomeActual, this.expenseProjected, this.expenseActual); final _BudgetColumn column; final double incomeProjected, incomeActual, expenseProjected, expenseActual; }

_PanoramaTotals _calculateTotals({required _BudgetColumn column, required int year, required List<Category> categories, required List<FinancialPeriod> periods, required List<WalletTransaction> transactions, required List<Budget> budgets, required Map<String, dynamic> yearPlan}) {
  var incomeProjected = 0.0, incomeActual = 0.0, expenseProjected = 0.0, expenseActual = 0.0;
  for (final category in categories) {
    final config = _categoryPlan(yearPlan, category);
    for (final monthIndex in column.months) {
      final period = _findPeriod(periods, year, monthIndex + 1);
      final direct = period == null ? 0.0 : budgets.where((b) => b.periodId == period.id && b.categoryId == category.id).fold<double>(0, (sum, b) => sum + b.targetAmount);
      final projected = direct > 0 ? direct : _annualProjection(config, monthIndex);
      final prefix = '$year-${(monthIndex + 1).toString().padLeft(2, '0')}';
      final actual = transactions.where((tx) => tx.type.name == category.type.name && tx.categoryId == category.id &&
        (period == null ? tx.date.startsWith(prefix) : tx.date.compareTo(period.startDate) >= 0 && tx.date.compareTo(period.endDate) <= 0)).fold<double>(0, (sum, tx) => sum + tx.amount);
      if (category.type == CategoryType.income) { incomeProjected += projected; incomeActual += actual; }
      else { expenseProjected += projected; expenseActual += actual; }
    }
  }
  return _PanoramaTotals(column, incomeProjected, incomeActual, expenseProjected, expenseActual);
}

Widget _totalValue(String label, double projected, double actual, bool hidden) => Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(label, style: const TextStyle(fontSize: 11)), Text('P ${formatGTQ(projected, hide: hidden)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)), Text('R ${formatGTQ(actual, hide: hidden)}', style: const TextStyle(fontSize: 11))]);

class _CategoryBudgetCard extends StatelessWidget {
  const _CategoryBudgetCard({required this.category, required this.columns, required this.year, required this.horizon, required this.periods, required this.transactions, required this.budgets, required this.hidden, required this.projection, this.onEditMonth});
  final Category category; final List<_BudgetColumn> columns; final int year; final _Horizon horizon;
  final List<FinancialPeriod> periods; final List<WalletTransaction> transactions; final List<Budget> budgets; final bool hidden;
  final Map<String, dynamic> projection;
  final ValueChanged<int>? onEditMonth;

  @override
  Widget build(BuildContext context) {
    final entries = columns.map((column) {
      var projected = 0.0, actual = 0.0;
      for (final m in column.months) {
        final period = _findPeriod(periods, year, m + 1);
        if (period != null) {
          final direct = budgets.where((b) => b.periodId == period.id && b.categoryId == category.id).fold<double>(0, (sum, b) => sum + b.targetAmount);
          projected += direct > 0 ? direct : _annualProjection(projection, m);
          actual += transactions.where((tx) => tx.type.name == category.type.name && tx.categoryId == category.id &&
              tx.date.compareTo(period.startDate) >= 0 && tx.date.compareTo(period.endDate) <= 0).fold<double>(0, (sum, tx) => sum + tx.amount);
        } else {
          final prefix = '$year-${(m + 1).toString().padLeft(2, '0')}';
          projected += _annualProjection(projection, m);
          actual += transactions.where((tx) => tx.type.name == category.type.name && tx.categoryId == category.id && tx.date.startsWith(prefix)).fold<double>(0, (sum, tx) => sum + tx.amount);
        }
      }
      return (column: column, projected: projected, actual: actual);
    }).toList();
    return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Text(category.icon, style: const TextStyle(fontSize: 20)), const SizedBox(width: 8), Expanded(child: Text(category.name, style: const TextStyle(fontWeight: FontWeight.w600))),]),
      const SizedBox(height: 10),
      for (final entry in entries)
        InkWell(
          onTap: onEditMonth == null ? null : () => onEditMonth!(entry.column.months.first),
          child: Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
            SizedBox(width: 54, child: Text(entry.column.title, style: Theme.of(context).textTheme.labelMedium)),
            Expanded(child: _value(context, 'Meta', entry.projected)),
            Expanded(child: _value(context, 'Real', entry.actual)),
            if (horizon == _Horizon.monthly && onEditMonth != null) const Icon(Icons.edit_outlined, size: 16),
          ])),
        ),
    ])));
  }

  Widget _value(BuildContext context, String label, double amount) => Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(label, style: Theme.of(context).textTheme.labelSmall), Text(formatGTQ(amount, hide: hidden), style: const TextStyle(fontWeight: FontWeight.w600))]);
}

List<_BudgetColumn> _columns(int year, _Horizon horizon) => switch (horizon) {
  _Horizon.monthly => List.generate(12, (i) => _BudgetColumn(_month(i + 1).substring(0, 3), [i])),
  _Horizon.quarterly => [for (var q = 0; q < 4; q++) _BudgetColumn('T${q + 1}', [q * 3, q * 3 + 1, q * 3 + 2])],
  _Horizon.semiannual => [const _BudgetColumn('S1', [0, 1, 2, 3, 4, 5]), const _BudgetColumn('S2', [6, 7, 8, 9, 10, 11])],
  _Horizon.annual => [_BudgetColumn('$year', List.generate(12, (i) => i))],
};

FinancialPeriod? _findPeriod(List<FinancialPeriod> periods, int year, int month) {
  final yearString = year.toString();
  for (final p in periods) {
    if (p.referenceMonth == month && p.startDate.substring(0, 4).compareTo(yearString) <= 0 && p.endDate.substring(0, 4).compareTo(yearString) >= 0) return p;
  }
  final prefix = '$year-${month.toString().padLeft(2, '0')}';
  for (final p in periods) {
    if (p.referenceMonth == null && p.startDate.startsWith(prefix)) return p;
  }
  final mid = '$prefix-15';
  for (final p in periods) {
    if (p.referenceMonth == null && p.startDate.compareTo(mid) <= 0 && p.endDate.compareTo(mid) >= 0) return p;
  }
  return null;
}

Map<String, dynamic> _planForYear(UserSettings? settings, int year) {
  final raw = settings?.annualProjections['$year'];
  return raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
}

Map<String, dynamic> _categoryPlan(Map<String, dynamic> yearPlan, Category category) {
  final raw = yearPlan[category.id];
  if (raw is Map) return Map<String, dynamic>.from(raw);
  return {'monthlyAmount': category.type == CategoryType.income && category.name.toLowerCase().contains('salario') ? 10300.0 : 0.0};
}

double _annualProjection(Map<String, dynamic> config, int monthIndex) {
  final overrides = config['monthlyOverrides'];
  final override = overrides is Map ? overrides['$monthIndex'] : null;
  return (override is num ? override : config['monthlyAmount'] is num ? config['monthlyAmount'] as num : 0).toDouble();
}

UserSettings _copySettings(UserSettings value, {Map<String, dynamic>? annualProjections}) => UserSettings(
  userId: value.userId, currency: value.currency, currencySymbolPosition: value.currencySymbolPosition,
  decimalPlaces: value.decimalPlaces, themeMode: value.themeMode, hideBalances: value.hideBalances,
  activePeriodId: value.activePeriodId, annualProjections: annualProjections ?? value.annualProjections,
);

String _month(int month) => const ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1];
extension _FirstOrNull<T> on Iterable<T> { T? get firstOrNull => isEmpty ? null : first; }
class _Notice extends StatelessWidget { const _Notice(this.text); final String text; @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(text, textAlign: TextAlign.center))); }
