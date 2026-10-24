import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Landmark,
  PiggyBank,
  PieChart,
  ReceiptText,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useWallet } from '../state/WalletContext';
import { AccountType, Transaction } from '../types/models';
import { formatGTQ, formatShortDateES } from '../utils/formatters';

export interface DrilldownTarget {
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  totalAmount: number;
  budgetAmount?: number;
  pct?: number;
  isOverBudget?: boolean;
  isNearLimit?: boolean;
  transactions: Transaction[];
  emptyMessage?: string;
  // Category-specific details
  categoryId?: string;
  // Account-specific details
  accountId?: string;
  accountType?: AccountType;
  creditCardInfo?: {
    debt: number;
    creditLimit: number;
    availableCredit: number;
    utilization: number;
    cutoffDay?: number;
    paymentDueDay?: number;
  };
  liquidAccountInfo?: {
    currentBalance: number;
  };
  // Period filter tabs support
  allTransactions?: Transaction[];
  periodTransactions?: Transaction[];
  periodName?: string;
}

interface DrilldownTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: DrilldownTarget | null;
  onSelectTransaction?: (tx: Transaction) => void;
  onNavigateToTransactions?: () => void;
}

export const DrilldownTransactionsModal: React.FC<DrilldownTransactionsModalProps> = ({
  isOpen,
  onClose,
  target,
  onSelectTransaction,
  onNavigateToTransactions,
}) => {
  const { categories, accounts, resolvedTheme } = useWallet();
  const isDark = resolvedTheme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScope, setFilterScope] = useState<'period' | 'all'>('period');
  const [activeTab, setActiveTab] = useState<'transactions' | 'subcategories'>('transactions');
  const [selectedSubFilter, setSelectedSubFilter] = useState<string | null>(null);
  const [hoveredSubId, setHoveredSubId] = useState<string | null>(null);

  // Reset search and tab scope when modal opens/changes target
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setFilterScope('period');
      setActiveTab('transactions');
      setSelectedSubFilter(null);
      setHoveredSubId(null);
    }
  }, [isOpen, target?.title, target?.accountId]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const accentColor = target?.color || '#10B981';

  const hasPeriodTabs = Boolean(target?.periodTransactions && target?.allTransactions);

  // Determine current active transaction list according to selected tab
  const activeTransactionsList = useMemo(() => {
    if (!target) return [];
    if (hasPeriodTabs) {
      return filterScope === 'period'
        ? (target.periodTransactions || [])
        : (target.allTransactions || []);
    }
    return target.transactions;
  }, [target, hasPeriodTabs, filterScope]);

  const isCategoryDrilldown = Boolean(
    target &&
      !target.accountId &&
      !target.accountType &&
      !target.creditCardInfo &&
      !target.liquidAccountInfo
  );

  const matchingCategory = useMemo(() => {
    if (!target) return undefined;
    if (target.categoryId) {
      return categories.find((c) => c.id === target.categoryId);
    }
    const byName = categories.find((c) => c.name.toLowerCase() === target.title.toLowerCase());
    if (byName) return byName;
    const catIds = new Set(target.transactions.map((t) => t.categoryId).filter(Boolean));
    if (catIds.size === 1) {
      const singleId = Array.from(catIds)[0];
      return categories.find((c) => c.id === singleId);
    }
    return undefined;
  }, [target, categories]);

  const subcategoriesBreakdown = useMemo(() => {
    if (!target || !isCategoryDrilldown || !activeTransactionsList.length) return [];

    const totalSpent = activeTransactionsList.reduce((acc, tx) => acc + tx.amount, 0);
    if (totalSpent <= 0) return [];

    const subMap = new Map<string, { id: string; name: string; amount: number; count: number }>();

    if (matchingCategory?.subcategories) {
      for (const sub of matchingCategory.subcategories) {
        subMap.set(sub.id, {
          id: sub.id,
          name: sub.name,
          amount: 0,
          count: 0,
        });
      }
    }

    let unassignedAmount = 0;
    let unassignedCount = 0;

    for (const tx of activeTransactionsList) {
      if (tx.subcategoryId && subMap.has(tx.subcategoryId)) {
        const item = subMap.get(tx.subcategoryId)!;
        item.amount += tx.amount;
        item.count += 1;
      } else if (tx.subcategoryId) {
        let name = 'Subcategoría';
        for (const cat of categories) {
          const found = cat.subcategories?.find((s) => s.id === tx.subcategoryId);
          if (found) {
            name = found.name;
            break;
          }
        }
        const item = subMap.get(tx.subcategoryId) || {
          id: tx.subcategoryId,
          name,
          amount: 0,
          count: 0,
        };
        item.amount += tx.amount;
        item.count += 1;
        subMap.set(tx.subcategoryId, item);
      } else {
        unassignedAmount += tx.amount;
        unassignedCount += 1;
      }
    }

    const result = Array.from(subMap.values()).filter((s) => s.amount > 0 || s.count > 0);

    if (unassignedCount > 0) {
      result.push({
        id: '__unassigned__',
        name: 'General / Sin subcategoría',
        amount: unassignedAmount,
        count: unassignedCount,
      });
    }

    result.sort((a, b) => b.amount - a.amount);

    const PALETTE = [
      accentColor,
      '#3B82F6',
      '#8B5CF6',
      '#EC4899',
      '#F59E0B',
      '#10B981',
      '#06B6D4',
      '#F97316',
      '#6366F1',
      '#14B8A6',
      '#84CC16',
    ];

    return result.map((sub, idx) => ({
      ...sub,
      amount: Math.round(sub.amount * 100) / 100,
      pct: totalSpent > 0 ? (sub.amount / totalSpent) * 100 : 0,
      color: sub.id === '__unassigned__' ? '#94A3B8' : PALETTE[idx % PALETTE.length],
    }));
  }, [target, isCategoryDrilldown, activeTransactionsList, matchingCategory, categories, accentColor]);

  const selectedSubName = useMemo(() => {
    if (!selectedSubFilter) return null;
    if (selectedSubFilter === '__unassigned__') return 'General / Sin subcategoría';
    const found = subcategoriesBreakdown.find((s) => s.id === selectedSubFilter);
    return found?.name || 'Subcategoría';
  }, [selectedSubFilter, subcategoriesBreakdown]);

  // Sort and filter transactions
  const sortedAndFilteredTransactions = useMemo(() => {
    if (!target) return [];
    let list = [...activeTransactionsList];

    // Filtro por subcategoría seleccionada
    if (selectedSubFilter) {
      if (selectedSubFilter === '__unassigned__') {
        // "General / Sin subcategoría" solo incluye registros realmente sin ID.
        // No depende de que el catálogo de esta categoría esté disponible o sincronizado.
        list = list.filter((tx) => !tx.subcategoryId);
      } else {
        list = list.filter((tx) => tx.subcategoryId === selectedSubFilter);
      }
    }

    list.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      list = list.filter((tx) => {
        const cat = categories.find((c) => c.id === tx.categoryId);
        const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
        const acc = accounts.find((a) => a.id === tx.accountId);
        const originAcc = accounts.find((a) => a.id === tx.originAccountId);
        const destAcc = accounts.find((a) => a.id === tx.destinationAccountId);

        return (
          (tx.note && tx.note.toLowerCase().includes(query)) ||
          (cat && cat.name.toLowerCase().includes(query)) ||
          (sub && sub.name.toLowerCase().includes(query)) ||
          (acc && acc.name.toLowerCase().includes(query)) ||
          (originAcc && originAcc.name.toLowerCase().includes(query)) ||
          (destAcc && destAcc.name.toLowerCase().includes(query)) ||
          tx.date.includes(query) ||
          tx.amount.toString().includes(query)
        );
      });
    }

    return list;
  }, [target, activeTransactionsList, selectedSubFilter, matchingCategory, searchTerm, categories, accounts]);

  if (!isOpen || !target) return null;

  const hasBudget = target.budgetAmount !== undefined;
  const budget = target.budgetAmount || 0;
  const actual = target.totalAmount;
  const diff = budget - actual;
  const pct = target.pct ?? (budget > 0 ? Math.round((actual / budget) * 100) : 0);
  const isOver = target.isOverBudget ?? (actual > budget && budget > 0);
  const isNear = target.isNearLimit ?? (pct >= 80 && pct <= 100);

  // Helper icon for account
  const renderAccountIcon = () => {
    if (target.accountType === 'credit_card') return <CreditCard className="w-5 h-5" />;
    if (target.accountType === 'bank') return <Landmark className="w-5 h-5" />;
    if (target.accountType === 'savings') return <PiggyBank className="w-5 h-5" />;
    if (target.accountType === 'cash') return <Banknote className="w-5 h-5" />;
    if (target.icon && target.icon.length > 2) return <Wallet className="w-5 h-5" />;
    return <span>{target.icon || '🏷️'}</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drilldown-modal-title"
    >
      <div
        className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-4 sm:zoom-in-95 ${
          isDark
            ? 'bg-[#131927] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        style={{
          boxShadow: `0 20px 45px -12px ${accentColor}35`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP ACCENT STRIPE */}
        <div
          className="h-1.5 w-full shrink-0 transition-colors"
          style={{ backgroundColor: accentColor }}
        />

        {/* HEADER */}
        <div className={`flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 border"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}35`,
                color: accentColor,
              }}
            >
              {renderAccountIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="drilldown-modal-title" className="font-display font-bold text-base truncate">
                  {target.title}
                </h2>
                {target.accountType && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold border capitalize shrink-0"
                    style={{
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}30`,
                      color: accentColor,
                    }}
                  >
                    {target.accountType === 'credit_card'
                      ? 'Tarjeta de Crédito'
                      : target.accountType === 'bank'
                      ? 'Banco'
                      : target.accountType === 'cash'
                      ? 'Efectivo'
                      : 'Ahorro'}
                  </span>
                )}
              </div>
              {target.subtitle && (
                <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {target.subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SUMMARY / STATS CARD */}
        <div className="p-4 shrink-0 space-y-3">
          {target.creditCardInfo ? (
            /* CREDIT CARD SUMMARY */
            <div
              className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                isDark ? 'bg-black/25 border-white/5' : 'bg-slate-50 border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Deuda Actual
                  </span>
                  <span className="font-mono text-base sm:text-lg font-extrabold text-rose-500 block">
                    {formatGTQ(target.creditCardInfo.debt)}
                  </span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Disponible
                  </span>
                  <span className="font-mono text-base sm:text-lg font-bold text-emerald-500 block">
                    {formatGTQ(target.creditCardInfo.availableCredit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Límite Total
                  </span>
                  <span className={`font-mono text-sm sm:text-base font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {formatGTQ(target.creditCardInfo.creditLimit)}
                  </span>
                </div>
              </div>

              {/* Utilization progress bar */}
              <div className="pt-1.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Utilización de línea:</span>
                  <span className={`font-mono font-bold ${
                    target.creditCardInfo.utilization > 80
                      ? 'text-rose-500'
                      : target.creditCardInfo.utilization > 50
                      ? 'text-amber-500'
                      : 'text-sky-500'
                  }`}>
                    {target.creditCardInfo.utilization}%
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      target.creditCardInfo.utilization > 80
                        ? 'bg-rose-500'
                        : target.creditCardInfo.utilization > 50
                        ? 'bg-amber-400'
                        : 'bg-sky-500'
                    }`}
                    style={{ width: `${Math.min(100, target.creditCardInfo.utilization)}%` }}
                  />
                </div>
              </div>

              {/* Dates */}
              {(target.creditCardInfo.cutoffDay || target.creditCardInfo.paymentDueDay) && (
                <div className={`pt-2 border-t flex items-center justify-between text-[10.5px] border-dashed ${
                  isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}>
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    <span>Corte: Día {target.creditCardInfo.cutoffDay || 15}</span>
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-sky-500" />
                    <span>Pago: Día {target.creditCardInfo.paymentDueDay || 5}</span>
                  </span>
                </div>
              )}
            </div>
          ) : target.liquidAccountInfo ? (
            /* LIQUID ACCOUNT SUMMARY */
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                isDark ? 'bg-black/25 border-white/5' : 'bg-slate-50 border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Saldo Disponible Actual
                  </span>
                  <span className="font-mono text-xl sm:text-2xl font-extrabold block" style={{ color: accentColor }}>
                    {formatGTQ(target.liquidAccountInfo.currentBalance)}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Movimientos en vista
                  </span>
                  <span className={`font-mono text-sm sm:text-base font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {activeTransactionsList.length} registro{activeTransactionsList.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* GENERAL / CATEGORY SUMMARY */
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                isDark ? 'bg-black/25 border-white/5' : 'bg-slate-50 border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {hasBudget ? 'Gasto Ejecutado' : 'Total del Rubro'}
                  </span>
                  <span className="font-mono text-lg sm:text-xl font-bold block" style={{ color: accentColor }}>
                    {formatGTQ(actual)}
                  </span>
                </div>

                {hasBudget ? (
                  <div className="text-right">
                    <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Presupuesto
                    </span>
                    <span className={`font-mono text-sm sm:text-base font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {formatGTQ(budget)}
                    </span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Movimientos
                    </span>
                    <span className={`font-mono text-sm font-semibold block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {activeTransactionsList.length} registro{activeTransactionsList.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Budget comparison indicator */}
              {hasBudget && (
                <div className="mt-2.5 pt-2.5 border-t space-y-2 border-dashed border-white/10 dark:border-white/10 border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {isOver ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Sobregiro de {formatGTQ(Math.abs(diff))}</span>
                        </span>
                      ) : isNear ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Cerca del límite (restan {formatGTQ(diff)})</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Disponible: {formatGTQ(diff)}</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        isOver
                          ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                          : isNear
                          ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                      }`}
                    >
                      {pct}% del presupuesto
                    </span>
                  </div>

                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOver ? 'bg-rose-500' : isNear ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              )}

              {!hasBudget && target.pct !== undefined && target.pct > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-white/10 dark:border-white/10 border-slate-200 flex items-center justify-between text-xs">
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Participación en el gasto total:
                  </span>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    {target.pct}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* PERIOD VS ALL HISTORY TABS (WHEN AVAILABLE) */}
          {hasPeriodTabs && (
            <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs transition-colors ${
              isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setFilterScope('period')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer text-center text-[11px] ${
                  filterScope === 'period'
                    ? isDark
                      ? 'bg-white/15 text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>{target.periodName || 'Período actual'}</span>
                <span className="ml-1 opacity-75 font-mono">({target.periodTransactions?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('all')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer text-center text-[11px] ${
                  filterScope === 'all'
                    ? isDark
                      ? 'bg-white/15 text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Todo el historial</span>
                <span className="ml-1 opacity-75 font-mono">({target.allTransactions?.length || 0})</span>
              </button>
            </div>
          )}

          {/* CATEGORY VIEW TABS (MOVIMIENTOS VS DISTRIBUCIÓN SUBCATEGORÍAS) */}
          {isCategoryDrilldown && subcategoriesBreakdown.length > 0 && (
            <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs transition-colors ${
              isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px] ${
                  activeTab === 'transactions'
                    ? isDark
                      ? 'bg-white/15 text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5" />
                <span>Movimientos</span>
                <span className="opacity-75 font-mono">({activeTransactionsList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subcategories')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px] ${
                  activeTab === 'subcategories'
                    ? isDark
                      ? 'bg-white/15 text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                <span>Subcategorías</span>
                <span className="opacity-75 font-mono">({subcategoriesBreakdown.length})</span>
              </button>
            </div>
          )}

          {/* SEARCH INPUT (ONLY IN TRANSACTIONS TAB) */}
          {activeTab === 'transactions' && (activeTransactionsList.length > 3 || selectedSubFilter) && (
            <div className="space-y-2">
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nota, categoría, fecha o cuenta..."
                  className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs focus:outline-hidden transition-colors ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500'
                  }`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* FILTER CHIP FOR SELECTED SUBCATEGORY */}
              {selectedSubFilter && (
                <div className={`p-2 px-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <div className="flex items-center gap-1.5 truncate">
                    <PieChart className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">
                      Filtrando por subcategoría: <strong>{selectedSubName}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSubFilter(null)}
                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer shrink-0 ml-2"
                  >
                    Quitar filtro
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BODY: SUBCATEGORIES DONUT CHART VIEW OR TRANSACTIONS LIST VIEW */}
        {activeTab === 'subcategories' ? (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 min-h-[220px]">
            {/* SVG DONUT CHART CARD */}
            <div
              className={`p-4 rounded-2xl border flex flex-col items-center justify-center relative ${
                isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
                {(() => {
                  const R = 70;
                  const C = 2 * Math.PI * R; // ~439.82
                  let accum = 0;
                  const hoveredItem = hoveredSubId
                    ? subcategoriesBreakdown.find((s) => s.id === hoveredSubId)
                    : null;
                  const totalSpent = subcategoriesBreakdown.reduce((sum, s) => sum + s.amount, 0);

                  return (
                    <>
                      <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                        {/* Background Ring */}
                        <circle
                          cx="100"
                          cy="100"
                          r={R}
                          fill="none"
                          stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                          strokeWidth="24"
                        />
                        {/* Slices */}
                        {subcategoriesBreakdown.map((item) => {
                          const sliceLength = (item.pct / 100) * C;
                          const strokeDasharray = `${Math.max(0, sliceLength - (subcategoriesBreakdown.length > 1 ? 2.5 : 0))} ${C}`;
                          const strokeDashoffset = -accum;
                          accum += sliceLength;
                          const isHovered = hoveredSubId === item.id;

                          return (
                            <circle
                              key={item.id}
                              cx="100"
                              cy="100"
                              r={R}
                              fill="none"
                              stroke={item.color}
                              strokeWidth={isHovered ? 28 : 24}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="cursor-pointer transition-all duration-200"
                              style={{
                                opacity: hoveredSubId ? (isHovered ? 1 : 0.45) : 1,
                              }}
                              onMouseEnter={() => setHoveredSubId(item.id)}
                              onMouseLeave={() => setHoveredSubId(null)}
                              onClick={() => {
                                setSelectedSubFilter(item.id);
                                setActiveTab('transactions');
                              }}
                            />
                          );
                        })}
                      </svg>

                      {/* Center Info Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                        {hoveredItem ? (
                          <>
                            <p className="text-[10px] uppercase font-bold text-slate-400 truncate max-w-[120px]">
                              {hoveredItem.name}
                            </p>
                            <p className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
                              {formatGTQ(hoveredItem.amount)}
                            </p>
                            <p
                              className="text-xs font-bold mt-0.5"
                              style={{ color: hoveredItem.color }}
                            >
                              {hoveredItem.pct.toFixed(1)}% · {hoveredItem.count} mov.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                              Total Categoría
                            </p>
                            <p className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
                              {formatGTQ(totalSpent)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {subcategoriesBreakdown.length} subcategoría{subcategoriesBreakdown.length !== 1 ? 's' : ''}
                            </p>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                Toca una porción o subcategoría para ver sus movimientos
              </p>
            </div>

            {/* SUBCATEGORIES BREAKDOWN LIST */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Desglose de Subcategorías
                </span>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {subcategoriesBreakdown.length} registradas
                </span>
              </div>

              <div className="space-y-1.5">
                {subcategoriesBreakdown.map((sub) => {
                  const isHovered = hoveredSubId === sub.id;
                  return (
                    <div
                      key={sub.id}
                      onMouseEnter={() => setHoveredSubId(sub.id)}
                      onMouseLeave={() => setHoveredSubId(null)}
                      onClick={() => {
                        setSelectedSubFilter(sub.id);
                        setActiveTab('transactions');
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                        isHovered
                          ? isDark
                            ? 'bg-white/10 border-white/20 shadow-md'
                            : 'bg-slate-50 border-slate-300 shadow-md'
                          : isDark
                          ? 'bg-black/20 border-white/5 hover:border-white/10'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: sub.color }}
                          />
                          <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                            {sub.name}
                          </span>
                          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            ({sub.count} mov.)
                          </span>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {formatGTQ(sub.amount)}
                          </span>
                          <span
                            className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${sub.color}18`,
                              color: sub.color,
                            }}
                          >
                            {sub.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(2, sub.pct))}%`,
                            backgroundColor: sub.color,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-end mt-1.5 pt-1 border-t border-dashed border-black/5 dark:border-white/5">
                        <span className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Ver movimientos</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* TRANSACTIONS LIST CONTAINER */
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 min-h-[140px]">
            <div className="flex items-center justify-between pb-1 px-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Movimientos ({sortedAndFilteredTransactions.length})
              </span>
              {onSelectTransaction && sortedAndFilteredTransactions.length > 0 && (
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Toca una fila para editarla
              </span>
            )}
          </div>

          {sortedAndFilteredTransactions.length === 0 ? (
            <div className={`py-10 text-center text-xs rounded-2xl border border-dashed p-6 ${
              isDark ? 'border-white/10 text-slate-400 bg-white/2' : 'border-slate-200 text-slate-500 bg-slate-50/50'
            }`}>
              <ReceiptText className={`w-8 h-8 mx-auto mb-2 opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <p className="font-medium">
                {searchTerm
                  ? 'No se encontraron transacciones que coincidan con la búsqueda.'
                  : filterScope === 'period' && hasPeriodTabs
                  ? `No hay movimientos en ${target.periodName || 'el período actual'}. Puedes ver 'Todo el historial' arriba.`
                  : target.emptyMessage || 'No hay transacciones registradas para este rubro.'}
              </p>
            </div>
          ) : (
            <div className={`divide-y rounded-2xl border overflow-hidden ${
              isDark ? 'bg-black/20 border-white/5 divide-white/5' : 'bg-white border-slate-200 divide-slate-100 shadow-2xs'
            }`}>
              {sortedAndFilteredTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
                const acc = accounts.find((a) => a.id === tx.accountId);
                const originAcc = accounts.find((a) => a.id === tx.originAccountId);
                const destAcc = accounts.find((a) => a.id === tx.destinationAccountId);

                const isTransfer = tx.type === 'transfer';
                const isIncome = tx.type === 'income';

                // Determine whether this transaction acts as inflow or outflow for target account
                let isAccountInflow = isIncome;
                let counterpartyDescription: string | null = null;

                if (isTransfer) {
                  if (target.accountId && tx.destinationAccountId === target.accountId) {
                    isAccountInflow = true;
                    counterpartyDescription = `Desde: ${originAcc?.name || 'Otra cuenta'}`;
                  } else if (target.accountId && tx.originAccountId === target.accountId) {
                    isAccountInflow = false;
                    counterpartyDescription = `Hacia: ${destAcc?.name || 'Otra cuenta'}`;
                  } else {
                    // Default transfer perspective
                    counterpartyDescription = `${originAcc?.name || 'Cuenta'} → ${destAcc?.name || 'Cuenta'}`;
                  }
                }

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      if (onSelectTransaction) {
                        onClose();
                        onSelectTransaction(tx);
                      }
                    }}
                    className={`py-3 px-3.5 flex items-center justify-between transition-colors ${
                      onSelectTransaction ? 'cursor-pointer hover:bg-emerald-500/5 active:bg-emerald-500/10' : ''
                    } ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isAccountInflow
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : isTransfer
                            ? 'bg-sky-500/15 text-sky-500'
                            : 'bg-rose-500/15 text-rose-500'
                        }`}
                      >
                        {isAccountInflow ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : isTransfer ? (
                          <ArrowRightLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-xs truncate max-w-[200px] sm:max-w-[260px] ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}>
                            {tx.note || (isTransfer ? (tx.isCreditCardPayment ? 'Pago de tarjeta' : 'Transferencia') : sub?.name || cat?.name || 'Movimiento')}
                          </span>
                          {sub && sub.name !== target.title && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {sub.name}
                            </span>
                          )}
                          {isTransfer && tx.isCreditCardPayment && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-sky-500/15 text-sky-500 border border-sky-500/25">
                              Pago Tarjeta
                            </span>
                          )}
                        </div>

                        <div className={`text-[10px] flex items-center gap-1.5 mt-0.5 truncate ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <span className="font-medium">{formatShortDateES(tx.date, true)}</span>
                          {counterpartyDescription ? (
                            <>
                              <span>•</span>
                              <span className="truncate text-sky-600 dark:text-sky-400 font-medium">
                                {counterpartyDescription}
                              </span>
                            </>
                          ) : acc && !target.accountId ? (
                            <>
                              <span>•</span>
                              <span className="truncate">{acc.name}</span>
                            </>
                          ) : cat ? (
                            <>
                              <span>•</span>
                              <span className="truncate">{cat.name}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-mono text-xs sm:text-sm font-bold block ${
                        isAccountInflow ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {isAccountInflow ? '+' : '-'}{formatGTQ(tx.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL FOOTER */}
        <div className={`p-3.5 px-5 border-t shrink-0 flex items-center justify-between gap-3 ${
          isDark ? 'border-white/5 bg-[#0B0F17]/50' : 'border-slate-100 bg-slate-50'
        }`}>
          {onNavigateToTransactions ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToTransactions();
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver en historial completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Registros en vista: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{sortedAndFilteredTransactions.length}</strong>
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/15 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
