import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Edit3,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { FinancialPeriod, SubdivisionMode } from '../../core/types/models';
import { formatPeriodRangeES, toISODate } from '../../core/utils/formatters';
import {
  generateSubperiods,
  validateFinancialPeriod,
} from './periodEngine';
import { MONTH_NAMES_ES } from '../annual_budget/annualBudgetEngine';

interface PeriodsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodsModal: React.FC<PeriodsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    periods,
    activePeriod,
    selectActivePeriod,
    createPeriod,
    updatePeriod,
    deletePeriod,
    transactions,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';

  const [isEditing, setIsEditing] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(toISODate(new Date()));
  const [subdivisionMode, setSubdivisionMode] = useState<SubdivisionMode>('none');
  const [monthIndex, setMonthIndex] = useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectMonth = (mIdx: number | undefined) => {
    setMonthIndex(mIdx);
    if (mIdx !== undefined) {
      const year = new Date().getFullYear();
      const currentMonthName = MONTH_NAMES_ES[mIdx];
      // Si el nombre está vacío o empieza con un mes, sugerir el nombre nuevo
      if (!name.trim() || MONTH_NAMES_ES.some((m) => name.toLowerCase().includes(m.toLowerCase()))) {
        setName(`${currentMonthName} ${year}`);
      }
      if (!selectedPeriodId) {
        setStartDate(toISODate(new Date(year, mIdx, 1)));
        setEndDate(toISODate(new Date(year, mIdx + 1, 0)));
      }
    }
  };

  const startCreateNew = () => {
    setIsEditing(true);
    setSelectedPeriodId(null);
    const now = new Date();
    const currentM = now.getMonth();
    setMonthIndex(currentM);
    setName(`${MONTH_NAMES_ES[currentM]} ${now.getFullYear()}`);
    setStartDate(toISODate(new Date(now.getFullYear(), currentM, 1)));
    setEndDate(toISODate(new Date(now.getFullYear(), currentM + 1, 0)));
    setSubdivisionMode('none');
    setErrorMsg(null);
  };

  const startEdit = (p: FinancialPeriod) => {
    setIsEditing(true);
    setSelectedPeriodId(p.id);
    setName(p.name);
    setStartDate(p.startDate);
    setEndDate(p.endDate);
    setSubdivisionMode(p.subdivisionMode);
    setMonthIndex(p.monthIndex);
    setErrorMsg(null);
  };

  // Preview generated subperiods for the form
  const subperiodsPreview = useMemo(() => {
    if (subdivisionMode === 'none' || !startDate || !endDate || startDate > endDate) {
      return [];
    }
    return generateSubperiods(startDate, endDate, subdivisionMode);
  }, [startDate, endDate, subdivisionMode]);

  const handleSave = () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('El período requiere un nombre descriptivo.');
      return;
    }

    const validation = validateFinancialPeriod(
      {
        name: name.trim(),
        startDate,
        endDate,
        subdivisionMode,
        monthIndex,
      },
      periods,
      selectedPeriodId || undefined
    );

    if (!validation.valid) {
      setErrorMsg(validation.error || 'Período no válido o se sobrepone con otro.');
      return;
    }

    try {
      const refMonth = monthIndex !== undefined ? monthIndex + 1 : undefined;
      if (selectedPeriodId) {
        updatePeriod(selectedPeriodId, {
          name: name.trim(),
          startDate,
          endDate,
          subdivisionMode,
          monthIndex,
          referenceMonth: refMonth,
        });
      } else {
        createPeriod({
          name: name.trim(),
          startDate,
          endDate,
          subdivisionMode,
          monthIndex,
          referenceMonth: refMonth,
        });
      }
      setIsEditing(false);
      setSelectedPeriodId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el período.');
    }
  };

  const handleDelete = (id: string) => {
    const periodTxs = transactions.filter((t) => t.periodId === id);
    if (periodTxs.length > 0) {
      if (
        !confirm(
          `Este período contiene ${periodTxs.length} transacción(es). Al eliminarlo quedarán desasociadas. ¿Deseas continuar?`
        )
      ) {
        return;
      }
    }
    deletePeriod(id);
    if (selectedPeriodId === id) {
      setIsEditing(false);
      setSelectedPeriodId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#131927] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* HEADER */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            <h2 className="font-display font-bold text-base">
              Períodos Financieros
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isEditing ? (
            <>
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Ciclos configurados ({periods.length})
                </span>
                <button
                  type="button"
                  onClick={startCreateNew}
                  className="px-3 py-1.5 rounded-xl bg-[#10B981] text-[#002113] font-display text-xs font-bold flex items-center gap-1.5 hover:opacity-95 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo período</span>
                </button>
              </div>

              {periods.length === 0 ? (
                <div className={`p-6 text-center rounded-2xl border border-dashed ${
                  isDark ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-500'
                }`}>
                  <Calendar className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <p className="font-medium text-xs">No hay períodos definidos</p>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    Crea tu primer período financiero para organizar tus presupuestos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {periods.map((p) => {
                    const isActive = activePeriod?.id === p.id;
                    const periodTxs = transactions.filter((t) => t.periodId === p.id);

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isActive
                            ? isDark
                              ? 'bg-emerald-500/10 border-emerald-500/40'
                              : 'bg-emerald-50 border-emerald-300 shadow-xs'
                            : isDark
                            ? 'bg-black/20 border-white/10'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.name}</span>
                              {p.monthIndex !== undefined && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                                  isDark ? 'bg-sky-500/15 text-sky-400 border-sky-500/20' : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}>
                                  {MONTH_NAMES_ES[p.monthIndex]} (Panorama)
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                  p.status === 'active' || p.status === 'in_progress'
                                    ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'closed'
                                    ? isDark ? 'bg-slate-500/15 text-slate-400' : 'bg-slate-200 text-slate-700'
                                    : isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {p.status === 'active' || p.status === 'in_progress'
                                  ? 'En curso'
                                  : p.status === 'closed'
                                  ? 'Cerrado'
                                  : 'Futuro'}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              {formatPeriodRangeES(p.startDate, p.endDate)}
                            </p>
                            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                              {periodTxs.length} transacciones registradas
                              {p.subdivisionMode !== 'none' &&
                                ` · Subdivisión ${p.subdivisionMode}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => selectActivePeriod(p.id)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                                  isDark
                                    ? 'bg-white/5 hover:bg-white/10 text-emerald-400 border-white/10'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                Activar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              aria-label="Editar período"
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                isDark
                                  ? 'text-slate-400 hover:text-white hover:bg-white/10'
                                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              aria-label="Eliminar período"
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3.5">
              <div className={`flex items-center justify-between pb-1 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedPeriodId ? 'Editar período' : 'Crear nuevo período'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`text-xs cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 font-medium'}`}
                >
                  Volver a la lista
                </button>
              </div>

              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Mes en el Panorama Anual (Dropdown de sincronización)
                </label>
                <select
                  value={monthIndex !== undefined ? monthIndex : ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                    handleSelectMonth(val);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="">Seleccionar mes correspondiente...</option>
                  {MONTH_NAMES_ES.map((mName, idx) => (
                    <option key={idx} value={idx}>
                      {mName} (Columna {idx + 1} del Panorama Anual)
                    </option>
                  ))}
                </select>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Vincula este período directamente a la columna de ese mes en el Panorama de Presupuesto.
                </p>
              </div>

              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Nombre del período
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Octubre 2026, Quincena Octubre 1, etc."
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Fecha de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Subdivisión de período
                </label>
                <select
                  value={subdivisionMode}
                  onChange={(e) => setSubdivisionMode(e.target.value as SubdivisionMode)}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="none">Sin subdivisión (Período único)</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal (15 días)</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              {subperiodsPreview.length > 0 && (
                <div className={`p-3 rounded-xl border space-y-1.5 ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Subperíodos autogenerados ({subperiodsPreview.length}):
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {subperiodsPreview.map((sub) => (
                      <div
                        key={sub.id}
                        className={`text-[11px] flex justify-between ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                      >
                        <span>{sub.name}</span>
                        <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {sub.startDate} → {sub.endDate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold cursor-pointer ${
                    isDark
                      ? 'border-white/10 hover:bg-white/5 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-2 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-xs font-bold cursor-pointer"
                >
                  {selectedPeriodId ? 'Actualizar período' : 'Crear período'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
