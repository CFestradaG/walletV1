import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Flame,
  HelpCircle,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { calculateFinancialHealthReport } from '../analytics/financialHealthEngine';
import { MonthlyExecutiveReport } from '../../core/types/models';
import { formatGTQ } from '../../core/utils/formatters';

interface FinancialHealthCardProps {
  onOpenFullReport?: () => void;
}

export const FinancialHealthCard: React.FC<FinancialHealthCardProps> = ({
  onOpenFullReport,
}) => {
  const {
    currentUser,
    accounts,
    categories,
    transactions,
    periods,
    resolvedTheme,
    financialReports,
    saveFinancialReport,
    activePeriod,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const now = new Date();
  const currentYear = activePeriod ? Number(activePeriod.startDate.slice(0, 4)) : now.getFullYear();
  const currentMonth = activePeriod
    ? (activePeriod.monthIndex !== undefined
        ? activePeriod.monthIndex + 1
        : activePeriod.referenceMonth || Number(activePeriod.startDate.slice(5, 7)))
    : now.getMonth() + 1;

  const reportId = `report_${currentYear}_${String(currentMonth).padStart(2, '0')}`;

  // Find saved report in state/Firestore, or compute it deterministically on the fly
  const currentReport: MonthlyExecutiveReport = useMemo(() => {
    const existing = financialReports.find((r) => r.id === reportId);
    if (existing) return existing;

    return calculateFinancialHealthReport(
      currentUser?.id || 'guest',
      currentYear,
      currentMonth,
      accounts,
      categories,
      transactions,
      periods
    );
  }, [financialReports, reportId, currentUser?.id, currentYear, currentMonth, accounts, categories, transactions, periods]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      const fresh = calculateFinancialHealthReport(
        currentUser?.id || 'guest',
        currentYear,
        currentMonth,
        accounts,
        categories,
        transactions,
        periods
      );
      await saveFinancialReport(fresh);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Badge colors according to health level
  const badgeConfig = useMemo(() => {
    switch (currentReport.level) {
      case 'excellent':
        return {
          badgeBg: isDark ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dotBg: 'bg-emerald-500',
          progressColor: 'from-emerald-500 to-teal-400',
        };
      case 'solid':
        return {
          badgeBg: isDark ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' : 'bg-teal-50 border-teal-200 text-teal-800',
          dotBg: 'bg-teal-500',
          progressColor: 'from-teal-500 to-emerald-400',
        };
      case 'moderate':
        return {
          badgeBg: isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800',
          dotBg: 'bg-amber-500',
          progressColor: 'from-amber-500 to-yellow-400',
        };
      case 'alert':
        return {
          badgeBg: isDark ? 'bg-orange-500/15 border-orange-500/30 text-orange-300' : 'bg-orange-50 border-orange-200 text-orange-800',
          dotBg: 'bg-orange-500',
          progressColor: 'from-orange-500 to-amber-500',
        };
      case 'critical':
      default:
        return {
          badgeBg: isDark ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800',
          dotBg: 'bg-rose-500',
          progressColor: 'from-rose-500 to-red-500',
        };
    }
  }, [currentReport.level, isDark]);

  const topRecommendation = currentReport.recommendations[0];

  return (
    <div
      className={`rounded-3xl border transition-all overflow-hidden ${
        isDark
          ? 'bg-gradient-to-br from-[#121826] via-[#101522] to-[#0D121C] border-white/10 shadow-sm'
          : 'bg-white border-slate-200/90 shadow-xs'
      }`}
    >
      {/* HEADER / EXECUTIVE SUMMARY COMPACTO */}
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider block ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Salud Financiera
              </span>
              <span className={`text-[10px] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {currentReport.monthName} {currentReport.year} · Diagnóstico Mensual
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRefresh}
              title="Actualizar diagnóstico con movimientos recientes"
              aria-label="Actualizar diagnóstico"
              className={`p-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {onOpenFullReport && (
              <button
                type="button"
                onClick={onOpenFullReport}
                className={`text-[11px] font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <span>Timeline 4 Semanas</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* SCORE & BADGE ROW */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-extrabold font-display tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {currentReport.score}
              </span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                /100
              </span>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${badgeConfig.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${badgeConfig.dotBg} animate-pulse`} />
              <span>{currentReport.badgeLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{isExpanded ? 'Menos' : 'Detalles'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* PROGRESS BAR */}
        <div className={`w-full h-2 rounded-full overflow-hidden mb-3.5 ${
          isDark ? 'bg-white/10' : 'bg-slate-200'
        }`}>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${badgeConfig.progressColor} transition-all duration-500`}
            style={{ width: `${Math.max(5, currentReport.score)}%` }}
          />
        </div>

        {/* 3 PILARES CLAVE: TASA DE AHORRO | DTI DEUDA | COBERTURA LÍQUIDA */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={`p-2 rounded-2xl border ${
            isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <span className={`text-[10px] font-medium block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Tasa de Ahorro
            </span>
            <span className={`text-xs font-bold font-mono ${
              currentReport.savingsRatePct >= 15
                ? 'text-emerald-500 dark:text-emerald-400'
                : currentReport.savingsRatePct > 0
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-rose-500 dark:text-rose-400'
            }`}>
              {currentReport.savingsRatePct}%
            </span>
          </div>

          <div className={`p-2 rounded-2xl border ${
            isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <span className={`text-[10px] font-medium block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Deuda vs Ingreso
            </span>
            <span className={`text-xs font-bold font-mono ${
              currentReport.debtToIncomeRatioPct <= 20
                ? 'text-emerald-500 dark:text-emerald-400'
                : currentReport.debtToIncomeRatioPct <= 40
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-rose-500 dark:text-rose-400'
            }`}>
              {currentReport.debtToIncomeRatioPct}%
            </span>
          </div>

          <div className={`p-2 rounded-2xl border ${
            isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <span className={`text-[10px] font-medium block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Cobertura Líquida
            </span>
            <span className="text-xs font-bold font-mono text-sky-500 dark:text-sky-400">
              {currentReport.liquidityMonths}m
            </span>
          </div>
        </div>

        {/* RECOMENDACIÓN PRINCIPAL DESTACADA */}
        {topRecommendation && (
          <div className={`mt-3 p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
            topRecommendation.priority === 'high'
              ? isDark
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                : 'bg-rose-50 border-rose-200 text-rose-900'
              : isDark
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="flex-1 min-w-0">
              <span className="font-bold block text-[11px] mb-0.5">
                {topRecommendation.title}
              </span>
              <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                {topRecommendation.detail}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DETALLES EXPANDIBLES (TIMELINE RÁPIDO DE 4 SEMANAS) */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-2 border-t ${
          isDark ? 'border-white/5 bg-black/15' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Ritmo de las 4 Semanas del Mes
            </span>
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Semana 1 a 4
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {currentReport.weeks.map((week) => (
              <div
                key={week.weekIndex}
                className={`p-2.5 rounded-2xl border text-xs ${
                  week.status === 'critical'
                    ? isDark
                      ? 'bg-rose-500/10 border-rose-500/20'
                      : 'bg-rose-50 border-rose-200'
                    : week.status === 'warning'
                    ? isDark
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : 'bg-amber-50 border-amber-200'
                    : isDark
                    ? 'bg-white/5 border-white/5'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px]">Semana {week.weekIndex}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    week.status === 'critical'
                      ? 'bg-rose-500'
                      : week.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`} />
                </div>
                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Egresos:</span>
                    <span className="font-mono font-semibold text-rose-500 dark:text-rose-400">
                      Q{week.expenses.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Ritmo:</span>
                    <span className="font-mono font-semibold">
                      {week.burnRateVsExpectedPct}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {onOpenFullReport && (
            <button
              type="button"
              onClick={onOpenFullReport}
              className={`mt-3 w-full py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isDark
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span>Ver Diagnóstico Completo y Cierre Anual</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
