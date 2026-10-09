import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  ReceiptText,
  Search,
  X,
} from 'lucide-react';
import { useWallet } from '../state/WalletContext';
import { Transaction } from '../types/models';
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

  // Reset search when modal opens/changes target
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, target?.title]);

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

  // Sort and filter transactions
  const sortedAndFilteredTransactions = useMemo(() => {
    if (!target) return [];
    let list = [...target.transactions].sort((a, b) => {
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
        return (
          (tx.note && tx.note.toLowerCase().includes(query)) ||
          (cat && cat.name.toLowerCase().includes(query)) ||
          (sub && sub.name.toLowerCase().includes(query)) ||
          (acc && acc.name.toLowerCase().includes(query)) ||
          tx.date.includes(query) ||
          tx.amount.toString().includes(query)
        );
      });
    }

    return list;
  }, [target, searchTerm, categories, accounts]);

  if (!isOpen || !target) return null;

  const hasBudget = target.budgetAmount !== undefined;
  const budget = target.budgetAmount || 0;
  const actual = target.totalAmount;
  const diff = budget - actual;
  const pct = target.pct ?? (budget > 0 ? Math.round((actual / budget) * 100) : 0);
  const isOver = target.isOverBudget ?? (actual > budget && budget > 0);
  const isNear = target.isNearLimit ?? (pct >= 80 && pct <= 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drilldown-modal-title"
    >
      <div
        className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-4 sm:zoom-in-95 ${
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
              }}
            >
              <span>{target.icon || '🏷️'}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="drilldown-modal-title" className="font-display font-bold text-base truncate">
                  {target.title}
                </h2>
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

        {/* SUMMARY CARD */}
        <div className="p-4 shrink-0 space-y-3">
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
                    {target.transactions.length} registro{target.transactions.length !== 1 ? 's' : ''}
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

          {/* Optional search if there are more than 4 items */}
          {target.transactions.length > 4 && (
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nota, cuenta o fecha..."
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
          )}
        </div>

        {/* TRANSACTIONS LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 min-h-[140px]">
          <div className="flex items-center justify-between pb-1 px-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Detalle de transacciones ({sortedAndFilteredTransactions.length})
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
                  : target.emptyMessage || 'No hay transacciones registradas para este rubro en este período.'}
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

                const isTransfer = tx.type === 'transfer';
                const isIncome = tx.type === 'income';

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
                          isIncome
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : isTransfer
                            ? 'bg-sky-500/15 text-sky-500'
                            : 'bg-rose-500/15 text-rose-500'
                        }`}
                      >
                        {isIncome ? (
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
                            {tx.note || sub?.name || cat?.name || 'Gasto'}
                          </span>
                          {sub && sub.name !== target.title && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {sub.name}
                            </span>
                          )}
                        </div>

                        <div className={`text-[10px] flex items-center gap-1.5 mt-0.5 truncate ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <span className="font-medium">{formatShortDateES(tx.date, true)}</span>
                          {acc && (
                            <>
                              <span>•</span>
                              <span className="truncate">{acc.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-mono text-xs sm:text-sm font-bold block ${
                        isIncome ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {isIncome ? '+' : '-'}{formatGTQ(tx.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
              <span>Ver en historial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{formatGTQ(actual)}</strong>
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
