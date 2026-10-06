import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Link2,
  RotateCcw,
  Save,
  Sliders,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { subscribeAnnualProjections } from '../../core/firebase/firestoreSync';
import { formatGTQ } from '../../core/utils/formatters';
import {
  AnnualProjectionsPlan,
  calculateCategoryMatrix,
  findPeriodForMonth,
  getDefaultProjectionsPlan,
  loadProjectionsPlan,
  loadSavedProjectionsPlan,
  MONTH_NAMES_ES,
  MONTH_SHORT_ES,
  saveProjectionsPlan,
  TimeHorizon,
} from './annualBudgetEngine';

interface AnnualBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewTab = 'matrix' | 'editor';
type MatrixDisplayMode = 'comparison' | 'projected' | 'actual' | 'variance';

export const AnnualBudgetModal: React.FC<AnnualBudgetModalProps> = ({ isOpen, onClose }) => {
  const { categories, transactions, periods, budgets, saveBudget, saveAnnualProjections, resolvedTheme, currentUser } =
    useWallet();
  const isDark = resolvedTheme === 'dark';

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<ViewTab>('matrix');
  const [matrixMode, setMatrixMode] = useState<MatrixDisplayMode>('comparison');
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('monthly');

  // Control para mostrar u ocultar el bloque de resumen (Proyectado vs Real), ideal para teléfonos
  const [showKpiCards, setShowKpiCards] = useState<boolean>(false);

  // Plan de proyecciones por categoría
  const userId = currentUser?.id || 'default_user';
  const [plan, setPlan] = useState<AnnualProjectionsPlan>(() =>
    loadProjectionsPlan(userId, categories, selectedYear)
  );

  useEffect(() => {
    if (!isOpen || userId === 'default_user') return;
    return subscribeAnnualProjections(
      userId,
      selectedYear,
      (remotePlan, fromCache) => {
        if (remotePlan) {
          saveProjectionsPlan(userId, remotePlan);
          setPlan(remotePlan);
          return;
        }
        if (!fromCache) {
          const cachedPlan = loadSavedProjectionsPlan(userId, selectedYear);
          if (cachedPlan) saveAnnualProjections(cachedPlan);
        }
      },
      (error) => console.error('No se pudo sincronizar el plan anual:', error)
    );
  }, [isOpen, userId, selectedYear]);

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    setPlan(loadProjectionsPlan(userId, categories, newYear));
  };

  // Cálculo de la matriz conectada con períodos y presupuestos reales
  const matrix = useMemo(() => {
    return calculateCategoryMatrix(
      categories,
      transactions,
      periods,
      budgets,
      plan,
      selectedYear,
      timeHorizon
    );
  }, [categories, transactions, periods, budgets, plan, selectedYear, timeHorizon]);

  // Edición del plan de proyecciones
  const [editingPlan, setEditingPlan] = useState<AnnualProjectionsPlan>(plan);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleStartEdit = () => {
    // Al editar, sincronizar el valor inicial con los presupuestos reales de cada período si existen
    const cloned: AnnualProjectionsPlan = JSON.parse(JSON.stringify(plan));
    categories.forEach((cat) => {
      const proj = cloned.projections[cat.id] || { categoryId: cat.id, monthlyAmount: 0 };
      const overrides = { ...(proj.monthlyOverrides || {}) };

      for (let m = 0; m < 12; m++) {
        const p = findPeriodForMonth(periods, selectedYear, m);
        if (p) {
          const b = budgets.find((bg) => bg.periodId === p.id && bg.categoryId === cat.id);
          if (b && b.targetAmount > 0) {
            overrides[m] = b.targetAmount;
          }
        }
      }

      cloned.projections[cat.id] = {
        ...proj,
        monthlyOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      };
    });

    setEditingPlan(cloned);
    setActiveTab('editor');
  };

  const handleSavePlan = () => {
    saveProjectionsPlan(userId, editingPlan);
    saveAnnualProjections(editingPlan);
    setPlan(editingPlan);

    // Sincronizar automáticamente hacia los presupuestos reales (budgets) de cada período
    categories.forEach((cat) => {
      const proj = editingPlan.projections[cat.id];
      if (!proj) return;

      for (let m = 0; m < 12; m++) {
        const period = findPeriodForMonth(periods, selectedYear, m);
        if (period) {
          const targetAmount =
            proj.monthlyOverrides?.[m] !== undefined
              ? proj.monthlyOverrides[m]!
              : proj.monthlyAmount;

          const existingBudget = budgets.find(
            (b) => b.periodId === period.id && b.categoryId === cat.id
          );

          if (targetAmount > 0 || existingBudget) {
            saveBudget({
              id: existingBudget?.id,
              periodId: period.id,
              categoryId: cat.id,
              targetAmount: targetAmount,
              alertThreshold80: existingBudget?.alertThreshold80 ?? true,
              alertThreshold100: existingBudget?.alertThreshold100 ?? true,
              distributeBySubperiod: existingBudget?.distributeBySubperiod ?? true,
            });
          }
        }
      }
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    setActiveTab('matrix');
  };

  const handleResetToDefault = () => {
    const defaultP = getDefaultProjectionsPlan(categories, selectedYear);
    setEditingPlan(defaultP);
    saveProjectionsPlan(userId, defaultP);
    saveAnnualProjections(defaultP);
    setPlan(defaultP);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleUpdateMonthlyAmount = (catId: string, amount: number) => {
    const prev = editingPlan.projections[catId] || { categoryId: catId, monthlyAmount: 0 };
    setEditingPlan({
      ...editingPlan,
      projections: {
        ...editingPlan.projections,
        [catId]: {
          ...prev,
          monthlyAmount: amount,
        },
      },
    });
  };

  const handleUpdateMonthOverride = (catId: string, monthIdx: number, val: number | null) => {
    const prev = editingPlan.projections[catId] || { categoryId: catId, monthlyAmount: 0 };
    const overrides = { ...(prev.monthlyOverrides || {}) };
    if (val === null || isNaN(val)) {
      delete overrides[monthIdx];
    } else {
      overrides[monthIdx] = val;
    }

    setEditingPlan({
      ...editingPlan,
      projections: {
        ...editingPlan.projections,
        [catId]: {
          ...prev,
          monthlyOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        },
      },
    });
  };

  // Exportar a CSV según el horizonte activo
  const handleExportCSV = () => {
    const colHeaders = matrix.columns.map((c) => c.shortTitle);
    const headers = ['Tipo', 'Categoría', ...colHeaders, 'Total Año'];
    const rows: string[][] = [];

    // Ingresos por categoría
    matrix.incomeRows.forEach((r) => {
      rows.push([
        'Ingreso',
        r.category.name,
        ...matrix.columns.map((c) => r.cells[c.id].projected.toString()),
        r.annualProjected.toString(),
      ]);
    });
    // Total Ingresos
    rows.push([
      'Total',
      'Total Ingresos (Proyectado)',
      ...matrix.columns.map((c) => matrix.totalIncome.cells[c.id].projected.toString()),
      matrix.totalIncome.annualProjected.toString(),
    ]);
    rows.push([
      'Total',
      'Total Ingresos (Real)',
      ...matrix.columns.map((c) => matrix.totalIncome.cells[c.id].actual.toString()),
      matrix.totalIncome.annualActual.toString(),
    ]);

    // Egresos por categoría
    matrix.expenseRows.forEach((r) => {
      rows.push([
        'Egreso',
        r.category.name,
        ...matrix.columns.map((c) => r.cells[c.id].projected.toString()),
        r.annualProjected.toString(),
      ]);
    });
    // Total Egresos
    rows.push([
      'Total',
      'Total Egresos (Proyectado)',
      ...matrix.columns.map((c) => matrix.totalExpense.cells[c.id].projected.toString()),
      matrix.totalExpense.annualProjected.toString(),
    ]);
    rows.push([
      'Total',
      'Total Egresos (Real)',
      ...matrix.columns.map((c) => matrix.totalExpense.cells[c.id].actual.toString()),
      matrix.totalExpense.annualActual.toString(),
    ]);

    // Diferencia Neta
    rows.push([
      'Diferencia',
      'Superávit / Déficit (Proyectado)',
      ...matrix.columns.map((c) => matrix.netDifference.cells[c.id].projected.toString()),
      matrix.netDifference.annualProjected.toString(),
    ]);
    rows.push([
      'Diferencia',
      'Superávit / Déficit (Real)',
      ...matrix.columns.map((c) => matrix.netDifference.cells[c.id].actual.toString()),
      matrix.netDifference.annualActual.toString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Panorama_Presupuesto_${timeHorizon}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div
        className={`w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isDark
            ? 'bg-[#0B0F17] border-white/10 text-[#DFE2EE]'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* HEADER BAR */}
        <div
          className={`px-3 sm:px-6 py-2.5 sm:py-3 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-white/10 bg-[#121824]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {/* Título más sutil y limpio */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className={`text-xs sm:text-base font-bold tracking-tight truncate ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Panorama de Presupuesto
                </h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  GTQ
                </span>
              </div>
              <p className={`hidden sm:block text-[11px] truncate ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Proyecciones y ejecución por categoría sincronizada con períodos
              </p>
            </div>
          </div>

          {/* Controles de la cabecera bien distribuidos */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Botón para ocultar/mostrar resumen de Proyectado vs Real */}
            <button
              type="button"
              onClick={() => setShowKpiCards((prev) => !prev)}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                showKpiCards
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : isDark
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title={showKpiCards ? 'Ocultar tarjetas' : 'Mostrar tarjetas'}
            >
              {showKpiCards ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="text-[11px] font-bold">
                {showKpiCards ? 'Ocultar' : 'Resumen'}
              </span>
            </button>

            {/* Selector de año compacto */}
            <div
              className={`flex items-center gap-0.5 px-1 sm:px-1.5 py-1 rounded-lg border text-xs font-semibold ${
                isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => handleYearChange(selectedYear - 1)}
                className="p-0.5 hover:text-emerald-400 cursor-pointer"
                title="Año anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] sm:text-xs font-bold">{selectedYear}</span>
              <button
                type="button"
                onClick={() => handleYearChange(selectedYear + 1)}
                className="p-0.5 hover:text-emerald-400 cursor-pointer"
                title="Año siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              title="Descargar tabla en CSV compatible con Excel"
              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Cerrar modal */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOP SUMMARY KPIS (COLAPSABLE / OCULTABLE CON BOTÓN PARA DISPOSITIVOS MÓVILES) */}
        {!showKpiCards ? (
          <div
            onClick={() => setShowKpiCards(true)}
            className={`px-3 sm:px-6 py-2 border-b flex items-center justify-between gap-2 text-xs shrink-0 cursor-pointer transition-colors select-none ${
              isDark
                ? 'bg-black/20 border-white/5 hover:bg-black/30'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {/* Etiquetas limpias sin scroll horizontal feo */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[11px] leading-tight min-w-0">
              <span className="font-semibold text-slate-400 shrink-0">Año {selectedYear}:</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-medium whitespace-nowrap">
                Ing: {formatGTQ(matrix.totalIncome.annualProjected)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono text-[11px] font-medium whitespace-nowrap">
                Egr: {formatGTQ(matrix.totalExpense.annualProjected)}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-medium whitespace-nowrap ${
                  matrix.netDifference.annualProjected >= 0
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                Neto: {formatGTQ(matrix.netDifference.annualProjected)}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowKpiCards(true);
              }}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg hover:bg-emerald-500/10 transition-colors ml-auto"
            >
              <span>Tarjetas</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="border-b border-white/5 shrink-0 bg-black/15 animate-in fade-in duration-150">
            <div className="px-3 sm:px-6 pt-2.5 pb-1 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Resumen Proyectado vs. Real ({selectedYear})
              </span>
              <button
                type="button"
                onClick={() => setShowKpiCards(false)}
                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer py-0.5 px-2 rounded-lg hover:bg-white/5"
              >
                <EyeOff className="w-3 h-3 text-emerald-400" />
                <span>Ocultar tarjetas</span>
              </button>
            </div>

            <div className="px-3 sm:px-6 pt-1 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* KPI 1: Ingresos */}
              <div
                className={`p-3 rounded-xl border ${
                  isDark ? 'bg-[#131927] border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <span>Ingresos ({selectedYear})</span>
                  <span className="text-emerald-400 font-bold">Proyectado vs Real</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold font-display text-emerald-400">
                    {formatGTQ(matrix.totalIncome.annualProjected)}
                  </span>
                  <span className="text-xs text-slate-400">plan</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-300 border-t border-white/5 pt-1">
                  <span>Real registrado:</span>
                  <span className="font-bold text-white">
                    {formatGTQ(matrix.totalIncome.annualActual)}
                  </span>
                </div>
              </div>

              {/* KPI 2: Egresos */}
              <div
                className={`p-3 rounded-xl border ${
                  isDark ? 'bg-[#131927] border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <span>Egresos ({selectedYear})</span>
                  <span className="text-rose-400 font-bold">Proyectado vs Real</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold font-display text-rose-400">
                    {formatGTQ(matrix.totalExpense.annualProjected)}
                  </span>
                  <span className="text-xs text-slate-400">plan</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-300 border-t border-white/5 pt-1">
                  <span>Real gastado:</span>
                  <span className="font-bold text-white">
                    {formatGTQ(matrix.totalExpense.annualActual)}
                  </span>
                </div>
              </div>

              {/* KPI 3: Diferencia Neta */}
              <div
                className={`p-3 rounded-xl border ${
                  isDark
                    ? 'bg-emerald-950/20 border-emerald-500/20'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                  <span>Diferencia Neta (Superávit)</span>
                  <span className="text-emerald-300 font-bold">Ahorro</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold font-display text-emerald-300">
                    {formatGTQ(matrix.netDifference.annualProjected)}
                  </span>
                  <span className="text-xs text-emerald-400/80">plan</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-300 border-t border-emerald-500/10 pt-1">
                  <span>Resultado real a hoy:</span>
                  <span
                    className={`font-bold ${
                      matrix.netDifference.annualActual >= matrix.netDifference.annualProjected
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {formatGTQ(matrix.netDifference.annualActual)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABS & CONTROLS BAR */}
        <div
          className={`px-3 sm:px-6 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-white/10 bg-[#0F141F]' : 'border-slate-200 bg-slate-100'
          }`}
        >
          {/* Main views con tipografía sutil y compacta */}
          <div className="flex items-center gap-1 p-0.5 sm:p-1 rounded-xl bg-black/20 dark:bg-black/40 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'matrix'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matriz de Proyección
            </button>
            <button
              type="button"
              onClick={handleStartEdit}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                activeTab === 'editor'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Editar Presupuesto</span>
              <span className="hidden sm:inline"> de Categorías</span>
            </button>
          </div>

          {/* Time Horizon Selector (Mensual, Trimestral, Semestral, Anual) */}
          {activeTab === 'matrix' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center p-0.5 rounded-xl bg-black/30 border border-white/10 text-[10px] sm:text-xs">
                <button
                  type="button"
                  onClick={() => setTimeHorizon('monthly')}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    timeHorizon === 'monthly'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mensual <span className="hidden sm:inline">(12M)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('quarterly')}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    timeHorizon === 'quarterly'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Trimestral <span className="hidden sm:inline">(T1-T4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('semiannual')}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    timeHorizon === 'semiannual'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semestral <span className="hidden sm:inline">(S1-S2)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('annual')}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    timeHorizon === 'annual'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Anual
                </button>
              </div>

              {/* Mode toggles */}
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMatrixMode('comparison')}
                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    matrixMode === 'comparison'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-white/5'
                  }`}
                >
                  Comparativa
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMode('projected')}
                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    matrixMode === 'projected'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-white/5'
                  }`}
                >
                  Proyectado
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMode('actual')}
                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    matrixMode === 'actual'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-white/5'
                  }`}
                >
                  Real
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMode('variance')}
                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    matrixMode === 'variance'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-white/5'
                  }`}
                >
                  Diferencia (+/-)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BODY CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-5">
          {/* TAB 1: MATRIZ DE PROYECCIÓN */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div
                className={`w-full overflow-x-auto rounded-xl border ${
                  isDark ? 'border-white/10 bg-[#0F1420]' : 'border-slate-200 bg-white'
                }`}
              >
                <table className="w-full border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr
                      className={`border-b text-[11px] uppercase tracking-wider ${
                        isDark
                          ? 'bg-[#131927] border-white/10 text-slate-300'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <th className="sticky left-0 z-20 py-2.5 px-3 text-left font-bold min-w-[150px] sm:min-w-[180px] bg-inherit border-r border-white/10">
                        Categoría
                      </th>
                      {matrix.columns.map((col) => (
                        <th key={col.id} className="py-2.5 px-2 text-right font-bold min-w-[85px]">
                          <div>{col.shortTitle}</div>
                          {col.subtitle && (
                            <div className="text-[9px] text-slate-400 font-normal lowercase tracking-tight">
                              {col.subtitle}
                            </div>
                          )}
                        </th>
                      ))}
                      {timeHorizon !== 'annual' && (
                        <th className="py-2.5 px-3 text-right font-extrabold min-w-[100px] border-l border-white/10 bg-emerald-500/10 text-emerald-300">
                          Total Año
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                    {/* BLOQUE SUPERIOR: ENCABEZADO DE INGRESOS */}
                    <tr className={isDark ? 'bg-emerald-500/15' : 'bg-emerald-100/70'}>
                      <td
                        colSpan={matrix.columns.length + (timeHorizon !== 'annual' ? 2 : 1)}
                        className={`py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-wider border-b ${
                          isDark ? 'text-emerald-300 border-emerald-500/20' : 'text-emerald-800 border-emerald-200'
                        }`}
                      >
                        ▲ Ingresos
                      </td>
                    </tr>

                    {/* FILAS DE CATEGORÍAS DE INGRESOS */}
                    {matrix.incomeRows.map((r) => (
                      <tr key={r.category.id} className={isDark ? 'hover:bg-white/[0.03] transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                        <td className={`sticky left-0 z-10 py-2 px-3 text-left font-medium border-r flex items-center gap-2 ${
                          isDark ? 'border-white/10 bg-[#0F1420] text-slate-200' : 'border-slate-200 bg-white text-slate-900'
                        }`}>
                          <span className="text-sm">{r.category.icon || '💰'}</span>
                          <span className="truncate">{r.category.name}</span>
                        </td>
                        {matrix.columns.map((col) => {
                          const cell = r.cells[col.id];
                          if (matrixMode === 'comparison') {
                            return (
                              <td key={col.id} className="py-1.5 px-2 text-right">
                                <div className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                  {formatGTQ(cell.projected)}
                                </div>
                                {cell.actual > 0 && (
                                  <div
                                    className={`text-[10px] font-medium ${
                                      cell.actual >= cell.projected
                                        ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                        : isDark ? 'text-amber-400' : 'text-amber-600'
                                    }`}
                                  >
                                    Real: {formatGTQ(cell.actual)}
                                  </div>
                                )}
                              </td>
                            );
                          }
                          if (matrixMode === 'projected') {
                            return (
                              <td key={col.id} className={`py-2 px-2 text-right ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                {formatGTQ(cell.projected)}
                              </td>
                            );
                          }
                          if (matrixMode === 'actual') {
                            return (
                              <td key={col.id} className={`py-2 px-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {formatGTQ(cell.actual)}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.id}
                              className={`py-2 px-2 text-right font-semibold ${
                                cell.difference >= 0
                                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                  : isDark ? 'text-rose-400' : 'text-rose-600'
                              }`}
                            >
                              {cell.difference >= 0
                                ? `+${formatGTQ(cell.difference)}`
                                : formatGTQ(cell.difference)}
                            </td>
                          );
                        })}
                        {timeHorizon !== 'annual' && (
                          <td className={`py-2 px-3 text-right font-bold border-l ${
                            isDark ? 'border-white/10 text-emerald-300' : 'border-slate-200 text-emerald-700'
                          }`}>
                            {matrixMode === 'actual'
                              ? formatGTQ(r.annualActual)
                              : formatGTQ(r.annualProjected)}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* FILA: TOTAL INGRESOS */}
                    <tr className={`font-extrabold border-t ${
                      isDark
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    }`}>
                      <td className={`sticky left-0 z-10 py-2.5 px-3 text-left border-r ${
                        isDark ? 'bg-emerald-950/60 border-white/10' : 'bg-emerald-100 border-emerald-200'
                      }`}>
                        Total Ingresos
                      </td>
                      {matrix.columns.map((col) => {
                        const cell = matrix.totalIncome.cells[col.id];
                        const val =
                          matrixMode === 'projected'
                            ? cell.projected
                            : matrixMode === 'actual'
                            ? cell.actual
                            : matrixMode === 'variance'
                            ? cell.difference
                            : cell.actual > 0
                            ? cell.actual
                            : cell.projected;

                        return (
                          <td key={col.id} className="py-2.5 px-2 text-right font-bold">
                            {formatGTQ(val)}
                          </td>
                        );
                      })}
                      {timeHorizon !== 'annual' && (
                        <td className={`py-2.5 px-3 text-right font-extrabold border-l ${
                          isDark
                            ? 'text-emerald-300 border-white/10 bg-emerald-500/30'
                            : 'text-emerald-800 border-emerald-200 bg-emerald-100'
                        }`}>
                          {formatGTQ(
                            matrixMode === 'actual'
                              ? matrix.totalIncome.annualActual
                              : matrix.totalIncome.annualProjected
                          )}
                        </td>
                      )}
                    </tr>

                    {/* BLOQUE INFERIOR: ENCABEZADO DE EGRESOS */}
                    <tr className={isDark ? 'bg-rose-500/15' : 'bg-rose-100/70'}>
                      <td
                        colSpan={matrix.columns.length + (timeHorizon !== 'annual' ? 2 : 1)}
                        className={`py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-wider border-b ${
                          isDark ? 'text-rose-300 border-rose-500/20' : 'text-rose-800 border-rose-200'
                        }`}
                      >
                        ▼ Egresos
                      </td>
                    </tr>

                    {/* FILAS DE CATEGORÍAS DE EGRESOS */}
                    {matrix.expenseRows.map((r) => (
                      <tr key={r.category.id} className={isDark ? 'hover:bg-white/[0.03] transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                        <td className={`sticky left-0 z-10 py-2 px-3 text-left font-medium border-r flex items-center gap-2 ${
                          isDark ? 'border-white/10 bg-[#0F1420] text-slate-200' : 'border-slate-200 bg-white text-slate-900'
                        }`}>
                          <span className="text-sm">{r.category.icon || '📦'}</span>
                          <span className="truncate">{r.category.name}</span>
                        </td>
                        {matrix.columns.map((col) => {
                          const cell = r.cells[col.id];
                          if (matrixMode === 'comparison') {
                            return (
                              <td key={col.id} className="py-1.5 px-2 text-right">
                                <div className="font-semibold flex items-center justify-end gap-1">
                                  {cell.hasDirectBudget && (
                                    <span
                                      title="Presupuesto asignado al período"
                                      className="w-1.5 h-1.5 rounded-full bg-sky-400"
                                    />
                                  )}
                                  <span>{formatGTQ(cell.projected)}</span>
                                </div>
                                {cell.actual > 0 && (
                                  <div
                                    className={`text-[10px] font-medium ${
                                      cell.actual <= cell.projected
                                        ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                        : isDark ? 'text-rose-400' : 'text-rose-600'
                                    }`}
                                  >
                                    Real: {formatGTQ(cell.actual)}
                                  </div>
                                )}
                              </td>
                            );
                          }
                          if (matrixMode === 'projected') {
                            return (
                              <td key={col.id} className="py-2 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {cell.hasDirectBudget && (
                                    <span
                                      title="Presupuesto asignado al período"
                                      className="w-1.5 h-1.5 rounded-full bg-sky-400"
                                    />
                                  )}
                                  <span>{formatGTQ(cell.projected)}</span>
                                </div>
                              </td>
                            );
                          }
                          if (matrixMode === 'actual') {
                            return (
                              <td key={col.id} className={`py-2 px-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {formatGTQ(cell.actual)}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.id}
                              className={`py-2 px-2 text-right font-semibold ${
                                cell.difference >= 0
                                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                  : isDark ? 'text-rose-400' : 'text-rose-600'
                              }`}
                            >
                              {cell.difference >= 0
                                ? `+${formatGTQ(cell.difference)}`
                                : formatGTQ(cell.difference)}
                            </td>
                          );
                        })}
                        {timeHorizon !== 'annual' && (
                          <td className={`py-2 px-3 text-right font-bold border-l ${
                            isDark ? 'border-white/10 text-slate-200' : 'border-slate-200 text-slate-700'
                          }`}>
                            {matrixMode === 'actual'
                              ? formatGTQ(r.annualActual)
                              : formatGTQ(r.annualProjected)}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* FILA: TOTAL EGRESOS */}
                    <tr className={`font-extrabold border-t ${
                      isDark
                        ? 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}>
                      <td className={`sticky left-0 z-10 py-2.5 px-3 text-left border-r ${
                        isDark ? 'bg-rose-950/60 border-white/10' : 'bg-rose-100 border-rose-200'
                      }`}>
                        Total Egresos
                      </td>
                      {matrix.columns.map((col) => {
                        const cell = matrix.totalExpense.cells[col.id];
                        const val =
                          matrixMode === 'projected'
                            ? cell.projected
                            : matrixMode === 'actual'
                            ? cell.actual
                            : matrixMode === 'variance'
                            ? cell.difference
                            : cell.projected;

                        return (
                          <td
                            key={col.id}
                            className={`py-2.5 px-2 text-right font-bold ${
                              isDark ? 'text-rose-300' : 'text-rose-700'
                            }`}
                          >
                            {formatGTQ(val)}
                          </td>
                        );
                      })}
                      {timeHorizon !== 'annual' && (
                        <td className={`py-2.5 px-3 text-right font-extrabold border-l ${
                          isDark
                            ? 'text-rose-400 border-white/10 bg-rose-500/30'
                            : 'text-rose-800 border-rose-200 bg-rose-100'
                        }`}>
                          {formatGTQ(
                            matrixMode === 'actual'
                              ? matrix.totalExpense.annualActual
                              : matrix.totalExpense.annualProjected
                          )}
                        </td>
                      )}
                    </tr>

                    {/* FILA FINAL: DIFERENCIA NETA (INGRESOS - EGRESOS) */}
                    <tr className={`font-extrabold border-t-2 border-emerald-500/40 ${
                      isDark ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
                    }`}>
                      <td className={`sticky left-0 z-10 py-3 px-3 text-left border-r ${
                        isDark ? 'bg-black border-white/10 text-emerald-400' : 'bg-slate-200 border-slate-300 text-emerald-800'
                      }`}>
                        Diferencia (Ingresos - Egresos)
                      </td>
                      {matrix.columns.map((col) => {
                        const cell = matrix.netDifference.cells[col.id];
                        const val =
                          matrixMode === 'projected'
                            ? cell.projected
                            : matrixMode === 'actual'
                            ? cell.actual
                            : matrixMode === 'variance'
                            ? cell.difference
                            : cell.projected;

                        return (
                          <td
                            key={col.id}
                            className={`py-3 px-2 text-right font-bold ${
                              val >= 0
                                ? isDark ? 'text-emerald-300' : 'text-emerald-700'
                                : isDark ? 'text-rose-400' : 'text-rose-700'
                            }`}
                          >
                            {formatGTQ(val)}
                          </td>
                        );
                      })}
                      {timeHorizon !== 'annual' && (
                        <td className={`py-3 px-3 text-right font-extrabold text-sm border-l ${
                          isDark
                            ? 'text-emerald-300 border-white/10 bg-emerald-500/25'
                            : 'text-emerald-800 border-slate-300 bg-emerald-100'
                        }`}>
                          {formatGTQ(
                            matrixMode === 'actual'
                              ? matrix.netDifference.annualActual
                              : matrix.netDifference.annualProjected
                          )}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: EDITOR DE PRESUPUESTO POR CATEGORÍA */}
          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-bold">
                    Configuración de Presupuesto y Proyección por Categoría
                  </h4>
                  <p className="text-xs text-slate-400">
                    Al guardar aquí, se actualizan tus proyecciones y también los presupuestos
                    de los períodos financieros correspondientes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar y Sincronizar</span>
                  </button>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>
                    ¡Presupuestos y proyecciones guardados y sincronizados con tus períodos
                    financieros!
                  </span>
                </div>
              )}

              {/* LISTA DE CATEGORÍAS */}
              <div className="space-y-6">
                {/* 1. Categorías de Ingresos */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark
                      ? 'bg-[#121824] border-emerald-500/20'
                      : 'bg-emerald-50/40 border-emerald-200'
                  }`}
                >
                  <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-400">
                    ▲ Categorías de Ingresos
                  </h5>
                  <div className="space-y-2">
                    {categories
                      .filter((c) => c.type === 'income' && c.isActive)
                      .map((cat) => {
                        const proj = editingPlan.projections[cat.id] || {
                          categoryId: cat.id,
                          monthlyAmount: 0,
                        };
                        const isExpanded = expandedCatId === cat.id;

                        return (
                          <div
                            key={cat.id}
                            className={`p-3 rounded-xl border space-y-2 ${
                              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className="text-lg">{cat.icon || '💰'}</span>
                                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {cat.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                    Base mensual (Q):
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={proj.monthlyAmount || ''}
                                    onChange={(e) =>
                                      handleUpdateMonthlyAmount(
                                        cat.id,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className={`w-28 px-2.5 py-1 rounded-lg border text-right font-bold text-xs ${
                                      isDark
                                        ? 'bg-black/30 border-white/10 text-emerald-400'
                                        : 'bg-white border-slate-300 text-emerald-700'
                                    }`}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                                  className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer border transition-colors ${
                                    isDark
                                      ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <span>Meses / Períodos</span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Panel de ajustes específicos por mes / período */}
                            {isExpanded && (
                              <div className={`pt-3 border-t grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 ${
                                isDark ? 'border-white/5' : 'border-slate-100'
                              }`}>
                                {MONTH_NAMES_ES.map((monthName, mIdx) => {
                                  const p = findPeriodForMonth(periods, selectedYear, mIdx);
                                  return (
                                    <div
                                      key={mIdx}
                                      className={`p-2 rounded-lg border ${
                                        isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'
                                      }`}
                                    >
                                      <div className={`flex items-center justify-between text-[10px] font-semibold mb-1 ${
                                        isDark ? 'text-slate-400' : 'text-slate-600'
                                      }`}>
                                        <span>{monthName}</span>
                                        {p && (
                                          <span
                                            title={`Período: ${p.name}`}
                                            className="w-1.5 h-1.5 rounded-full bg-sky-400"
                                          />
                                        )}
                                      </div>
                                      <input
                                        type="number"
                                        placeholder={formatGTQ(proj.monthlyAmount)}
                                        value={proj.monthlyOverrides?.[mIdx] ?? ''}
                                        onChange={(e) =>
                                          handleUpdateMonthOverride(
                                            cat.id,
                                            mIdx,
                                            e.target.value === ''
                                              ? null
                                              : parseFloat(e.target.value)
                                          )
                                        }
                                        className={`w-full px-2 py-1 rounded text-right text-xs font-semibold ${
                                          isDark
                                            ? 'bg-black/40 border border-white/10 text-emerald-300'
                                            : 'bg-white border border-slate-300 text-slate-900'
                                        }`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* 2. Categorías de Egresos */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark
                      ? 'bg-[#121824] border-rose-500/20'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <h5 className={`font-bold text-xs uppercase tracking-wider ${
                    isDark ? 'text-rose-400' : 'text-rose-700'
                  }`}>
                    ▼ Categorías de Egresos
                  </h5>
                  <div className="space-y-2">
                    {categories
                      .filter((c) => c.type === 'expense' && c.isActive)
                      .map((cat) => {
                        const proj = editingPlan.projections[cat.id] || {
                          categoryId: cat.id,
                          monthlyAmount: 0,
                        };
                        const isExpanded = expandedCatId === cat.id;

                        return (
                          <div
                            key={cat.id}
                            className={`p-3 rounded-xl border space-y-2 ${
                              isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className="text-lg">{cat.icon || '📦'}</span>
                                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {cat.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                    Base mensual (Q):
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={proj.monthlyAmount || ''}
                                    onChange={(e) =>
                                      handleUpdateMonthlyAmount(
                                        cat.id,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className={`w-28 px-2.5 py-1 rounded-lg border text-right font-bold text-xs ${
                                      isDark
                                        ? 'bg-black/30 border-white/10 text-rose-400'
                                        : 'bg-white border-slate-300 text-rose-700'
                                    }`}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                                  className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer border transition-colors ${
                                    isDark
                                      ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <span>Meses / Períodos</span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Panel de ajustes específicos por mes / período */}
                            {isExpanded && (
                              <div className={`pt-3 border-t grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 ${
                                isDark ? 'border-white/5' : 'border-slate-100'
                              }`}>
                                {MONTH_NAMES_ES.map((monthName, mIdx) => {
                                  const p = findPeriodForMonth(periods, selectedYear, mIdx);
                                  return (
                                    <div
                                      key={mIdx}
                                      className={`p-2 rounded-lg border ${
                                        isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'
                                      }`}
                                    >
                                      <div className={`flex items-center justify-between text-[10px] font-semibold mb-1 ${
                                        isDark ? 'text-slate-400' : 'text-slate-600'
                                      }`}>
                                        <span>{monthName}</span>
                                        {p && (
                                          <span
                                            title={`Período: ${p.name}`}
                                            className="w-1.5 h-1.5 rounded-full bg-sky-400"
                                          />
                                        )}
                                      </div>
                                      <input
                                        type="number"
                                        placeholder={formatGTQ(proj.monthlyAmount)}
                                        value={proj.monthlyOverrides?.[mIdx] ?? ''}
                                        onChange={(e) =>
                                          handleUpdateMonthOverride(
                                            cat.id,
                                            mIdx,
                                            e.target.value === ''
                                              ? null
                                              : parseFloat(e.target.value)
                                          )
                                        }
                                        className={`w-full px-2 py-1 rounded text-right text-xs font-semibold ${
                                          isDark
                                            ? 'bg-black/40 border border-white/10 text-rose-300'
                                            : 'bg-white border border-slate-300 text-slate-900'
                                        }`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
