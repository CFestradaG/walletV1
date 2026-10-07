import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
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
import {
  calculateCumulativeYearSummary,
  loadProjectionsPlan,
} from '../annual_budget/annualBudgetEngine';

interface DashboardViewProps {
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenPeriodsModal: () => void;
  onOpenBudgetsModal?: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenAnnualBudgetModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
  onOpenPeriodsModal,
  onOpenBudgetsModal,
  onNavigateTab,
  onOpenAnnualBudgetModal,
}) => {
  const {
    activePeriod,
    periods,
    accounts,
    transactions,
    budgets,
    categories,
    settings,
    currentUser,
    toggleHideBalances,
    resolvedTheme,
    projectionsVersion,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const hideBalances = settings.hideBalances;

  // 1. Dinero disponible líquido vs Deuda de tarjetas
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
    (sum, a) => sum + Math.max(0, -(a.currentBalance ?? a.balance ?? 0)),
    0
  );

  // 2. Resumen financiero del Período Activo
  const periodTransactions = useMemo(() => {
    if (!activePeriod) return [];
    return transactions.filter(
      (t) =>
        t.periodId === activePeriod.id ||
        (t.date >= activePeriod.startDate && t.date <= activePeriod.endDate)
    );
  }, [transactions, activePeriod]);

  const periodIncome = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [periodTransactions]);

  const periodExpense = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId)))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [periodTransactions]);

  const periodNet = periodIncome - periodExpense;

  // 3. Resumen Acumulado del Año (Proyectado vs. Real) & Alertas
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const userId = currentUser?.id || 'default_user';

  const plan = useMemo(
    () => loadProjectionsPlan(userId, categories, currentYear),
    [userId, categories, currentYear, projectionsVersion]
  );

  const cumulativeSummary = useMemo(() => {
    return calculateCumulativeYearSummary(
      categories,
      transactions,
      periods,
      budgets,
      plan,
      currentYear,
      currentMonthIndex
    );
  }, [categories, transactions, periods, budgets, plan, currentYear, currentMonthIndex]);

  // Alertas del mes actual (categorías con gasto > 80% o sobregiro)
  const activeAlerts = useMemo(() => {
    return cumulativeSummary.currentMonthAlerts.filter(
      (a) => a.isOverBudget || a.isNearLimit
    );
  }, [cumulativeSummary]);

  // 4. Transacciones recientes
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      })
      .slice(0, 5);
  }, [transactions]);

  const handleOpenBudget = onOpenAnnualBudgetModal || onOpenBudgetsModal;

  return (
    <div className="space-y-4">
      {/* BARRA DE SELECCIÓN DE PERÍODO ACTIVO */}
      <PeriodSelectorBar onOpenPeriodsModal={onOpenPeriodsModal} />

      {/* TARJETA PRINCIPAL: DINERO DISPONIBLE */}
      <div
        className={`rounded-3xl p-5 border relative overflow-hidden transition-all shadow-sm ${
          isDark
            ? 'bg-gradient-to-br from-[#131927] to-[#1A2234] border-white/10'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Dinero disponible
          </span>
          <button
            type="button"
            onClick={toggleHideBalances}
            title={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <h2 className={`text-3xl font-extrabold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {hideBalances ? '••••••' : formatGTQ(totalLiquid)}
          </h2>
        </div>

        {/* Resumen secundario: Deuda en tarjetas */}
        <div className={`pt-3 border-t flex items-center justify-between text-xs ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <CreditCard className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>Deuda en tarjetas:</span>
          </div>
          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">
            {hideBalances ? '••••••' : formatGTQ(totalCreditDebt)}
          </span>
        </div>
      </div>

      {/* RESUMEN DEL PERÍODO ACTIVO */}
      <div
        className={`rounded-3xl p-4 border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {activePeriod?.name || 'Período actual'}
          </span>
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {activePeriod ? `${formatShortDateES(activePeriod.startDate)} - ${formatShortDateES(activePeriod.endDate)}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Ingresos */}
          <div className={`p-2.5 rounded-2xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/15' : 'bg-emerald-50/80 border-emerald-200'}`}>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block mb-0.5">
              Ingresos
            </span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-display block">
              {hideBalances ? '••••' : formatGTQ(periodIncome)}
            </span>
          </div>

          {/* Gastos */}
          <div className={`p-2.5 rounded-2xl border ${isDark ? 'bg-rose-500/10 border-rose-500/15' : 'bg-rose-50/80 border-rose-200'}`}>
            <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block mb-0.5">
              Gastos
            </span>
            <span className="text-sm font-bold text-rose-700 dark:text-rose-400 font-display block">
              {hideBalances ? '••••' : formatGTQ(periodExpense)}
            </span>
          </div>

          {/* Balance Neto */}
          <div
            className={`p-2.5 rounded-2xl border ${
              periodNet >= 0
                ? isDark
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                : isDark
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-rose-50/80 border-rose-200 text-rose-800'
            }`}
          >
            <span className="text-[10px] font-semibold block mb-0.5">
              Neto
            </span>
            <span className="text-sm font-bold font-display block">
              {hideBalances ? '••••' : formatGTQ(periodNet)}
            </span>
          </div>
        </div>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-4 gap-2">
        {/* Nueva transacción */}
        <button
          type="button"
          onClick={onOpenNewTransaction}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark ? 'bg-[#131927] border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Nueva</span>
          <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Operación</span>
        </button>

        {/* Ver Cuentas */}
        <button
          type="button"
          onClick={() => onNavigateTab('cuentas')}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark ? 'bg-[#131927] border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-1.5">
            <Landmark className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Cuentas</span>
          <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{accounts.length} tarjetas</span>
        </button>

        {/* Administrar Períodos */}
        <button
          type="button"
          onClick={onOpenPeriodsModal}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark ? 'bg-[#131927] border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-1.5">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Períodos</span>
          <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cortes</span>
        </button>

        {/* Presupuesto & Panorama Anual Único */}
        <button
          type="button"
          onClick={handleOpenBudget}
          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
            isDark ? 'bg-[#131927] border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-1.5">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold block">Presupuesto</span>
          <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Panorama Anual</span>
        </button>
      </div>

      {/* SECCIÓN ESTRELLA: RESUMEN ACUMULADO DEL AÑO (PROYECTADO VS REAL) */}
      <div
        className={`p-5 rounded-3xl border transition-all ${
          isDark
            ? 'bg-gradient-to-br from-[#131927] to-[#101622] border-white/10'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Resumen Acumulado del Año {currentYear}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isDark
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                Proyectado vs Real
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Progreso acumulado hasta {cumulativeSummary.currentMonthName} ({currentYear})
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenBudget}
            className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ver Panorama Completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tarjetas YTD Acumuladas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          {/* 1. Ingresos YTD */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <span
              className={`text-[11px] font-semibold block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Ingresos Acumulados
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold font-display text-emerald-500">
                {hideBalances ? '••••' : formatGTQ(cumulativeSummary.ytdActualIncome)}
              </span>
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                de {hideBalances ? '••••' : formatGTQ(cumulativeSummary.ytdProjectedIncome)}
              </span>
            </div>
            <div
              className={`w-full h-1.5 rounded-full overflow-hidden mt-2 ${
                isDark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200/60'
              }`}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    cumulativeSummary.ytdProjectedIncome > 0
                      ? Math.round(
                          (cumulativeSummary.ytdActualIncome /
                            cumulativeSummary.ytdProjectedIncome) *
                            100
                        )
                      : 0
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 2. Egresos YTD */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <span
              className={`text-[11px] font-semibold block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Egresos Acumulados
            </span>
            <div className="flex items-baseline justify-between">
              <span
                className={`text-base font-bold font-display ${
                  cumulativeSummary.ytdActualExpense > cumulativeSummary.ytdProjectedExpense
                    ? 'text-rose-500'
                    : isDark
                    ? 'text-white'
                    : 'text-slate-900'
                }`}
              >
                {hideBalances ? '••••' : formatGTQ(cumulativeSummary.ytdActualExpense)}
              </span>
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                de {hideBalances ? '••••' : formatGTQ(cumulativeSummary.ytdProjectedExpense)}
              </span>
            </div>
            <div
              className={`w-full h-1.5 rounded-full overflow-hidden mt-2 ${
                isDark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200/60'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  cumulativeSummary.ytdActualExpense > cumulativeSummary.ytdProjectedExpense
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    cumulativeSummary.ytdProjectedExpense > 0
                      ? Math.round(
                          (cumulativeSummary.ytdActualExpense /
                            cumulativeSummary.ytdProjectedExpense) *
                            100
                        )
                      : 0
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 3. Ahorro / Superávit Neto YTD */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <span
              className={`text-[11px] font-semibold block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Ahorro Neto Acumulado
            </span>
            <div className="flex items-baseline justify-between">
              <span
                className={`text-base font-bold font-display ${
                  cumulativeSummary.ytdActualNet >= cumulativeSummary.ytdProjectedNet
                    ? isDark
                      ? 'text-emerald-300'
                      : 'text-emerald-600'
                    : isDark
                    ? 'text-amber-300'
                    : 'text-amber-600'
                }`}
              >
                {hideBalances ? '••••' : formatGTQ(cumulativeSummary.ytdActualNet)}
              </span>
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                meta {hideBalances ? '••••' : formatGTQ(cumulativeSummary.ytdProjectedNet)}
              </span>
            </div>
            <div className={`mt-1 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {cumulativeSummary.ytdActualNet >= cumulativeSummary.ytdProjectedNet ? (
                <span className={isDark ? 'text-emerald-400' : 'text-emerald-600 font-semibold'}>
                  +
                  {formatGTQ(
                    cumulativeSummary.ytdActualNet - cumulativeSummary.ytdProjectedNet
                  )}{' '}
                  sobre lo proyectado
                </span>
              ) : (
                <span className={isDark ? 'text-amber-400' : 'text-amber-600 font-semibold'}>
                  {formatGTQ(
                    cumulativeSummary.ytdActualNet - cumulativeSummary.ytdProjectedNet
                  )}{' '}
                  respecto a la meta
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ALERTAS DE PRESUPUESTO DEL MES ACTUAL */}
        <div className={`pt-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Estado de Presupuesto en {cumulativeSummary.currentMonthName}
            </span>
            {activeAlerts.length > 0 ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                <span>{activeAlerts.length} alerta(s) de gasto</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Todo dentro de lo proyectado</span>
              </span>
            )}
          </div>

          {activeAlerts.length === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>
                Tus gastos de {cumulativeSummary.currentMonthName} se mantienen dentro de la
                proyección presupuestaria planificada.
              </span>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.category.id}
                  className={`p-3 rounded-2xl border space-y-1.5 transition-all ${
                    isDark
                      ? 'bg-black/20 border-white/5'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{alert.category.icon || '📦'}</span>
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {alert.category.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500 font-medium'}`}>
                        {formatGTQ(alert.actual)} / {formatGTQ(alert.projected)}
                      </span>
                      {alert.isOverBudget ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/25">
                          Sobregiro {alert.pct}%
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25">
                          {alert.pct}% usado
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`w-full h-1.5 rounded-full overflow-hidden ${
                      isDark ? 'bg-white/10' : 'bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        alert.isOverBudget ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, alert.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TRANSACCIONES RECIENTES */}
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
            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver historial</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className={`py-6 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <ReceiptText className={`w-6 h-6 mx-auto mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <span>No hay transacciones registradas.</span>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
            {recentTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
              const acc = accounts.find((a) => a.id === tx.accountId);

              return (
                <div
                  key={tx.id}
                  onClick={() => onEditTransaction(tx)}
                  className={`py-2.5 flex items-center justify-between rounded-xl px-1.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        tx.type === 'income'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : tx.type === 'transfer'
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
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
                      <span className={`font-semibold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {tx.note || cat?.name || 'Transacción'}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatShortDateES(tx.date)} {acc ? `• ${acc.name}` : ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold font-mono ${
                      tx.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : tx.type === 'transfer'
                        ? 'text-sky-600 dark:text-sky-400'
                        : isDark
                        ? 'text-rose-400'
                        : 'text-rose-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {hideBalances ? '••••' : formatGTQ(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
