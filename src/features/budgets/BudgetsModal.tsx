import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { Budget } from '../../core/types/models';
import { formatGTQ } from '../../core/utils/formatters';

interface BudgetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetsModal: React.FC<BudgetsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    budgets,
    activePeriod,
    categories,
    createBudget,
    updateBudget,
    deleteBudget,
    transactions,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';

  const [isEditing, setIsEditing] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  // Form State
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expense categories
  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense' && c.isActive);
  }, [categories]);

  // Selected Category's subcategories
  const selectedCat = useMemo(() => {
    return expenseCategories.find((c) => c.id === categoryId);
  }, [expenseCategories, categoryId]);

  // Active period budgets with spent amounts
  const activePeriodBudgets = useMemo(() => {
    if (!activePeriod) return [];
    const periodBudgets = budgets.filter((b) => b.periodId === activePeriod.id);

    return periodBudgets.map((b) => {
      // Calculate spent for this category/subcategory in this period
      const spent = transactions
        .filter(
          (t) =>
            t.periodId === activePeriod.id &&
            t.type === 'expense' &&
            t.categoryId === b.categoryId &&
            (!b.subcategoryId || t.subcategoryId === b.subcategoryId)
        )
        .reduce((acc, t) => acc + t.amount, 0);

      const cat = categories.find((c) => c.id === b.categoryId);
      const sub = cat?.subcategories.find((s) => s.id === b.subcategoryId);

      const budgetLimit = b.targetAmount ?? b.amount ?? 0;
      const pct = budgetLimit > 0 ? Math.min(100, Math.round((spent / budgetLimit) * 100)) : 0;
      const isOver = spent > budgetLimit;

      return {
        ...b,
        categoryName: cat?.name || 'Categoría',
        subcategoryName: sub?.name,
        color: cat?.color || '#10B981',
        spent,
        remaining: Math.max(0, budgetLimit - spent),
        percentage: pct,
        isOver,
        limitAmount: budgetLimit,
      };
    });
  }, [budgets, activePeriod, transactions, categories]);

  const startCreate = () => {
    setIsEditing(true);
    setSelectedBudgetId(null);
    if (expenseCategories.length > 0) {
      setCategoryId(expenseCategories[0].id);
      setSubcategoryId('');
    }
    setAmountStr('');
    setErrorMsg(null);
  };

  const startEdit = (b: Budget) => {
    setIsEditing(true);
    setSelectedBudgetId(b.id);
    setCategoryId(b.categoryId);
    setSubcategoryId(b.subcategoryId || '');
    setAmountStr(String(b.targetAmount ?? b.amount ?? 0));
    setErrorMsg(null);
  };

  const handleSave = () => {
    setErrorMsg(null);
    if (!activePeriod) {
      setErrorMsg('No hay un período activo seleccionado.');
      return;
    }

    if (!categoryId) {
      setErrorMsg('Debes seleccionar una categoría.');
      return;
    }

    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Ingresa un monto presupuestado válido mayor a 0.');
      return;
    }

    try {
      if (selectedBudgetId) {
        updateBudget(selectedBudgetId, {
          categoryId,
          subcategoryId: subcategoryId || undefined,
          amount: numAmount,
        });
      } else {
        createBudget({
          periodId: activePeriod.id,
          categoryId,
          subcategoryId: subcategoryId || undefined,
          amount: numAmount,
        });
      }
      setIsEditing(false);
      setSelectedBudgetId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el presupuesto.');
    }
  };

  const handleDelete = (id: string) => {
    deleteBudget(id);
    if (selectedBudgetId === id) {
      setIsEditing(false);
      setSelectedBudgetId(null);
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <h2 className="font-display font-bold text-base">Presupuestos</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isEditing ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-medium">
                    Presupuestos para{' '}
                    <strong className="text-emerald-400 font-semibold">
                      {activePeriod ? activePeriod.name : 'sin período'}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={startCreate}
                  disabled={!activePeriod}
                  className="px-3 py-1.5 rounded-xl bg-[#10B981] text-[#002113] font-display text-xs font-bold flex items-center gap-1.5 hover:opacity-95 cursor-pointer shadow-xs disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo presupuesto</span>
                </button>
              </div>

              {activePeriodBudgets.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-slate-400">
                  <Target className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                  <p className="font-medium text-xs">No hay presupuestos para este período</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Asigna un límite de gasto a tus categorías para controlar tus finanzas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePeriodBudgets.map((b) => (
                    <div
                      key={b.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: b.color }}
                          />
                          <span className="font-bold text-xs">{b.categoryName}</span>
                          {b.subcategoryName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              {b.subcategoryName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(b)}
                            aria-label="Editar presupuesto"
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            aria-label="Eliminar presupuesto"
                            className="p-1 rounded-md text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            b.isOver
                              ? 'bg-rose-500'
                              : b.percentage > 85
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${b.percentage}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Gastado: <strong className="text-white font-mono">{formatGTQ(b.spent)}</strong>
                        </span>
                        <span>
                          Límite: <strong className="text-white font-mono">{formatGTQ(b.limitAmount)}</strong>
                        </span>
                      </div>
                      {b.isOver && (
                        <p className="text-[10px] text-rose-400 font-semibold mt-1">
                          ¡Presupuesto superado por {formatGTQ(b.spent - b.limitAmount)}!
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-white/5">
                <span className="font-bold text-xs">
                  {selectedBudgetId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Volver a la lista
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Categoría
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId('');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCat && selectedCat.subcategories.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Subcategoría (Opcional)
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="">Toda la categoría</option>
                    {selectedCat.subcategories
                      .filter((s) => s.isActive !== false)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Monto límite asignado (GTQ)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="Ej. 1500.00"
                  className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

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
                  {selectedBudgetId ? 'Actualizar presupuesto' : 'Crear presupuesto'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
