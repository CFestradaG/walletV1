import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { PeriodSelectorBar } from '../../core/widgets/PeriodSelectorBar';
import { Transaction } from '../../core/types/models';
import { formatGTQ, formatShortDateES } from '../../core/utils/formatters';

interface DashboardViewProps {
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenPeriodsModal: () => void;
  onOpenBudgetsModal: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
  onOpenPeriodsModal,
  onOpenBudgetsModal,
  onNavigateTab,
}) => {
  const {
    activePeriod,
    accounts,
    transactions,
    budgets,
    categories,
    settings,
    toggleHideBalances,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const hideBalances = settings.hideBalances;

  // 1. Available liquid money vs credit debt
  const liquidAccounts = accounts.filter(
    (a) => a.status === 'active' && a.type !== 'credit_card'
  );
  const totalLiquid = liquidAccounts.reduce(
    (sum, a) => sum + (a.currentBalance ?? a.balance ?? 0),
    0
  );

  const creditAccounts = accounts.filter(
    (a) => a.status === 'active' && a.type === 'credit_card'
  );
  const totalCreditDebt = creditAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.currentBalance ?? a.balance ?? 0),
    0
  );

  // 2. Active Period financial summary
  const periodTransactions = useMemo(() => {
    if (!activePeriod) return [];
    return transactions.filter((t) => t.periodId === activePeriod.id);
  }, [transactions, activePeriod]);

  const periodIncome = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [periodTransactions]);

  const periodExpense = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [periodTransactions]);

  const periodNet = periodIncome - periodExpense;

  // 3. Budgets status for active period
  const activeBudgetsSummary = useMemo(() => {
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
      const budgetLimit = b.targetAmount ?? b.amount ?? 0;
      const pct = budgetLimit > 0 ? Math.min(100, Math.round((spent / budgetLimit) * 100)) : 0;

      return {
        ...b,
        categoryName: cat?.name || 'Categoría',
        color: cat?.color || '#10B981',
        spent,
        limitAmount: budgetLimit,
        pct,
      };
    });
  }, [budgets, activePeriod, periodTransactions, categories]);

  // 4. Recent transactions (latest registered by the user)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      })
      .slice(0, 5);
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* ACTIVE PERIOD SELECTOR BAR */}
      <PeriodSelectorBar onOpenPeriodsModal={onOpenPeriodsModal} />

      {/* TOTAL AVAILABLE MONEY HERO CARD */}
      <div
        className={`rounded-3xl p-5 border relative overflow-hidden transition-all shadow-sm ${
          isDark
            ? 'bg-gradient-to-br from-[#131927] to-[#1A2234] border-white/10'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Dinero disponible
          </span>
          <button
            type="button"
            onClick={toggleHideBalances}
            title={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
            className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="font-mono text-3xl font-extrabold tracking-tight text-white mb-4">
          {hideBalances ? '••••••••' : formatGTQ(totalLiquid)}
        </div>

        {/* Separated Credit Card Debt Pill */}
        {totalCreditDebt > 0 && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>
              Deuda en tarjetas: {hideBalances ? '••••' : formatGTQ(totalCreditDebt)}
            </span>
          </div>
        )}

        {/* PERIOD SUMMARY ROW */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Ingresos</span>
            </div>
            <div className="font-mono text-xs font-bold text-emerald-400">
              {hideBalances ? '••••' : formatGTQ(periodIncome)}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <span>Gastos</span>
            </div>
            <div className="font-mono text-xs font-bold text-rose-400">
              {hideBalances ? '••••' : formatGTQ(periodExpense)}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
              <Wallet className="w-3 h-3 text-sky-400" />
              <span>Neto</span>
            </div>
            <div
              className={`font-mono text-xs font-bold ${
                periodNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {hideBalances ? '••••' : `${periodNet >= 0 ? '+' : ''}${formatGTQ(periodNet)}`}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SHORTCUT BUTTONS */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={onOpenNewTransaction}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark
              ? 'bg-[#131927] border-white/10 hover:border-emerald-500/40'
              : 'bg-white border-slate-200 hover:border-emerald-500/40 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Nueva</span>
          <span className="text-[10px] text-slate-400 block">Transacción</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('cuentas')}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark
              ? 'bg-[#131927] border-white/10 hover:border-sky-500/40'
              : 'bg-white border-slate-200 hover:border-sky-500/40 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center mx-auto mb-1.5">
            <Landmark className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Cuentas</span>
          <span className="text-[10px] text-slate-400 block">{accounts.length} activas</span>
        </button>

        <button
          type="button"
          onClick={onOpenBudgetsModal}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark
              ? 'bg-[#131927] border-white/10 hover:border-amber-500/40'
              : 'bg-white border-slate-200 hover:border-amber-500/40 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-1.5">
            <Target className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Presupuestos</span>
          <span className="text-[10px] text-slate-400 block">
            {activeBudgetsSummary.length} activos
          </span>
        </button>
      </div>

      {/* BUDGETS PROGRESS (IF ANY) */}
      {activeBudgetsSummary.length > 0 && (
        <div
          className={`p-4 rounded-3xl border transition-all ${
            isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold">Presupuestos del período</span>
            <button
              type="button"
              onClick={onOpenBudgetsModal}
              className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {activeBudgetsSummary.slice(0, 3).map((b) => (
              <div key={b.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-medium">{b.categoryName}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {formatGTQ(b.spent)} / {formatGTQ(b.limitAmount)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      b.pct >= 100
                        ? 'bg-rose-500'
                        : b.pct > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECENT TRANSACTIONS LIST */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold">Transacciones recientes</span>
          <button
            type="button"
            onClick={() => onNavigateTab('transacciones')}
            className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver historial</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            <ReceiptText className="w-6 h-6 mx-auto mb-1 text-slate-500" />
            <span>No hay transacciones en este período.</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
              const acc = accounts.find((a) => a.id === tx.accountId);

              return (
                <div
                  key={tx.id}
                  onClick={() => onEditTransaction(tx)}
                  className="py-2.5 flex items-center justify-between hover:bg-white/5 rounded-xl px-1.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        tx.type === 'income'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : tx.type === 'transfer'
                          ? 'bg-sky-500/15 text-sky-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : tx.type === 'transfer' ? (
                        <ArrowRightLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white">
                        {tx.type === 'transfer'
                          ? 'Transferencia'
                          : cat?.name || 'Sin categoría'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {sub?.name || acc?.name || ''} · {formatShortDateES(tx.date)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-mono text-xs font-bold ${
                        tx.type === 'income'
                          ? 'text-emerald-400'
                          : tx.type === 'transfer'
                          ? 'text-sky-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                      {hideBalances ? '••••' : formatGTQ(tx.amount)}
                    </p>
                    {tx.note && (
                      <p className="text-[10px] text-slate-500 max-w-[120px] truncate">
                        {tx.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
