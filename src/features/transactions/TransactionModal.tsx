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
import { AccountSelectDropdown } from '../../core/widgets/AccountSelectDropdown';

function getContrastTextColor(hexColor?: string): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#FFFFFF';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 155 ? '#0B0F17' : '#FFFFFF';
}

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
  const [isBrowsingCategories, setIsBrowsingCategories] = useState<boolean>(false);
  const [dateStr, setDateStr] = useState<string>(toISODate(new Date()));
  const [note, setNote] = useState<string>('');
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

  // Active account and dynamic color theme
  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId);
  }, [accounts, accountId]);
  const destinationAccount = useMemo(
    () => accounts.find((a) => a.id === destinationAccountId),
    [accounts, destinationAccountId]
  );
  const isCreditCardDestination = type === 'transfer' && destinationAccount?.type === 'credit_card';

  const activeAccountColor = currentAccount?.color || '#10B981';
  const contrastTextColor = getContrastTextColor(activeAccountColor);

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
      setShowKeypad(false);
      setIsBrowsingCategories(false);
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
      setIsBrowsingCategories(false);
      setErrorMsg(null);

      if (initialType === 'transfer' && preselectedDestinationCardId) {
        setDestinationAccountId(preselectedDestinationCardId);
      } else {
        const destAcc = activeAccs.find((a) => a.id !== defaultAcc?.id);
        setDestinationAccountId(destAcc ? destAcc.id : '');
      }

      // Default category
      if (initialType === 'transfer') {
        const financeCat = categories.find(
          (c) => c.type === 'expense' && c.isActive && /finanz|pago|tarjeta|deuda/i.test(c.name)
        );
        if (financeCat) {
          setCategoryId(financeCat.id);
          const sub = financeCat.subcategories.find((s) => s.isActive !== false);
          setSubcategoryId(sub ? sub.id : '');
        } else {
          const firstExp = categories.find((c) => c.type === 'expense' && c.isActive);
          setCategoryId(firstExp ? firstExp.id : '');
          const sub = firstExp?.subcategories.find((s) => s.isActive !== false);
          setSubcategoryId(sub ? sub.id : '');
        }
      } else {
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
    setIsBrowsingCategories(false);
    if (newType === 'transfer') {
      const financeCat = categories.find(
        (c) => c.type === 'expense' && c.isActive && /finanz|pago|tarjeta|deuda/i.test(c.name)
      );
      if (financeCat) {
        setCategoryId(financeCat.id);
        const sub = financeCat.subcategories.find((s) => s.isActive !== false);
        setSubcategoryId(sub ? sub.id : '');
      } else {
        const currentExp = categories.find((c) => c.id === categoryId && c.type === 'expense');
        if (!currentExp) {
          const firstExp = categories.find((c) => c.type === 'expense' && c.isActive);
          setCategoryId(firstExp ? firstExp.id : '');
          const sub = firstExp?.subcategories.find((s) => s.isActive !== false);
          setSubcategoryId(sub ? sub.id : '');
        }
      }
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
    setIsBrowsingCategories(false);
  };

  // Numeric keypad actions
  const handleKeypadPress = (val: string) => {
    if (amountStr === '0' && val === '(') {
      setAmountStr('(');
      return;
    }
    if (/^\d$/.test(val) && amountStr === '0') {
      setAmountStr(val);
      return;
    }
    if (val === '.') {
      const parts = amountStr.split(/[+\-*/()]/);
      const currentSegment = parts[parts.length - 1];
      if (currentSegment.includes('.')) return;
    }
    if (/^[+\-*/]$/.test(val) && (!amountStr || /[+\-*/.(]$/.test(amountStr))) return;
    if (val === ')' && (amountStr.match(/\(/g) || []).length <= (amountStr.match(/\)/g) || []).length) return;
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

  const handleAmountChange = (value: string) => {
    const normalized = value.replace(/,/g, '.').replace(/[^0-9+\-*/(). ]/g, '');
    setAmountStr(normalized || '0');
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
          categoryId: categoryId || undefined,
          subcategoryId: subcategoryId || undefined,
          date: dateStr,
          note: note.trim(),
          isCreditCardPayment: isCreditCardDestination,
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
          categoryId: categoryId || undefined,
          subcategoryId: subcategoryId || undefined,
          date: dateStr,
          note: note.trim(),
          isCreditCardPayment: isCreditCardDestination,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-[#131927] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        style={{
          borderColor: currentAccount ? `${activeAccountColor}50` : undefined,
          boxShadow: currentAccount
            ? `0 20px 45px -12px ${activeAccountColor}30`
            : undefined,
        }}
      >
        {/* TOP ACCENT STRIPE OF SELECTED ACCOUNT COLOR */}
        <div
          className="h-1.5 w-full transition-colors duration-300 shrink-0"
          style={{ backgroundColor: activeAccountColor }}
        />

        {/* MODAL HEADER */}
        <div className={`flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="font-display font-bold text-base truncate">
              {editingTransaction ? 'Editar transacción' : 'Nueva transacción'}
            </h2>
            {currentAccount && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all truncate"
                style={{
                  backgroundColor: `${activeAccountColor}18`,
                  borderColor: `${activeAccountColor}40`,
                  color: activeAccountColor,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeAccountColor }}
                />
                <span className="truncate max-w-[130px]">{currentAccount.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editingTransaction && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Eliminar transacción"
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 font-medium">
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
                  ? isDark
                    ? 'bg-rose-500/20 text-rose-400 shadow-sm border border-rose-500/30'
                    : 'bg-white text-rose-600 shadow-sm border border-rose-200 font-extrabold'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/30'
                    : 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-extrabold'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? isDark
                    ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                    : 'bg-white text-sky-700 shadow-sm border border-sky-200 font-extrabold'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transferencia</span>
            </button>
          </div>

          {/* 2. DATE & NOTES INLINE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Fecha
              </label>
              <div className="relative">
                <Calendar className={`w-3.5 h-3.5 absolute left-3 top-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Nota / Descripción
              </label>
              <div className="relative">
                <FileText className={`w-3.5 h-3.5 absolute left-3 top-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej. Almuerzo familiar"
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-2xs'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 3. CATEGORIES & SUBCATEGORIES SINGLE-ROW HIERARCHICAL SELECTOR */}
          <div
            className={`p-3 rounded-2xl border transition-all space-y-2 ${
              isDark ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            {/* Category Breadcrumb & Change button */}
            <div className={`flex items-center justify-between px-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold truncate">
                <span className="uppercase tracking-wider">
                  {type === 'transfer'
                    ? 'Categoría (Panorama):'
                    : isBrowsingCategories
                    ? 'Categoría'
                    : 'Subcategoría'}:
                </span>
                {selectedCategory ? (
                  <span
                    className="font-bold flex items-center gap-1"
                    style={{ color: selectedCategory.color || '#10B981' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: selectedCategory.color || '#10B981' }}
                    />
                    <span>{selectedCategory.name}</span>
                  </span>
                ) : (
                  <span className={`italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {type === 'transfer' ? 'Opcional (ej. Finanzas)' : 'Sin seleccionar'}
                  </span>
                )}
                {!isBrowsingCategories && selectedCategory && (
                  <span className={`truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    › {subcategoryId
                      ? selectedCategory.subcategories.find((s) => s.id === subcategoryId)?.name || 'Personalizada'
                      : `General (${selectedCategory.name})`}
                  </span>
                )}
              </div>

              {!isBrowsingCategories && (
                <button
                  type="button"
                  onClick={() => setIsBrowsingCategories(true)}
                  className={`text-xs font-semibold flex items-center gap-0.5 cursor-pointer shrink-0 ml-2 ${
                    isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  <span>Cambiar</span>
                </button>
              )}
            </div>

              {/* SINGLE COMPACT ROW FOR NAVIGATION */}
              <div className="w-full">
                {isBrowsingCategories ? (
                  /* Browsing Categories in a single horizontal scrollable row */
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap py-0.5">
                    {availableCategories.map((cat) => {
                      const isSelected = cat.id === categoryId;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat.id)}
                          className={`h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                            isSelected
                              ? 'shadow-xs font-bold'
                              : isDark
                              ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: `${cat.color || '#10B981'}25`,
                                  borderColor: `${cat.color || '#10B981'}60`,
                                  color: isDark ? '#ffffff' : cat.color || '#10B981',
                                }
                              : undefined
                          }
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#10B981' }}
                          />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Subcategories row: [Subir on left] + [Horizontal scrollable subcategories in SAME row] */
                  <div className="flex items-center gap-1.5 w-full">
                    {/* Subir button on the left */}
                    <button
                      type="button"
                      onClick={() => setIsBrowsingCategories(true)}
                      title="Subir de nivel para ver todas las categorías"
                      className={`h-8 px-2.5 rounded-full border text-xs font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer active:scale-95 ${
                        isDark
                          ? 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                          : 'bg-slate-200 border-slate-300 text-slate-900 hover:bg-slate-300'
                      }`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Subir</span>
                    </button>

                    {/* Subcategories list in the same single row */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap flex-1 py-0.5">
                      {/* Option: General */}
                      <button
                        type="button"
                        onClick={() => setSubcategoryId('')}
                        className={`h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                          !subcategoryId
                            ? 'shadow-xs font-bold'
                            : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                        style={
                          !subcategoryId && selectedCategory
                            ? {
                                backgroundColor: `${selectedCategory.color || '#10B981'}25`,
                                borderColor: `${selectedCategory.color || '#10B981'}60`,
                                color: isDark ? '#ffffff' : selectedCategory.color || '#10B981',
                              }
                            : undefined
                        }
                      >
                        {!subcategoryId && <Check className="w-3 h-3" />}
                        <span>General</span>
                      </button>

                      {/* Subcategory chips */}
                      {activeSubcategories.map((sub) => {
                        const isSubSelected = sub.id === subcategoryId;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setSubcategoryId(sub.id)}
                            className={`h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                              isSubSelected
                                ? 'shadow-xs font-bold'
                                : isDark
                                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                            style={
                              isSubSelected && selectedCategory
                                ? {
                                    backgroundColor: `${selectedCategory.color || '#10B981'}25`,
                                    borderColor: `${selectedCategory.color || '#10B981'}60`,
                                    color: isDark ? '#ffffff' : selectedCategory.color || '#10B981',
                                  }
                                : undefined
                            }
                          >
                            {isSubSelected && <Check className="w-3 h-3" />}
                            {sub.icon && <span className="text-xs">{sub.icon}</span>}
                            <span>{sub.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

          {/* 4. ACCOUNTS SELECTION */}
          {type === 'transfer' ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Cuenta origen
                </label>
                <AccountSelectDropdown
                  accounts={accounts}
                  value={accountId}
                  onChange={(newId) => setAccountId(newId)}
                  placeholder="Selecciona cuenta origen"
                  isDark={isDark}
                  accentColor={activeAccountColor}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Cuenta destino
                </label>
                <AccountSelectDropdown
                  accounts={accounts}
                  value={destinationAccountId}
                  onChange={(newId) => setDestinationAccountId(newId)}
                  placeholder="Selecciona cuenta destino"
                  excludeId={accountId}
                  isDark={isDark}
                  accentColor={activeAccountColor}
                />
              </div>

              {isCreditCardDestination && (
                <div className={`flex items-start gap-2.5 p-3 rounded-2xl border ${
                  isDark
                    ? 'bg-sky-500/10 border-sky-500/25 text-sky-300'
                    : 'bg-sky-50 border-sky-200 text-sky-800'
                }`}>
                  <CreditCard className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                  <div className="text-xs">
                    <span className="font-bold block">Pago a Tarjeta de Crédito</span>
                    <span className="text-[11px] opacity-90 block mt-0.5">
                      Reduce la deuda de la tarjeta y la salida de efectivo se asigna a la categoría seleccionada (ej. Finanzas) para contabilizarse en el Panorama y Presupuesto Anual.
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Cuenta
              </label>
              <AccountSelectDropdown
                accounts={accounts}
                value={accountId}
                onChange={(newId) => setAccountId(newId)}
                placeholder="Selecciona una cuenta"
                isDark={isDark}
                accentColor={activeAccountColor}
              />
            </div>
          )}

          {/* 5. AMOUNT DISPLAY, ABOVE THE KEYPAD */}
          <div
            className={`p-3.5 rounded-2xl border text-center transition-all ${
              isDark
                ? 'bg-black/20 border-white/10 hover:border-emerald-500/40'
                : 'bg-slate-50 border-slate-200 hover:border-emerald-500/40'
            }`}
            style={{
              borderColor: `${activeAccountColor}40`,
              backgroundColor: `${activeAccountColor}0a`,
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <span className={`text-[10px] uppercase font-mono tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500 font-semibold'}`}>Monto</span>
              <button
                type="button"
                onClick={() => setShowKeypad((prev) => !prev)}
                className={`text-[10px] font-semibold cursor-pointer ${
                  isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                }`}
              >
                {showKeypad ? 'Ocultar teclado' : 'Abrir teclado'}
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Monto de la transacción"
              value={amountStr}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full bg-transparent text-center font-mono text-3xl font-extrabold tracking-tight mt-0.5 focus:outline-none"
              style={{ color: activeAccountColor }}
            />
            <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>Total: {formatGTQ(evaluatedAmount)}</div>
          </div>

          {/* 6. NUMERIC KEYPAD WITH ARITHMETIC */}
          {showKeypad && (
            <div
              className={`p-2 rounded-2xl border ${
                isDark ? 'bg-black/30 border-white/10' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <div className="grid grid-cols-5 gap-1.5 font-mono text-sm">
                {['7', '8', '9', '/', '('].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleKeypadPress(item)}
                    className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      ['/','('].includes(item)
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-xs'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                    }`}
                  >
                    {item === '/' ? '÷' : item}
                  </button>
                ))}

                {['4', '5', '6', '*', ')'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleKeypadPress(item)}
                    className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      ['*', ')'].includes(item)
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-xs'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                    }`}
                  >
                    {item === '*' ? '×' : item}
                  </button>
                ))}

                {['1', '2', '3', '-', '+'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleKeypadPress(item)}
                    className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      ['-', '+'].includes(item)
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-xs'
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
                <button
                  type="button"
                  onClick={() => setAmountStr((prev) => String(evaluateArithmetic(prev)))}
                  className={`h-10 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  }`}
                >
                  =
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className={`p-4 border-t flex items-center gap-3 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
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
            style={{
              backgroundColor: activeAccountColor,
              color: contrastTextColor,
            }}
            className="flex-2 py-3 px-4 rounded-xl font-display text-xs font-bold transition-all shadow-md cursor-pointer active:scale-98 hover:brightness-105"
          >
            {editingTransaction ? 'Actualizar' : 'Guardar transacción'}
          </button>
        </div>
      </div>
    </div>
  );
};
