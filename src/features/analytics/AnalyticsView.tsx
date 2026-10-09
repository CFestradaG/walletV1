import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
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
import { DrilldownTarget, DrilldownTransactionsModal } from '../../core/widgets/DrilldownTransactionsModal';
import { Transaction } from '../../core/types/models';
import { formatGTQ } from '../../core/utils/formatters';
import { subscribeAnnualProjections } from '../../core/firebase/firestoreSync';
import {
  calculateCategoryMatrix,
  findPeriodForMonth,
  loadProjectionsPlan,
  loadSavedProjectionsPlan,
  saveProjectionsPlan,
} from '../annual_budget/annualBudgetEngine';
import { AnnualProjectionsPlan } from '../annual_budget/annualBudgetEngine';

interface AnalyticsViewProps {
  onOpenPeriodsModal: () => void;
  onOpenBudgetsModal: () => void;
  onOpenNewTransaction: () => void;
  onOpenAnnualBudgetModal?: () => void;
  onOpenHealthReport?: () => void;
  onEditTransaction?: (tx: Transaction) => void;
  onNavigateTab?: (tab: any) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  onOpenPeriodsModal,
  onOpenBudgetsModal,
  onOpenAnnualBudgetModal,
  onOpenHealthReport,
  onEditTransaction,
  onNavigateTab,
}) => {
  const {
    activePeriod,
    periods,
    setActivePeriodId,
    transactions,
    budgets,
    categories,
    accounts,
    currentUser,
    saveAnnualProjections,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const [selectedSubperiodId, setSelectedSubperiodId] = useState('');
  const [drilldownTarget, setDrilldownTarget] = useState<DrilldownTarget | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const annualYear = activePeriod ? Number(activePeriod.startDate.slice(0, 4)) : new Date().getFullYear();
  const annualUserId = currentUser?.id || 'default_user';
  const [annualPlan, setAnnualPlan] = useState<AnnualProjectionsPlan>(() =>
    loadProjectionsPlan(annualUserId, categories, annualYear)
  );

  useEffect(() => {
    setAnnualPlan(loadProjectionsPlan(annualUserId, categories, annualYear));
    if (annualUserId === 'default_user') return;
    return subscribeAnnualProjections(
      annualUserId,
      annualYear,
      (remotePlan, fromCache) => {
        if (remotePlan) {
          saveProjectionsPlan(annualUserId, remotePlan);
          setAnnualPlan(remotePlan);
        } else if (!fromCache) {
          const cachedPlan = loadSavedProjectionsPlan(annualUserId, annualYear);
          if (cachedPlan) saveAnnualProjections(cachedPlan);
        }
      },
      (error) => console.error('No se pudo sincronizar el plan anual en Análisis:', error)
    );
  }, [annualUserId, annualYear, categories]);

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
      .filter((t) => t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId)))
      .reduce((s, t) => s + t.amount, 0);
  }, [periodTransactions]);

  const netSavings = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // MODULE 2: Gastos por Categoría
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTransactions) {
      if ((t.type === 'expense' || t.type === 'transfer') && t.categoryId) {
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
    const map = new Map<
      string,
      { subId: string; categoryId?: string; catName: string; subName: string; amount: number; color: string }
    >();
    for (const t of periodTransactions) {
      if ((t.type === 'expense' || t.type === 'transfer') && t.subcategoryId) {
        const cat = categories.find((c) => c.id === t.categoryId);
        const sub = cat?.subcategories.find((s) => s.id === t.subcategoryId);
        const key = t.subcategoryId;
        if (!map.has(key)) {
          map.set(key, {
            subId: key,
            categoryId: t.categoryId,
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
    const map = new Map<string, { id: string; name: string; type: string; spent: number; income: number }>();
    for (const a of accounts) {
      map.set(a.id, { id: a.id, name: a.name, type: a.type, spent: 0, income: 0 });
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

  // MODULE 5: Cumplimiento de Presupuestos (Solo categorías de egreso, desduplicadas)
  const budgetPerformance = useMemo(() => {
    if (!activePeriod) return [];
    // Use the same monthly matrix as Panorama Anual so projection overrides,
    // direct budgets and period date ranges resolve identically in both views.
    const matrix = calculateCategoryMatrix(
      categories, transactions, periods, budgets, annualPlan, annualYear, 'monthly'
    );
    const matrixMonth = Array.from({ length: 12 }, (_, index) => index).find((index) =>
      findPeriodForMonth(periods, annualYear, index)?.id === activePeriod.id
    );
    const monthIndex = matrixMonth ?? activePeriod.monthIndex ??
      (activePeriod.referenceMonth ? activePeriod.referenceMonth - 1 : Number(activePeriod.startDate.slice(5, 7)) - 1);
    const column = matrix.columns.find((item) => item.id === `m_${monthIndex}`);
    if (!column) return [];
    return matrix.expenseRows.flatMap((row) => {
      const cell = row.cells[column.id];
      if (!cell || (cell.projected <= 0 && cell.actual <= 0)) return [];
      const pct = cell.projected > 0 ? Math.round((cell.actual / cell.projected) * 100) : cell.actual > 0 ? 100 : 0;
      return [{
        id: row.category.id,
        name: row.category.name,
        color: row.category.color || '#10B981',
        budget: cell.projected,
        spent: cell.actual,
        pct,
        isOver: cell.actual > cell.projected && cell.projected > 0,
      }];
    }).sort((a, b) => b.pct - a.pct);
  }, [activePeriod, annualPlan, annualYear, budgets, categories, periods, transactions]);

  // Handlers para abrir el modal de desglose (Drill-down)
  const handleOpenCategoryDrilldown = (item: {
    id: string;
    name: string;
    color: string;
    amount: number;
    pct: number;
  }) => {
    const cat = categories.find((c) => c.id === item.id);
    const matchingTxs = periodTransactions.filter(
      (t) =>
        (t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId))) &&
        t.categoryId === item.id
    );

    setDrilldownTarget({
      title: item.name,
      subtitle: activePeriod ? activePeriod.name : 'Período analizado',
      icon: cat?.icon || '📦',
      color: item.color,
      totalAmount: item.amount,
      pct: item.pct,
      transactions: matchingTxs,
      emptyMessage: `No se encontraron gastos para ${item.name} en este período.`,
    });
    setIsDrilldownOpen(true);
  };

  const handleOpenSubcategoryDrilldown = (sub: {
    subId: string;
    categoryId?: string;
    catName: string;
    subName: string;
    amount: number;
    color: string;
  }) => {
    const cat = categories.find((c) => c.id === sub.categoryId);
    const matchingTxs = periodTransactions.filter(
      (t) =>
        (t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId))) &&
        t.subcategoryId === sub.subId
    );

    setDrilldownTarget({
      title: sub.subName,
      subtitle: `${sub.catName} • ${activePeriod?.name || 'Período analizado'}`,
      icon: cat?.icon || '🏷️',
      color: sub.color,
      totalAmount: sub.amount,
      transactions: matchingTxs,
      emptyMessage: `No se encontraron gastos para ${sub.subName} en este período.`,
    });
    setIsDrilldownOpen(true);
  };

  const handleOpenBudgetDrilldown = (b: {
    id: string;
    name: string;
    color: string;
    budget: number;
    spent: number;
    pct: number;
    isOver: boolean;
  }) => {
    const cat = categories.find((c) => c.id === b.id);
    const matrixMonth = Array.from({ length: 12 }, (_, index) => index).find((index) =>
      findPeriodForMonth(periods, annualYear, index)?.id === activePeriod?.id
    );
    const monthIndex =
      matrixMonth ??
      activePeriod?.monthIndex ??
      (activePeriod?.referenceMonth
        ? activePeriod.referenceMonth - 1
        : activePeriod
        ? Number(activePeriod.startDate.slice(5, 7)) - 1
        : new Date().getMonth());
    const matchingPeriod = findPeriodForMonth(periods, annualYear, monthIndex);

    const matchingTxs = transactions.filter((t) => {
      const isMatch =
        (t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId))) &&
        t.categoryId === b.id;
      if (!isMatch) return false;
      if (matchingPeriod && matchingPeriod.startDate && matchingPeriod.endDate) {
        return (
          (t.periodId && t.periodId === matchingPeriod.id) ||
          (matchingPeriod.startDate <= t.date && t.date <= matchingPeriod.endDate)
        );
      }
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      return t.date.startsWith(`${annualYear}-${monthStr}`);
    });

    setDrilldownTarget({
      title: b.name,
      subtitle: `Presupuesto en ${activePeriod?.name || `Mes ${monthIndex + 1}`}`,
      icon: cat?.icon || '🎯',
      color: b.color,
      totalAmount: b.spent,
      budgetAmount: b.budget,
      pct: b.pct,
      isOverBudget: b.isOver,
      isNearLimit: b.pct >= 80 && b.pct <= 100,
      transactions: matchingTxs,
      emptyMessage: `No se encontraron gastos registrados para ${b.name} en este presupuesto.`,
    });
    setIsDrilldownOpen(true);
  };

  const handleOpenAccountDrilldown = (acc: {
    id: string;
    name: string;
    type: string;
    spent: number;
    income: number;
  }) => {
    const accountObj = accounts.find((a) => a.id === acc.id);
    const matchingTxs = periodTransactions.filter((t) => t.accountId === acc.id);
    setDrilldownTarget({
      title: acc.name,
      subtitle: `Actividad en ${activePeriod?.name || 'Período analizado'}`,
      icon:
        accountObj?.type === 'credit_card'
          ? '💳'
          : accountObj?.type === 'bank'
          ? '🏦'
          : accountObj?.type === 'cash'
          ? '💵'
          : '💰',
      color: accountObj?.color || '#38BDF8',
      totalAmount: acc.spent + acc.income,
      transactions: matchingTxs,
      emptyMessage: `No hay transacciones registradas para ${acc.name} en este período.`,
    });
    setIsDrilldownOpen(true);
  };

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
            {onOpenHealthReport && (
              <button
                type="button"
                onClick={onOpenHealthReport}
                className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Salud & Timeline</span>
              </button>
            )}
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
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                isDark
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
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
              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
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
              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
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
              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
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
          <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Total {formatGTQ(totalExpense)}
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className={`py-6 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No hay gastos registrados en este período.
          </p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenCategoryDrilldown(item)}
                className={`space-y-1 p-2 rounded-2xl transition-all cursor-pointer group select-none ${
                  isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-slate-50 active:bg-slate-100'
                }`}
                title={`Ver transacciones de ${item.name}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={`font-medium group-hover:text-emerald-500 transition-colors ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.pct}%</span>
                    <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      {formatGTQ(item.amount)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
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
                onClick={() => handleOpenSubcategoryDrilldown(sub)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer group select-none ${
                  isDark
                    ? 'bg-black/20 border-white/5 hover:border-emerald-500/40 hover:bg-white/5'
                    : 'bg-white border-slate-200 hover:border-emerald-500/40 hover:bg-slate-50 shadow-xs'
                }`}
                title={`Ver transacciones de ${sub.subName}`}
              >
                <div>
                  <span className={`font-bold block group-hover:text-emerald-500 transition-colors ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {sub.subName}
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub.catName}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-rose-500">
                    {formatGTQ(sub.amount)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
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
              className={`text-[11px] hover:underline cursor-pointer font-semibold ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              Panorama Anual
            </button>
          </div>

          <div className="space-y-3">
            {budgetPerformance.map((b) => (
              <div
                key={b.id}
                onClick={() => handleOpenBudgetDrilldown(b)}
                className={`space-y-1 p-2 rounded-2xl transition-all cursor-pointer group select-none ${
                  isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-slate-50 active:bg-slate-100'
                }`}
                title={`Ver transacciones de ${b.name}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium group-hover:text-emerald-500 transition-colors ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    {b.name}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatGTQ(b.spent)} de {formatGTQ(b.budget)} ({b.pct}%)
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
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

          <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
            {accountUsage.map((acc, i) => (
              <div
                key={i}
                onClick={() => handleOpenAccountDrilldown(acc)}
                className={`py-2.5 px-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                  isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                }`}
                title={`Ver transacciones de ${acc.name}`}
              >
                <div>
                  <span className={`font-bold block group-hover:text-sky-400 transition-colors ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {acc.name}
                  </span>
                  <span className={`text-[10px] capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {acc.type === 'credit_card'
                      ? 'Tarjeta de Crédito'
                      : acc.type === 'bank'
                      ? 'Banco'
                      : acc.type === 'cash'
                      ? 'Efectivo'
                      : 'Ahorro'}
                  </span>
                </div>

                <div className="text-right font-mono text-[11px] flex items-center gap-2">
                  <div>
                    {acc.income > 0 && (
                      <span className={`block font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        +{formatGTQ(acc.income)}
                      </span>
                    )}
                    {acc.spent > 0 && (
                      <span className={`block font-semibold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                        -{formatGTQ(acc.spent)}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRILLDOWN TRANSACTIONS MODAL */}
      <DrilldownTransactionsModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        target={drilldownTarget}
        onSelectTransaction={onEditTransaction}
        onNavigateToTransactions={onNavigateTab ? () => onNavigateTab('transacciones') : undefined}
      />
    </div>
  );
};
