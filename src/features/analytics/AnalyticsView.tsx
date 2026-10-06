import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  FileSpreadsheet,
  Landmark,
  PieChart,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { PeriodSelectorBar } from '../../core/widgets/PeriodSelectorBar';
import { formatGTQ } from '../../core/utils/formatters';

interface AnalyticsViewProps {
  onOpenPeriodsModal: () => void;
  onOpenBudgetsModal: () => void;
  onOpenNewTransaction: () => void;
  onOpenAnnualBudgetModal?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  onOpenPeriodsModal,
  onOpenBudgetsModal,
  onOpenAnnualBudgetModal,
}) => {
  const {
    activePeriod,
    periods,
    setActivePeriodId,
    transactions,
    budgets,
    categories,
    accounts,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const [selectedSubperiodId, setSelectedSubperiodId] = useState('');

  useEffect(() => {
    setSelectedSubperiodId('');
  }, [activePeriod?.id]);

  // Period transactions
  const periodTransactions = useMemo(() => {
    if (!activePeriod) return [];
    const currentPeriodTransactions = transactions.filter((t) => t.periodId === activePeriod.id);
    if (!selectedSubperiodId) return currentPeriodTransactions;
    const subperiod = activePeriod.subperiods.find((item) => item.id === selectedSubperiodId);
    return currentPeriodTransactions.filter((t) => t.subperiodId === selectedSubperiodId ||
      (!t.subperiodId && subperiod && t.date >= subperiod.startDate && t.date <= subperiod.endDate));
  }, [transactions, activePeriod, selectedSubperiodId]);

  // MODULE 1: Ingresos vs Gastos vs Balance Neto
  const totalIncome = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
  }, [periodTransactions]);

  const totalExpense = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
  }, [periodTransactions]);

  const netSavings = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // MODULE 2: Gastos por Categoría
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTransactions) {
      if (t.type === 'expense' && t.categoryId) {
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
      }
    }

    const items = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
      return {
        id: catId,
        name: cat?.name || 'Otras',
        color: cat?.color || '#10B981',
        amount,
        pct,
      };
    });

    items.sort((a, b) => b.amount - a.amount);
    return items;
  }, [periodTransactions, categories, totalExpense]);

  // MODULE 3: Top Subcategorías
  const topSubcategories = useMemo(() => {
    const map = new Map<string, { catName: string; subName: string; amount: number; color: string }>();
    for (const t of periodTransactions) {
      if (t.type === 'expense' && t.subcategoryId) {
        const cat = categories.find((c) => c.id === t.categoryId);
        const sub = cat?.subcategories.find((s) => s.id === t.subcategoryId);
        const key = t.subcategoryId;
        if (!map.has(key)) {
          map.set(key, {
            catName: cat?.name || 'Categoría',
            subName: sub?.name || 'Subcategoría',
            amount: 0,
            color: cat?.color || '#10B981',
          });
        }
        map.get(key)!.amount += t.amount;
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => b.amount - a.amount);
    return list.slice(0, 5);
  }, [periodTransactions, categories]);

  // MODULE 4: Gastos por Cuenta
  const accountUsage = useMemo(() => {
    const map = new Map<string, { name: string; type: string; spent: number; income: number }>();
    for (const a of accounts) {
      map.set(a.id, { name: a.name, type: a.type, spent: 0, income: 0 });
    }

    for (const t of periodTransactions) {
      if (t.accountId && t.type === 'expense' && map.has(t.accountId)) {
        map.get(t.accountId)!.spent += t.amount;
      } else if (t.accountId && t.type === 'income' && map.has(t.accountId)) {
        map.get(t.accountId)!.income += t.amount;
      }
    }

    return Array.from(map.values()).filter((a) => a.spent > 0 || a.income > 0);
  }, [accounts, periodTransactions]);

  // MODULE 5: Cumplimiento de Presupuestos
  const budgetPerformance = useMemo(() => {
    if (!activePeriod) return [];
    const pBudgets = budgets.filter((b) => b.periodId === activePeriod.id);

    return pBudgets.map((b) => {
      const spent = periodTransactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.categoryId === b.categoryId &&
            (!b.subcategoryId || t.subcategoryId === b.subcategoryId)
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const cat = categories.find((c) => c.id === b.categoryId);
      const sub = cat?.subcategories.find((s) => s.id === b.subcategoryId);
      const budgetAmount = b.targetAmount ?? b.amount ?? 0;
      const pct = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

      return {
        id: b.id,
        name: sub ? `${cat?.name} (${sub.name})` : cat?.name || 'Categoría',
        color: cat?.color || '#10B981',
        budget: budgetAmount,
        spent,
        pct,
        isOver: spent > budgetAmount,
      };
    });
  }, [budgets, activePeriod, periodTransactions, categories]);

  // Export CSV summary
  const exportSummaryCSV = () => {
    if (!activePeriod) return;
    const rows = [
      ['Período', activePeriod.name],
      ...(selectedSubperiodId ? [['Subperíodo', activePeriod.subperiods.find((item) => item.id === selectedSubperiodId)?.name || '']] : []),
      ['Rango', `${activePeriod.startDate} a ${activePeriod.endDate}`],
      ['Total Ingresos', totalIncome.toFixed(2)],
      ['Total Gastos', totalExpense.toFixed(2)],
      ['Balance Neto', netSavings.toFixed(2)],
      [],
      ['Categoría', 'Gasto', 'Porcentaje'],
      ...categoryBreakdown.map((c) => [c.name, c.amount.toFixed(2), `${c.pct}%`]),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const subperiodName = activePeriod.subperiods.find((item) => item.id === selectedSubperiodId)?.name;
    link.setAttribute('download', `reporte_${activePeriod.name}${subperiodName ? `_${subperiodName}` : ''}`.replace(/\s+/g, '_') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* PERIOD SELECTOR BAR */}
      <PeriodSelectorBar onOpenPeriodsModal={onOpenPeriodsModal} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] uppercase tracking-wide text-slate-400">
          Período
          <select
            value={activePeriod?.id || ''}
            onChange={(e) => setActivePeriodId(e.target.value)}
            className={`mt-1 w-full p-2 rounded-xl border text-xs normal-case tracking-normal ${isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wide text-slate-400">
          Subperíodo
          <select
            value={selectedSubperiodId}
            disabled={!activePeriod}
            onChange={(e) => setSelectedSubperiodId(e.target.value)}
            className={`mt-1 w-full p-2 rounded-xl border text-xs normal-case tracking-normal disabled:opacity-50 ${isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            <option value="">Todo el período</option>
            {activePeriod?.subperiods.map((subperiod) => <option key={subperiod.id} value={subperiod.id}>{subperiod.name}</option>)}
          </select>
        </label>
      </div>

      {/* OVERALL HERO CARD */}
      <div
        className={`p-5 rounded-3xl border transition-all ${
          isDark
            ? 'bg-gradient-to-br from-[#131927] to-[#1A2234] border-white/10'
            : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h1 className="font-display font-bold text-base">Análisis Financiero</h1>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAnnualBudgetModal && (
              <button
                type="button"
                onClick={onOpenAnnualBudgetModal}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Panorama Anual</span>
              </button>
            )}
            <button
              type="button"
              onClick={exportSummaryCSV}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer text-slate-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* 3 Metrics Row */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div
            className={`p-3 rounded-2xl border transition-all ${
              isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Ingresos
            </span>
            <span className="font-mono text-sm font-bold text-emerald-500 block">
              {formatGTQ(totalIncome)}
            </span>
          </div>

          <div
            className={`p-3 rounded-2xl border transition-all ${
              isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Gastos
            </span>
            <span className="font-mono text-sm font-bold text-rose-500 block">
              {formatGTQ(totalExpense)}
            </span>
          </div>

          <div
            className={`p-3 rounded-2xl border transition-all ${
              isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Ahorro Neto
            </span>
            <span
              className={`font-mono text-sm font-bold block ${
                netSavings >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {netSavings >= 0 ? '+' : ''}
              {formatGTQ(netSavings)}
            </span>
            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ({savingsRate}% tasa de ahorro)
            </span>
          </div>
        </div>
      </div>

      {/* MODULE 2: CATEGORY BREAKDOWN WITH PROGRESS BARS */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold">Distribución por Categorías</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Total {formatGTQ(totalExpense)}
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No hay gastos registrados en este período.
          </p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-200">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400 text-[11px]">{item.pct}%</span>
                    <span className="font-bold text-slate-200">
                      {formatGTQ(item.amount)}
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.pct}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODULE 3: TOP SUBCATEGORIES */}
      {topSubcategories.length > 0 && (
        <div
          className={`p-4 rounded-3xl border transition-all ${
            isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h2 className="text-xs font-bold mb-3">Subcategorías de mayor gasto</h2>
          <div className="space-y-2">
            {topSubcategories.map((sub, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                  isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>{sub.subName}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub.catName}</span>
                </div>
                <span className="font-mono font-bold text-rose-500">
                  {formatGTQ(sub.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE 5: BUDGET PERFORMANCE */}
      {budgetPerformance.length > 0 && (
        <div
          className={`p-4 rounded-3xl border transition-all ${
            isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold">Cumplimiento de Presupuestos</h2>
            </div>
            <button
              type="button"
              onClick={onOpenAnnualBudgetModal || onOpenBudgetsModal}
              className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
            >
              Panorama Anual
            </button>
          </div>

          <div className="space-y-3">
            {budgetPerformance.map((b) => (
              <div key={b.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">{b.name}</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {formatGTQ(b.spent)} de {formatGTQ(b.budget)} ({b.pct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      b.isOver
                        ? 'bg-rose-500'
                        : b.pct > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, b.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE 6: ACCOUNT ROTATION / USAGE */}
      {accountUsage.length > 0 && (
        <div
          className={`p-4 rounded-3xl border transition-all ${
            isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold">Actividad por Cuenta</h2>
          </div>

          <div className="divide-y divide-white/5">
            {accountUsage.map((acc, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">{acc.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {acc.type === 'credit_card'
                      ? 'Tarjeta de Crédito'
                      : acc.type === 'bank'
                      ? 'Banco'
                      : acc.type === 'cash'
                      ? 'Efectivo'
                      : 'Ahorro'}
                  </span>
                </div>

                <div className="text-right font-mono text-[11px]">
                  {acc.income > 0 && (
                    <span className="text-emerald-400 block font-semibold">
                      +{formatGTQ(acc.income)}
                    </span>
                  )}
                  {acc.spent > 0 && (
                    <span className="text-rose-400 block font-semibold">
                      -{formatGTQ(acc.spent)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
