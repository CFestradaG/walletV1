import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Delete,
  FileText,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { Account, Transaction, TransactionType } from '../../core/types/models';
import { evaluateArithmetic, formatGTQ, toISODate } from '../../core/utils/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  initialType?: TransactionType;
  preselectedAccountId?: string;
  preselectedDestinationCardId?: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  editingTransaction,
  initialType = 'expense',
  preselectedAccountId,
  preselectedDestinationCardId,
}) => {
  const {
    accounts,
    categories,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';

  // Form State
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('0');
  const [accountId, setAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [categoryViewLevel, setCategoryViewLevel] = useState<'categories' | 'subcategories'>('subcategories');
  const [dateStr, setDateStr] = useState<string>(toISODate(new Date()));
  const [note, setNote] = useState<string>('');
  const [isCreditCardPayment, setIsCreditCardPayment] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available categories based on transaction type
  const availableCategories = useMemo(() => {
    return categories.filter(
      (c) => c.type === (type === 'income' ? 'income' : 'expense') && c.isActive
    );
  }, [categories, type]);

  // Selected Category
  const selectedCategory = useMemo(() => {
    return availableCategories.find((c) => c.id === categoryId);
  }, [availableCategories, categoryId]);

  // Subcategories of selected category (s.isActive !== false ensures undefined is treated as active)
  const activeSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    return selectedCategory.subcategories.filter((s) => s.isActive !== false);
  }, [selectedCategory]);

  // Initialize or reset form when modal opens or editingTx changes
  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(String(editingTransaction.amount));
      setAccountId(editingTransaction.accountId || '');
      setDestinationAccountId(editingTransaction.destinationAccountId || '');
      setCategoryId(editingTransaction.categoryId || '');
      setSubcategoryId(editingTransaction.subcategoryId || '');
      setDateStr(editingTransaction.date);
      setNote(editingTransaction.note || '');
      setIsCreditCardPayment(Boolean(editingTransaction.isCreditCardPayment));
      setShowKeypad(false);
      setErrorMsg(null);
    } else {
      const activeAccs = accounts.filter((a) => a.status === 'active');
      const defaultAcc =
        activeAccs.find((a) => a.id === preselectedAccountId) ||
        activeAccs[0] ||
        null;

      setType(initialType);
      setAmountStr('0');
      setAccountId(defaultAcc ? defaultAcc.id : '');
      setDateStr(toISODate(new Date()));
      setNote('');
      setShowKeypad(true);
      setErrorMsg(null);

      if (initialType === 'transfer' && preselectedDestinationCardId) {
        setDestinationAccountId(preselectedDestinationCardId);
        setIsCreditCardPayment(true);
      } else {
        const destAcc = activeAccs.find((a) => a.id !== defaultAcc?.id);
        setDestinationAccountId(destAcc ? destAcc.id : '');
        setIsCreditCardPayment(false);
      }

      // Default category
      const defaultCats = categories.filter(
        (c) => c.type === (initialType === 'income' ? 'income' : 'expense') && c.isActive
      );
      if (defaultCats.length > 0) {
        setCategoryId(defaultCats[0].id);
        const sub = defaultCats[0].subcategories.find((s) => s.isActive !== false);
        setSubcategoryId(sub ? sub.id : '');
      } else {
        setCategoryId('');
        setSubcategoryId('');
      }
    }
  }, [
    isOpen,
    editingTransaction,
    initialType,
    preselectedAccountId,
    preselectedDestinationCardId,
    accounts,
    categories,
  ]);

  // Switch type handler
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setErrorMsg(null);
    if (newType === 'transfer') {
      setCategoryId('');
      setSubcategoryId('');
    } else {
      const filtered = categories.filter(
        (c) => c.type === (newType === 'income' ? 'income' : 'expense') && c.isActive
      );
      if (filtered.length > 0) {
        setCategoryId(filtered[0].id);
        const sub = filtered[0].subcategories.find((s) => s.isActive !== false);
        setSubcategoryId(sub ? sub.id : '');
      }
    }
  };

  // Switch Category handler
  const handleSelectCategory = (catId: string) => {
    setCategoryId(catId);
    const cat = availableCategories.find((c) => c.id === catId);
    if (cat && cat.subcategories.length > 0) {
      const activeSubs = cat.subcategories.filter((s) => s.isActive !== false);
      setSubcategoryId(activeSubs.length > 0 ? activeSubs[0].id : '');
    } else {
      setSubcategoryId('');
    }
    setCategoryViewLevel('subcategories');
  };

  // Return/Up level to categories handler
  const handleGoBackToCategories = () => {
    setCategoryViewLevel('categories');
  };

  // Numeric keypad actions
  const handleKeypadPress = (val: string) => {
    if (amountStr === '0' && val !== '.') {
      setAmountStr(val);
      return;
    }
    // Prevent duplicate decimal point
    if (val === '.') {
      const parts = amountStr.split(/[+\-*/]/);
      const currentSegment = parts[parts.length - 1];
      if (currentSegment.includes('.')) return;
    }
    setAmountStr((prev) => prev + val);
  };

  const handleKeypadDelete = () => {
    if (amountStr.length <= 1) {
      setAmountStr('0');
    } else {
      setAmountStr((prev) => prev.slice(0, -1));
    }
  };

  const handleKeypadClear = () => {
    setAmountStr('0');
  };

  // Evaluate current display amount safely
  const evaluatedAmount = useMemo(() => {
    return evaluateArithmetic(amountStr);
  }, [amountStr]);

  // Submit
  const handleSave = () => {
    setErrorMsg(null);
    const finalAmount = evaluateArithmetic(amountStr);

    if (finalAmount <= 0) {
      setErrorMsg('El monto debe ser un valor numérico positivo mayor a 0.');
      return;
    }

    if (!accountId) {
      setErrorMsg('Debes seleccionar una cuenta de origen.');
      return;
    }

    if (type === 'transfer') {
      if (!destinationAccountId) {
        setErrorMsg('Debes seleccionar una cuenta de destino para la transferencia.');
        return;
      }
      if (accountId === destinationAccountId) {
        setErrorMsg('La cuenta de origen y destino no pueden ser la misma.');
        return;
      }
    } else {
      if (!categoryId) {
        setErrorMsg('Debes seleccionar una categoría.');
        return;
      }
    }

    try {
      if (editingTransaction) {
        const res = updateTransaction(editingTransaction.id, {
          type,
          amount: finalAmount,
          accountId,
          originAccountId: type === 'transfer' ? accountId : undefined,
          destinationAccountId: type === 'transfer' ? destinationAccountId : undefined,
          categoryId: type !== 'transfer' ? categoryId : undefined,
          subcategoryId: type !== 'transfer' ? (subcategoryId || undefined) : undefined,
          date: dateStr,
          note: note.trim(),
          isCreditCardPayment: type === 'transfer' ? isCreditCardPayment : undefined,
        });
        if (!res.valid) {
          setErrorMsg(res.error || 'Error al actualizar la transacción.');
          return;
        }
      } else {
        const res = createTransaction({
          type,
          amount: finalAmount,
          accountId,
          originAccountId: type === 'transfer' ? accountId : undefined,
          destinationAccountId: type === 'transfer' ? destinationAccountId : undefined,
          categoryId: type !== 'transfer' ? categoryId : undefined,
          subcategoryId: type !== 'transfer' ? (subcategoryId || undefined) : undefined,
          date: dateStr,
          note: note.trim(),
          isCreditCardPayment: type === 'transfer' ? isCreditCardPayment : undefined,
        });
        if (!res.valid) {
          setErrorMsg(res.error || 'Error al guardar la transacción.');
          return;
        }
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la transacción.');
    }
  };

  const handleDelete = () => {
    if (!editingTransaction) return;
    deleteTransaction(editingTransaction.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#131927] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-white/5">
          <h2 className="font-display font-bold text-base">
            {editingTransaction ? 'Editar transacción' : 'Nueva transacción'}
          </h2>
          <div className="flex items-center gap-2">
            {editingTransaction && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Eliminar transacción"
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-medium">
              {errorMsg}
            </div>
          )}

          {/* 1. TRANSACTION TYPE SEGMENTED CONTROL */}
          <div
            className={`grid grid-cols-3 p-1 rounded-2xl border ${
              isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-rose-500/20 text-rose-400 shadow-sm border border-rose-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Gasto</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Ingreso</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('transfer')}
              className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'transfer'
                  ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transferencia</span>
            </button>
          </div>

          {/* 2. AMOUNT DISPLAY (Click toggles Keypad) */}
          <div
            onClick={() => setShowKeypad((prev) => !prev)}
            className={`p-3.5 rounded-2xl border text-center cursor-pointer transition-all ${
              isDark
                ? 'bg-black/20 border-white/10 hover:border-emerald-500/40'
                : 'bg-slate-50 border-slate-200 hover:border-emerald-500/40'
            }`}
          >
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Monto ({showKeypad ? 'Teclado activo' : 'Toca para abrir teclado'})
            </span>
            <div className="font-mono text-3xl font-extrabold tracking-tight mt-0.5 text-emerald-400">
              {amountStr.match(/[+\-*/]/)
                ? `${amountStr} = ${formatGTQ(evaluatedAmount)}`
                : formatGTQ(evaluatedAmount)}
            </div>
          </div>

          {/* 3. CATEGORIES & SUBCATEGORIES HIERARCHICAL SELECTOR */}
          {type !== 'transfer' && (
            <div
              className={`p-3 rounded-2xl border transition-all space-y-2 ${
                isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Level 1: CATEGORIES BROWSING VIEW */}
              {categoryViewLevel === 'categories' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-400 px-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Selecciona una Categoría
                    </span>
                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => setCategoryViewLevel('subcategories')}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver subcategorías ({selectedCategory.name})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Categories Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {availableCategories.map((cat) => {
                      const isSelected = cat.id === categoryId;
                      const subsCount = cat.subcategories.filter((s) => s.isActive !== false).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat.id)}
                          className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer text-left ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                              : isDark
                              ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#10B981' }}
                          />
                          <span className="truncate flex-1">{cat.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {subsCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Level 2: SUBCATEGORIES VIEW WITH BACK / UP LEVEL BUTTON */
                <div className="space-y-2.5">
                  {/* Top Bar with the button to go back up to categories */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleGoBackToCategories}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                      title="Volver a subir de nivel en las categorías"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Volver a categorías (Subir nivel)</span>
                    </button>

                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={handleGoBackToCategories}
                        className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                        title="Cambiar categoría"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: selectedCategory.color || '#10B981' }}
                        />
                        <span className="underline decoration-dotted">{selectedCategory.name}</span>
                      </button>
                    )}
                  </div>

                  {/* Horizontal mini-rail for fast category switching */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar py-0.5">
                    {availableCategories.map((cat) => {
                      const isSelected = cat.id === categoryId;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat.id)}
                          className={`h-7 px-2.5 rounded-full border text-[11px] font-medium flex items-center gap-1 shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                              : isDark
                              ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#10B981' }}
                          />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Subcategories list */}
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Subcategorías de {selectedCategory?.name || 'la categoría'}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {/* Default "General / Toda la categoría" option */}
                      <button
                        type="button"
                        onClick={() => setSubcategoryId('')}
                        className={`h-7 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          !subcategoryId
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold shadow-xs'
                            : isDark
                            ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {!subcategoryId && <Check className="w-3 h-3" />}
                        <span>General ({selectedCategory?.name})</span>
                      </button>

                      {/* Explicit subcategories */}
                      {activeSubcategories.map((sub) => {
                        const isSubSelected = sub.id === subcategoryId;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setSubcategoryId(sub.id)}
                            className={`h-7 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                              isSubSelected
                                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold shadow-xs'
                                : isDark
                                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {isSubSelected && <Check className="w-3 h-3" />}
                            {sub.icon && <span className="text-xs">{sub.icon}</span>}
                            <span>{sub.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. ACCOUNTS SELECTION */}
          {type === 'transfer' ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Cuenta origen
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="">Selecciona cuenta origen</option>
                  {accounts
                    .filter((a) => a.status === 'active')
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatGTQ(acc.currentBalance)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Cuenta destino
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="">Selecciona cuenta destino</option>
                  {accounts
                    .filter((a) => a.status === 'active' && a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} {acc.type === 'credit_card' ? '(Tarjeta de Crédito)' : `(${formatGTQ(acc.currentBalance)})`}
                      </option>
                    ))}
                </select>
              </div>

              {/* Credit card payment checkbox toggle */}
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCreditCardPayment}
                  onChange={(e) => setIsCreditCardPayment(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                  Marcar como Pago de Tarjeta de Crédito
                </span>
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Cuenta
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="">Selecciona una cuenta</option>
                {accounts
                  .filter((a) => a.status === 'active')
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatGTQ(acc.currentBalance)})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* 5. DATE & NOTES INLINE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Fecha
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Nota / Descripción
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej. Almuerzo familiar"
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 6. NUMERIC KEYPAD WITH ARITHMETIC */}
          {showKeypad && (
            <div
              className={`p-2 rounded-2xl border ${
                isDark ? 'bg-black/30 border-white/10' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <div className="grid grid-cols-4 gap-1.5 font-mono text-sm">
                {['7', '8', '9', '/'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleKeypadPress(item)}
                    className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      item === '/'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                    }`}
                  >
                    {item === '/' ? '÷' : item}
                  </button>
                ))}

                {['4', '5', '6', '*'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleKeypadPress(item)}
                    className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      item === '*'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                    }`}
                  >
                    {item === '*' ? '×' : item}
                  </button>
                ))}

                {['1', '2', '3', '-'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleKeypadPress(item)}
                    className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      item === '-'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                    }`}
                  >
                    {item}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                      : 'bg-rose-50 text-rose-600 hover:bg-rose-100 shadow-xs'
                  }`}
                >
                  C
                </button>

                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/5 hover:bg-white/10 text-white'
                      : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                  }`}
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={() => handleKeypadPress('.')}
                  className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/5 hover:bg-white/10 text-white'
                      : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                  }`}
                >
                  .
                </button>

                <button
                  type="button"
                  onClick={handleKeypadDelete}
                  aria-label="Borrar último dígito"
                  className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 text-slate-300'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700 shadow-xs'
                  }`}
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-white/5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
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
            className="flex-2 py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-xs font-bold transition-all shadow-md cursor-pointer active:scale-98"
          >
            {editingTransaction ? 'Actualizar' : 'Guardar transacción'}
          </button>
        </div>
      </div>
    </div>
  );
};
