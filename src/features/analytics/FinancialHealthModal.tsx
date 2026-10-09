import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Flame,
  Info,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import {
  calculateAnnualExecutiveSummary,
  calculateFinancialHealthReport,
  getCreditCardTacticalTip,
  requestWeeklyAiInference,
} from './financialHealthEngine';
import { MonthlyExecutiveReport } from '../../core/types/models';
import { formatGTQ, formatShortDateES } from '../../core/utils/formatters';
import { MONTH_NAMES_ES } from '../annual_budget/annualBudgetEngine';

interface FinancialHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateAccounts?: () => void;
  onNavigateBudgets?: () => void;
}

export const FinancialHealthModal: React.FC<FinancialHealthModalProps> = ({
  isOpen,
  onClose,
  onNavigateAccounts,
  onNavigateBudgets,
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
    settings,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const now = new Date();
  const currentYear = activePeriod ? Number(activePeriod.startDate.slice(0, 4)) : now.getFullYear();
  const currentMonth = activePeriod
    ? (activePeriod.monthIndex !== undefined
        ? activePeriod.monthIndex + 1
        : activePeriod.referenceMonth || Number(activePeriod.startDate.slice(5, 7)))
    : now.getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [activeTab, setActiveTab] = useState<'timeline' | 'annual'>('timeline');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [show52Weeks, setShow52Weeks] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const defaultWeekIdx = useMemo(() => {
    if (selectedMonth === now.getMonth() + 1 && currentYear === now.getFullYear()) {
      const d = now.getDate();
      if (d <= 7) return 1;
      if (d <= 14) return 2;
      if (d <= 21) return 3;
      return 4;
    }
    return 1;
  }, [selectedMonth, currentYear]);

  const [activeWeekIndex, setActiveWeekIndex] = useState<number>(defaultWeekIdx);

  const reportId = `report_${currentYear}_${String(selectedMonth).padStart(2, '0')}`;

  const currentReport: MonthlyExecutiveReport = useMemo(() => {
    const existing = financialReports.find((r) => r.id === reportId);
    if (existing) return existing;

    return calculateFinancialHealthReport(
      currentUser?.id || 'guest',
      currentYear,
      selectedMonth,
      accounts,
      categories,
      transactions,
      periods
    );
  }, [financialReports, reportId, currentUser?.id, currentYear, selectedMonth, accounts, categories, transactions, periods]);

  // Consolidated reports for the whole year (months 1 to 12)
  const annualMonthlyReports = useMemo(() => {
    const list: MonthlyExecutiveReport[] = [];
    for (let m = 1; m <= 12; m++) {
      const id = `report_${currentYear}_${String(m).padStart(2, '0')}`;
      const existing = financialReports.find((r) => r.id === id);
      if (existing) {
        list.push(existing);
      } else {
        const computed = calculateFinancialHealthReport(
          currentUser?.id || 'guest',
          currentYear,
          m,
          accounts,
          categories,
          transactions,
          periods
        );
        list.push(computed);
      }
    }
    return list;
  }, [financialReports, currentYear, currentUser?.id, accounts, categories, transactions, periods]);

  const annualSummary = useMemo(() => {
    return calculateAnnualExecutiveSummary(annualMonthlyReports, currentYear, transactions);
  }, [annualMonthlyReports, currentYear, transactions]);

  // Subtle tactical credit card advice
  const creditCardTip = useMemo(() => {
    return getCreditCardTacticalTip(accounts);
  }, [accounts]);

  const handleRefreshCurrent = async () => {
    setIsRefreshing(true);
    try {
      const fresh = calculateFinancialHealthReport(
        currentUser?.id || 'guest',
        currentYear,
        selectedMonth,
        accounts,
        categories,
        transactions,
        periods
      );
      // Preserve any existing AI inferences in the updated calculation
      if (currentReport.aiWeeklyInference) {
        fresh.aiWeeklyInference = currentReport.aiWeeklyInference;
      }
      fresh.weeks = fresh.weeks.map((w) => {
        const prevW = currentReport.weeks.find((pw) => pw.weekIndex === w.weekIndex);
        return prevW?.aiInference ? { ...w, aiInference: prevW.aiInference } : w;
      });
      await saveFinancialReport(fresh);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleGenerateAiWeeklyInference = async (targetWeekIdx: number) => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const weekData =
        currentReport.weeks.find((w) => w.weekIndex === targetWeekIdx) ||
        currentReport.weeks[0];

      const aiResult = await requestWeeklyAiInference({
        weekData,
        monthlyContext: {
          netSavings: currentReport.netSavings,
          savingsRatePct: currentReport.savingsRatePct,
          liquidityMonths: currentReport.liquidityMonths,
          score: currentReport.score,
          monthName: currentReport.monthName,
        },
        cardTactics: creditCardTip,
      });

      const updatedWeeks = currentReport.weeks.map((w) =>
        w.weekIndex === targetWeekIdx ? { ...w, aiInference: aiResult } : w
      );

      const updatedReport: MonthlyExecutiveReport = {
        ...currentReport,
        weeks: updatedWeeks,
        aiWeeklyInference: aiResult,
        updatedAt: new Date().toISOString(),
      };

      await saveFinancialReport(updatedReport);
    } catch (err) {
      console.error('Error al generar inferencia semanal con IA:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden ${
          isDark
            ? 'bg-[#0E131F] border-white/10 text-[#DFE2EE]'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* MODAL HEADER */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isDark ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base sm:text-lg">
                  Salud Financiera & Timeline
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}>
                  {currentYear}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Diagnóstico gerencial sincronizado en Firebase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRefreshCurrent}
              title="Recalcular y sincronizar con Firestore"
              aria-label="Recalcular y sincronizar"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TABS SELECTOR (Timeline Mensual & 4 Semanas vs. Panorama Anual Gerencial) */}
        <div className={`px-4 sm:px-6 pt-3 pb-2 border-b flex items-center justify-between gap-2 flex-wrap ${
          isDark ? 'border-white/5 bg-[#0B0F17]' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-1 p-1 rounded-2xl border border-white/5 bg-black/20">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'timeline'
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white text-emerald-700 border border-emerald-200 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeline 4 Semanas ({currentReport.monthName})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('annual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'annual'
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white text-emerald-700 border border-emerald-200 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cierre Anual {currentYear}
            </button>
          </div>

          {activeTab === 'timeline' && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Mes:
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={`py-1 px-2.5 rounded-xl border text-xs font-semibold ${
                  isDark ? 'bg-[#141A28] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                {MONTH_NAMES_ES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {activeTab === 'timeline' ? (
            <>
              {/* RESUMEN DEL MES */}
              <div
                className={`p-4 sm:p-5 rounded-3xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-[#121826] to-[#0E131F] border-white/10'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Diagnóstico del Mes de {currentReport.monthName}
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-extrabold font-display">
                        {currentReport.score}
                      </span>
                      <span className="text-xs text-slate-400">/ 100</span>
                      <span className={`ml-2 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        currentReport.level === 'excellent' || currentReport.level === 'solid'
                          ? isDark ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : currentReport.level === 'moderate'
                          ? isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                          : isDark ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        {currentReport.badgeLabel}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Ahorro Neto
                    </span>
                    <span className={`text-base font-extrabold font-mono ${
                      currentReport.netSavings >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {formatGTQ(currentReport.netSavings)}
                    </span>
                  </div>
                </div>

                {/* Métricas clave */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
                  <div className={`p-2.5 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Ingresos</span>
                    <span className="text-xs font-bold text-emerald-500 font-mono">
                      {formatGTQ(currentReport.totalIncome)}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Egresos</span>
                    <span className="text-xs font-bold text-rose-500 font-mono">
                      {formatGTQ(currentReport.totalExpenses)}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Tasa Ahorro</span>
                    <span className="text-xs font-bold font-mono">
                      {currentReport.savingsRatePct}%
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Fondo Reserva</span>
                    <span className="text-xs font-bold text-sky-400 font-mono">
                      {currentReport.liquidityMonths} meses
                    </span>
                  </div>
                </div>
              </div>

              {/* TIMELINE DE LAS 4 SEMANAS */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Avance de las 4 Semanas del Mes
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Control de ritmo de gasto
                  </span>
                </div>

                <div className="space-y-2.5">
                  {currentReport.weeks.map((week) => {
                    const isSelected = week.weekIndex === activeWeekIndex;
                    return (
                      <div
                        key={week.weekIndex}
                        onClick={() => setActiveWeekIndex(week.weekIndex)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-purple-500/50 border-purple-500/60 shadow-md'
                            : ''
                        } ${
                          week.status === 'critical'
                            ? isDark
                              ? 'bg-rose-500/10 border-rose-500/25'
                              : 'bg-rose-50/70 border-rose-200'
                            : week.status === 'warning'
                            ? isDark
                              ? 'bg-amber-500/10 border-amber-500/25'
                              : 'bg-amber-50/70 border-amber-200'
                            : isDark
                            ? 'bg-[#121826] border-white/5 hover:border-white/10'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                              week.status === 'critical'
                                ? 'bg-rose-500/20 text-rose-400'
                                : week.status === 'warning'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              S{week.weekIndex}
                            </span>
                            <div>
                              <span className="font-bold text-xs">
                                Semana {week.weekIndex}
                              </span>
                              <span className={`text-[10px] ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                ({formatShortDateES(week.startDate)} - {formatShortDateES(week.endDate)})
                              </span>
                            </div>
                            {week.aiInference && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> IA
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Egresos: <strong className="text-rose-500">{formatGTQ(week.expenses)}</strong>
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              week.status === 'critical'
                                ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                                : week.status === 'warning'
                                ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                            }`}>
                              {week.burnRateVsExpectedPct}% ritmo
                            </span>
                          </div>
                        </div>

                        <p className={`text-[11px] pl-8 leading-relaxed ${
                          isDark ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {week.highlight}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BLOQUE DE ANÁLISIS INFERENCIAL CON IA GENERATIVA (GEMINI) */}
              {(() => {
                const selectedWeekData = currentReport.weeks.find((w) => w.weekIndex === activeWeekIndex) || currentReport.weeks[0];
                const activeInference = selectedWeekData?.aiInference || (currentReport.aiWeeklyInference?.weekIndex === activeWeekIndex ? currentReport.aiWeeklyInference : undefined);

                return settings?.enableAiWeeklyAnalysis !== false ? (
                  <div
                    className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                      isDark
                        ? 'bg-gradient-to-br from-purple-950/20 via-[#121826] to-[#0E131F] border-purple-500/30'
                        : 'bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/40 border-purple-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm">
                              Análisis Inferencial con IA (Semana {activeWeekIndex})
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              Gemini
                            </span>
                          </div>
                          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Patrones y recomendaciones dinámicas sobre métricas anónimas
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isAiGenerating}
                        onClick={() => handleGenerateAiWeeklyInference(activeWeekIndex)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isAiGenerating ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Infiriendo...</span>
                          </>
                        ) : activeInference ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Actualizar S{activeWeekIndex}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Analizar Semana S{activeWeekIndex}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {activeInference ? (
                      <div className="space-y-2.5 pt-1">
                        <div className={`p-3 rounded-2xl border ${
                          isDark ? 'bg-black/30 border-white/5' : 'bg-white/80 border-purple-100'
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                              Patrón Conductual Inferido
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              activeInference.tone === 'caution' || activeInference.tone === 'urgent'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {activeInference.tone === 'caution'
                                ? '⚠️ Precaución'
                                : activeInference.tone === 'urgent'
                                ? '🚨 Acción Inmediata'
                                : '✨ Ritmo Positivo'}
                            </span>
                          </div>
                          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {activeInference.patterns}
                          </p>
                        </div>

                        <div className={`p-3 rounded-2xl border ${
                          isDark ? 'bg-black/30 border-white/5' : 'bg-white/80 border-purple-100'
                        }`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                            Recomendación Táctica Fresca
                          </span>
                          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {activeInference.actionableAdvice}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>🔒 Análisis 100% anonimizado (sin nombres ni datos bancarios)</span>
                          <span>{formatShortDateES(activeInference.generatedAt.slice(0, 10))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-3.5 rounded-2xl border text-center ${
                        isDark ? 'bg-black/20 border-white/5 text-slate-300' : 'bg-white/70 border-purple-100 text-slate-600'
                      }`}>
                        <p className="text-xs leading-relaxed">
                          Selecciona cualquier semana arriba y presiona <strong>Analizar Semana S{activeWeekIndex}</strong> para obtener una inferencia no repetitiva y recomendaciones dinámicas basadas en los patrones de gasto de ese período.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                    isDark ? 'bg-black/20 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <span>Los análisis inferenciales con IA están en pausa según tus preferencias de privacidad.</span>
                    <span className="text-[10px] text-purple-400 font-semibold">Configurable en Más</span>
                  </div>
                );
              })()}

              {/* CONSEJO TÁCTICO DE TARJETAS (Solo si tiene tarjetas activas) */}
              {creditCardTip && (
                <div
                  className={`p-4 rounded-3xl border text-xs flex items-start gap-3 transition-all ${
                    creditCardTip.type === 'due_reminder'
                      ? isDark
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                        : 'bg-amber-50/90 border-amber-200 text-amber-900'
                      : isDark
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200'
                      : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      creditCardTip.type === 'due_reminder'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-indigo-500/20 text-indigo-400'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-xs">
                        {creditCardTip.title}
                      </span>
                      {creditCardTip.badge && (
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-semibold font-mono ${
                            creditCardTip.type === 'due_reminder'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {creditCardTip.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      {creditCardTip.message}
                    </p>
                  </div>
                </div>
              )}

              {/* RECOMENDACIONES PUNTUALES ACCIONABLES */}
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider block mb-2.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Recomendaciones Gerenciales Accionables
                </span>

                <div className="space-y-2">
                  {currentReport.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                        rec.priority === 'high'
                          ? isDark
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                          : isDark
                          ? 'bg-[#121826] border-white/5'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-bold text-xs">{rec.title}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            rec.priority === 'high'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {rec.priority === 'high' ? 'Prioridad Alta' : 'Estratégico'}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${
                          isDark ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {rec.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* PANORAMA GERENCIAL DEL AÑO */}
              <div
                className={`p-5 rounded-3xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-[#121826] to-[#0E131F] border-white/10'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Cierre Anual Consolidado
                    </span>
                    <h4 className="text-xl font-bold font-display mt-0.5">
                      Panorama Anual {annualSummary.year}
                    </h4>
                  </div>

                  <div className={`px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                    isDark ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    Promedio Salud: {annualSummary.scoreAvg}/100 ({annualSummary.badgeLabel})
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
                  <div className={`p-3 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Total Ingresos Anuales</span>
                    <span className="text-sm font-bold text-emerald-500 font-mono">
                      {formatGTQ(annualSummary.totalAnnualIncome)}
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Total Egresos Anuales</span>
                    <span className="text-sm font-bold text-rose-500 font-mono">
                      {formatGTQ(annualSummary.totalAnnualExpenses)}
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border text-center ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Ahorro Neto Anual</span>
                    <span className="text-sm font-bold font-mono">
                      {formatGTQ(annualSummary.totalAnnualSavings)} ({annualSummary.annualSavingsRatePct}%)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Mejor Mes de Ahorro:</span>
                    <span className="font-bold text-emerald-400">{annualSummary.bestMonthName}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">Mes con Mayor Presión:</span>
                    <span className="font-bold text-amber-400">{annualSummary.toughestMonthName}</span>
                  </div>
                </div>
              </div>

              {/* MATRIZ MENSUAL DEL AÑO */}
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider block mb-2.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Historial de los 12 Meses del Año
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {annualMonthlyReports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(report.month);
                        setActiveTab('timeline');
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        report.month === selectedMonth
                          ? isDark
                            ? 'bg-emerald-500/15 border-emerald-500/30'
                            : 'bg-emerald-50 border-emerald-300'
                          : isDark
                          ? 'bg-[#121826] border-white/5 hover:border-white/10'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{report.monthName}</span>
                        <span className={`text-[10px] font-bold font-mono ${
                          report.score >= 70 ? 'text-emerald-400' : report.score >= 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {report.score} pts
                        </span>
                      </div>
                      <div className="text-[10px] space-y-0.5 text-slate-400">
                        <div className="flex justify-between">
                          <span>Ahorro:</span>
                          <span className="font-mono font-semibold text-slate-300">
                            {formatGTQ(report.netSavings)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estado:</span>
                          <span className="font-semibold">{report.badgeLabel}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* BITÁCORA ANUAL DE LAS 52 SEMANAS */}
              {annualSummary.weeks52 && annualSummary.weeks52.length > 0 && (
                <div className={`p-4 rounded-3xl border ${
                  isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-wider block ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Bitácora Semanal Anual (52 Semanas)
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Corte financiero fijo de 7 días asociado a su mes correspondiente
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShow52Weeks(!show52Weeks)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-xl border transition-colors cursor-pointer ${
                        isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {show52Weeks ? 'Ocultar bitácora' : `Ver las 52 semanas (${annualSummary.weeks52.length})`}
                    </button>
                  </div>

                  {show52Weeks && (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {annualSummary.weeks52.map((week) => (
                        <div
                          key={week.weekNumber}
                          className={`p-2 rounded-xl border flex items-center justify-between text-[11px] ${
                            week.status === 'critical'
                              ? isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'
                              : week.status === 'warning'
                              ? isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                              : week.status === 'upcoming'
                              ? isDark ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white border-slate-200 opacity-60'
                              : isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-400 text-[10px] w-8">
                              S{week.weekNumber}
                            </span>
                            <div>
                              <span className="font-semibold block">{week.monthName}</span>
                              <span className="text-[9px] text-slate-400">
                                {formatShortDateES(week.startDate)} - {formatShortDateES(week.endDate)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <span className="text-[9px] text-slate-400 block">Egresos:</span>
                              <span className="font-mono font-semibold text-rose-500 dark:text-rose-400">
                                {formatGTQ(week.expenses)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block">Balance:</span>
                              <span className={`font-mono font-bold ${
                                week.netSavings >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'
                              }`}>
                                {formatGTQ(week.netSavings)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* RECOMENDACIONES ESTRATÉGICAS ANUALES */}
              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="font-bold text-xs block mb-2">
                  Directrices Estratégicas para el Cierre de Año
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {annualSummary.strategicRecommendations.map((rec, i) => (
                    <li key={i} className="leading-relaxed">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 ${
          isDark ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Datos procesados con confidencialidad y respaldados con cifrado en tu base de datos.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
