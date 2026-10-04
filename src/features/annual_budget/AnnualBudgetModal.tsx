import React, { useMemo, useState } from 'react';
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
import { formatGTQ } from '../../core/utils/formatters';
import {
  AnnualProjectionsPlan,
  calculateCategoryMatrix,
  findPeriodForMonth,
  getDefaultProjectionsPlan,
  loadProjectionsPlan,
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
  const { categories, transactions, periods, budgets, saveBudget, resolvedTheme, currentUser } =
    useWallet();
  const isDark = resolvedTheme === 'dark';

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<ViewTab>('matrix');
  const [matrixMode, setMatrixMode] = useState<MatrixDisplayMode>('comparison');
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('monthly');

  // Plan de proyecciones por categoría
  const userId = currentUser?.id || 'default_user';
  const [plan, setPlan] = useState<AnnualProjectionsPlan>(() =>
    loadProjectionsPlan(userId, categories, selectedYear)
  );

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
          className={`px-4 sm:px-6 py-3.5 border-b flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-white/10 bg-[#121824]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="order-1 flex w-[calc(100%-3rem)] sm:w-auto min-w-0 flex-1 items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-lg font-bold font-display tracking-tight leading-tight">
                  Panorama de Presupuesto (Proyectado vs. Real)
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  GTQ
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">
                  <Link2 className="w-3 h-3" />
                  <span>Conectado a Períodos</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sincronizado con tus períodos financieros, fechas y presupuestos por categoría
              </p>
            </div>
          </div>

          <div className="order-3 flex w-full sm:order-none sm:w-auto items-center justify-end gap-2">
            {/* Year selector */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-xs font-semibold ${
                isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => handleYearChange(selectedYear - 1)}
                className="p-1 hover:text-emerald-400 cursor-pointer"
                title="Año anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-sm font-bold">{selectedYear}</span>
              <button
                type="button"
                onClick={() => handleYearChange(selectedYear + 1)}
                className="p-1 hover:text-emerald-400 cursor-pointer"
                title="Año siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              title="Descargar tabla en CSV compatible con Excel"
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

          </div>

          {/* Close stays beside the title on narrow screens. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panorama de presupuesto"
            title="Cerrar panorama"
            className={`order-2 shrink-0 p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                : 'border-slate-200 hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOP SUMMARY KPIS */}
        <div className="px-4 sm:px-6 pt-4 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
          {/* KPI 1: Ingresos */}
          <div
            className={`p-3.5 rounded-xl border ${
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
            className={`p-3.5 rounded-xl border ${
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
            className={`p-3.5 rounded-xl border ${
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

        {/* TABS & CONTROLS BAR */}
        <div
          className={`px-4 sm:px-6 py-2 border-b flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
            isDark ? 'border-white/10 bg-[#0F141F]' : 'border-slate-200 bg-slate-100'
          }`}
        >
          {/* Main views */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/20 dark:bg-black/40 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matriz de Proyección
            </button>
            <button
              type="button"
              onClick={handleStartEdit}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'editor'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar Presupuesto de Categorías</span>
            </button>
          </div>

          {/* Time Horizon Selector (Mensual, Trimestral, Semestral, Anual) */}
          {activeTab === 'matrix' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center p-0.5 rounded-xl bg-black/30 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setTimeHorizon('monthly')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    timeHorizon === 'monthly'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mensual (12M)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('quarterly')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    timeHorizon === 'quarterly'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Trimestral (T1-T4)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('semiannual')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    timeHorizon === 'semiannual'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semestral (S1-S2)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('annual')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    timeHorizon === 'annual'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Anual
                </button>
              </div>

              {/* Mode toggles */}
              <div className="flex items-center gap-1 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMatrixMode('comparison')}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
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
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
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
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
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
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                  <tbody className="divide-y divide-white/5">
                    {/* BLOQUE SUPERIOR: ENCABEZADO DE INGRESOS */}
                    <tr className="bg-emerald-500/15">
                      <td
                        colSpan={matrix.columns.length + (timeHorizon !== 'annual' ? 2 : 1)}
                        className="py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 border-b border-emerald-500/20"
                      >
                        ▲ Ingresos
                      </td>
                    </tr>

                    {/* FILAS DE CATEGORÍAS DE INGRESOS */}
                    {matrix.incomeRows.map((r) => (
                      <tr key={r.category.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="sticky left-0 z-10 py-2 px-3 text-left font-medium border-r border-white/10 bg-[#0F1420] flex items-center gap-2">
                          <span className="text-sm">{r.category.icon || '💰'}</span>
                          <span className="truncate">{r.category.name}</span>
                        </td>
                        {matrix.columns.map((col) => {
                          const cell = r.cells[col.id];
                          if (matrixMode === 'comparison') {
                            return (
                              <td key={col.id} className="py-1.5 px-2 text-right">
                                <div className="font-semibold text-emerald-300">
                                  {formatGTQ(cell.projected)}
                                </div>
                                {cell.actual > 0 && (
                                  <div
                                    className={`text-[10px] ${
                                      cell.actual >= cell.projected
                                        ? 'text-emerald-400'
                                        : 'text-amber-400'
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
                              <td key={col.id} className="py-2 px-2 text-right text-emerald-300">
                                {formatGTQ(cell.projected)}
                              </td>
                            );
                          }
                          if (matrixMode === 'actual') {
                            return (
                              <td key={col.id} className="py-2 px-2 text-right text-slate-300">
                                {formatGTQ(cell.actual)}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.id}
                              className={`py-2 px-2 text-right font-semibold ${
                                cell.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {cell.difference >= 0
                                ? `+${formatGTQ(cell.difference)}`
                                : formatGTQ(cell.difference)}
                            </td>
                          );
                        })}
                        {timeHorizon !== 'annual' && (
                          <td className="py-2 px-3 text-right font-bold border-l border-white/10 text-emerald-300">
                            {matrixMode === 'actual'
                              ? formatGTQ(r.annualActual)
                              : formatGTQ(r.annualProjected)}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* FILA: TOTAL INGRESOS */}
                    <tr className="bg-emerald-500/20 font-extrabold text-emerald-200 border-t border-emerald-500/30">
                      <td className="sticky left-0 z-10 py-2.5 px-3 text-left bg-emerald-950/60 border-r border-white/10">
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
                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-300 border-l border-white/10 bg-emerald-500/30">
                          {formatGTQ(
                            matrixMode === 'actual'
                              ? matrix.totalIncome.annualActual
                              : matrix.totalIncome.annualProjected
                          )}
                        </td>
                      )}
                    </tr>

                    {/* BLOQUE INFERIOR: ENCABEZADO DE EGRESOS */}
                    <tr className="bg-rose-500/15">
                      <td
                        colSpan={matrix.columns.length + (timeHorizon !== 'annual' ? 2 : 1)}
                        className="py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-rose-300 border-b border-rose-500/20"
                      >
                        ▼ Egresos
                      </td>
                    </tr>

                    {/* FILAS DE CATEGORÍAS DE EGRESOS */}
                    {matrix.expenseRows.map((r) => (
                      <tr key={r.category.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="sticky left-0 z-10 py-2 px-3 text-left font-medium border-r border-white/10 bg-[#0F1420] flex items-center gap-2">
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
                                    className={`text-[10px] ${
                                      cell.actual <= cell.projected
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
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
                              <td key={col.id} className="py-2 px-2 text-right text-slate-300">
                                {formatGTQ(cell.actual)}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.id}
                              className={`py-2 px-2 text-right font-semibold ${
                                cell.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {cell.difference >= 0
                                ? `+${formatGTQ(cell.difference)}`
                                : formatGTQ(cell.difference)}
                            </td>
                          );
                        })}
                        {timeHorizon !== 'annual' && (
                          <td className="py-2 px-3 text-right font-bold border-l border-white/10 text-slate-200">
                            {matrixMode === 'actual'
                              ? formatGTQ(r.annualActual)
                              : formatGTQ(r.annualProjected)}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* FILA: TOTAL EGRESOS */}
                    <tr className="bg-rose-500/20 font-extrabold text-rose-200 border-t border-rose-500/30">
                      <td className="sticky left-0 z-10 py-2.5 px-3 text-left bg-rose-950/60 border-r border-white/10">
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
                            className="py-2.5 px-2 text-right font-bold text-rose-300"
                          >
                            {formatGTQ(val)}
                          </td>
                        );
                      })}
                      {timeHorizon !== 'annual' && (
                        <td className="py-2.5 px-3 text-right font-extrabold text-rose-400 border-l border-white/10 bg-rose-500/30">
                          {formatGTQ(
                            matrixMode === 'actual'
                              ? matrix.totalExpense.annualActual
                              : matrix.totalExpense.annualProjected
                          )}
                        </td>
                      )}
                    </tr>

                    {/* FILA FINAL: DIFERENCIA NETA (INGRESOS - EGRESOS) */}
                    <tr className="bg-slate-900 font-extrabold text-white border-t-2 border-emerald-500/40">
                      <td className="sticky left-0 z-10 py-3 px-3 text-left bg-black border-r border-white/10 text-emerald-400">
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
                            className={`py-3 px-2 text-right ${
                              val >= 0 ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'
                            }`}
                          >
                            {formatGTQ(val)}
                          </td>
                        );
                      })}
                      {timeHorizon !== 'annual' && (
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-300 text-sm border-l border-white/10 bg-emerald-500/25">
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
                            className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className="text-lg">{cat.icon || '💰'}</span>
                                <span className="font-bold text-xs text-white">{cat.name}</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">Base mensual (Q):</span>
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
                                    className={`w-28 px-2.5 py-1 rounded-lg border text-right font-bold text-xs text-emerald-400 ${
                                      isDark
                                        ? 'bg-black/30 border-white/10'
                                        : 'bg-white border-slate-300'
                                    }`}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer border border-white/10"
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
                              <div className="pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {MONTH_NAMES_ES.map((monthName, mIdx) => {
                                  const p = findPeriodForMonth(periods, selectedYear, mIdx);
                                  return (
                                    <div
                                      key={mIdx}
                                      className="p-2 rounded-lg bg-black/30 border border-white/5"
                                    >
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
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
                                            : 'bg-white border-slate-300'
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
                  <h5 className="font-bold text-xs uppercase tracking-wider text-rose-400">
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
                            className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className="text-lg">{cat.icon || '📦'}</span>
                                <span className="font-bold text-xs text-white">{cat.name}</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">Base mensual (Q):</span>
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
                                    className={`w-28 px-2.5 py-1 rounded-lg border text-right font-bold text-xs text-rose-400 ${
                                      isDark
                                        ? 'bg-black/30 border-white/10'
                                        : 'bg-white border-slate-300'
                                    }`}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer border border-white/10"
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
                              <div className="pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {MONTH_NAMES_ES.map((monthName, mIdx) => {
                                  const p = findPeriodForMonth(periods, selectedYear, mIdx);
                                  return (
                                    <div
                                      key={mIdx}
                                      className="p-2 rounded-lg bg-black/30 border border-white/5"
                                    >
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
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
                                            : 'bg-white border-slate-300'
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
