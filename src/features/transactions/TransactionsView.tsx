import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  CheckSquare,
  Filter,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Square,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { PeriodSelectorBar } from '../../core/widgets/PeriodSelectorBar';
import { Transaction, TransactionType } from '../../core/types/models';
import { formatGTQ, formatShortDateES } from '../../core/utils/formatters';
import { AccountStatementModal } from './AccountStatementModal';
import { BulkTagModal } from './BulkTagModal';

interface TransactionsViewProps {
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenPeriodsModal: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
  onOpenPeriodsModal,
}) => {
  const {
    activePeriod,
    periods,
    setActivePeriodId,
    transactions,
    accounts,
    categories,
    tags,
    settings,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const hideBalances = settings.hideBalances;

  // Filter & Search state
  const [periodFilterMode, setPeriodFilterMode] = useState<'period' | 'all'>('period');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterTagId, setFilterTagId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'amount_desc'>('date_desc');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterSubperiodId, setFilterSubperiodId] = useState('');
  const [isAccountStatementOpen, setIsAccountStatementOpen] = useState(false);

  // Multi-select & Bulk operations state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [bulkSuccessNotice, setBulkSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    setFilterSubperiodId('');
  }, [activePeriod?.id]);

  // Active period vs all transactions
  const periodTransactions = useMemo(() => {
    if (periodFilterMode === 'all' || !activePeriod) {
      return transactions;
    }
    let scoped = transactions.filter(
      (t) =>
        t.periodId === activePeriod.id ||
        (t.date >= activePeriod.startDate && t.date <= activePeriod.endDate)
    );
    if (filterSubperiodId) {
      const subperiod = activePeriod.subperiods.find((item) => item.id === filterSubperiodId);
      scoped = scoped.filter((t) => t.subperiodId === filterSubperiodId ||
        (!t.subperiodId && subperiod && t.date >= subperiod.startDate && t.date <= subperiod.endDate));
    }
    return scoped;
  }, [transactions, activePeriod, periodFilterMode, filterSubperiodId]);

  // Filtered & Sorted
  const displayedTransactions = useMemo(() => {
    let list = [...periodTransactions];

    // Filter by type
    if (filterType !== 'all') {
      list = list.filter((t) => t.type === filterType);
    }

    // Filter by account
    if (filterAccountId !== 'all') {
      list = list.filter(
        (t) => t.accountId === filterAccountId || t.originAccountId === filterAccountId || t.destinationAccountId === filterAccountId
      );
    }

    // Filter by category
    if (filterCategoryId !== 'all') {
      list = list.filter((t) => t.categoryId === filterCategoryId);
    }

    // Filter by tag
    if (filterTagId !== 'all') {
      list = list.filter((t) => t.tagIds?.includes(filterTagId));
    }

    // Search term in note, category name, or tag name
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const matchNote = t.note ? t.note.toLowerCase().includes(q) : false;
        const matchCat = cat ? cat.name.toLowerCase().includes(q) : false;
        const matchTag = t.tagIds?.some((tid) => {
          const tag = tags.find((tg) => tg.id === tid);
          return tag ? tag.name.toLowerCase().includes(q) : false;
        });
        return matchNote || matchCat || matchTag;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortOrder === 'date_desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortOrder === 'date_asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        return b.amount - a.amount;
      }
    });

    return list;
  }, [
    periodTransactions,
    filterType,
    filterAccountId,
    filterCategoryId,
    filterTagId,
    searchTerm,
    sortOrder,
    categories,
    tags,
  ]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of displayedTransactions) {
      const key = tx.date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [displayedTransactions]);

  const filteredTotals = useMemo(
    () => displayedTransactions.reduce((totals, transaction) => {
      if (transaction.type === 'income') totals.income += transaction.amount;
      if (transaction.type === 'expense') totals.expense += transaction.amount;
      return totals;
    }, { income: 0, expense: 0 }),
    [displayedTransactions]
  );
  const filteredNet = filteredTotals.income - filteredTotals.expense;

  const hasActiveFilters =
    filterType !== 'all' ||
    filterAccountId !== 'all' ||
    filterCategoryId !== 'all' ||
    filterTagId !== 'all' ||
    searchTerm.trim().length > 0;

  const resetFilters = () => {
    setFilterType('all');
    setFilterAccountId('all');
    setFilterCategoryId('all');
    setFilterTagId('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* PERIOD SELECTOR BAR */}
      <PeriodSelectorBar onOpenPeriodsModal={onOpenPeriodsModal} compact />

      {/* SCOPE TOGGLE: Active Period vs All Transactions */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div
          className={`p-1 rounded-xl border flex items-center gap-1 ${
            isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setPeriodFilterMode('period')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              periodFilterMode === 'period'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {activePeriod?.name || 'Período activo'}
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilterMode('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              periodFilterMode === 'all'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({transactions.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode((prev) => {
                const next = !prev;
                if (!next) setSelectedTxIds(new Set());
                return next;
              });
            }}
            title={isSelectionMode ? 'Cancelar selección múltiple' : 'Selección múltiple de registros'}
            aria-label={isSelectionMode ? 'Cancelar selección múltiple' : 'Selección múltiple de registros'}
            className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
              isSelectionMode
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                : isDark
                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-sky-500" />
            <span className="sm:hidden">{isSelectionMode ? 'Cancelar' : 'Seleccionar'}</span>
            <span className="hidden sm:inline">{isSelectionMode ? 'Cancelar' : 'Selección múltiple'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAccountStatementOpen(true)}
            title="Exportar o imprimir estado de cuenta"
            aria-label="Exportar o imprimir estado de cuenta"
            className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
              isDark
                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ReceiptText className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Estado de Cuenta</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewTransaction}
            title="Nueva transacción"
            aria-label="Nueva transacción"
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs border border-emerald-400/30 group"
          >
            <Plus className="w-4 h-4 stroke-[2.75] transition-transform duration-200 group-hover:rotate-90" />
          </button>
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-2 gap-2">
        <label className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Período
          <select
            value={periodFilterMode === 'all' ? 'all' : activePeriod?.id || ''}
            onChange={(e) => {
              if (e.target.value === 'all') setPeriodFilterMode('all');
              else {
                setActivePeriodId(e.target.value);
                setPeriodFilterMode('period');
              }
            }}
            className={`mt-1 w-full p-2 rounded-xl border text-xs normal-case tracking-normal ${isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            <option value="all">Todos los períodos</option>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
          </select>
        </label>
        <label className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Subperíodo
          <select
            value={filterSubperiodId}
            disabled={periodFilterMode === 'all' || !activePeriod}
            onChange={(e) => setFilterSubperiodId(e.target.value)}
            className={`mt-1 w-full p-2 rounded-xl border text-xs normal-case tracking-normal disabled:opacity-50 ${isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            <option value="">Todos los subperíodos</option>
            {activePeriod?.subperiods.map((subperiod) => <option key={subperiod.id} value={subperiod.id}>{subperiod.name}</option>)}
          </select>
        </label>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div
        className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nota o concepto..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                isDark
                  ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`absolute right-2.5 top-2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              hasActiveFilters || isFilterPanelOpen
                ? isDark
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : isDark
                ? 'border-white/10 text-slate-400 hover:text-white'
                : 'border-slate-200 text-slate-600 hover:text-slate-900 bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-medium">Filtros</span>
          </button>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className={`p-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer ${
              isDark
                ? 'bg-black/30 border-white/10 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="date_desc">Más recientes</option>
            <option value="date_asc">Más antiguas</option>
            <option value="amount_desc">Mayor monto</option>
          </select>
        </div>

        {/* QUICK TAG FILTER CHIPS */}
        {tags.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
            <span className={`text-[10px] font-bold uppercase shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Etiqueta:
            </span>
            <button
              type="button"
              onClick={() => setFilterTagId('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                filterTagId === 'all'
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/30 font-bold'
                  : isDark
                  ? 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            {tags.map((t) => {
              const isSelected = filterTagId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterTagId(isSelected ? 'all' : t.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? 'shadow-xs font-bold'
                      : isDark
                      ? 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${t.color}25`,
                          borderColor: `${t.color}50`,
                          color: t.color,
                        }
                      : undefined
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* EXPANDABLE FILTER ROW */}
        {isFilterPanelOpen && (
          <div className={`pt-2 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <div className="sm:hidden">
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Período
              </label>
              <select
                value={periodFilterMode === 'all' ? 'all' : activePeriod?.id || ''}
                onChange={(e) => {
                  if (e.target.value === 'all') setPeriodFilterMode('all');
                  else {
                    setActivePeriodId(e.target.value);
                    setPeriodFilterMode('period');
                  }
                }}
                className={`w-full p-2 rounded-xl border text-xs ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              >
                <option value="all">Todos los períodos</option>
                {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
              </select>
            </div>

            <div className="sm:hidden">
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Subperíodo
              </label>
              <select
                value={filterSubperiodId}
                disabled={periodFilterMode === 'all' || !activePeriod}
                onChange={(e) => setFilterSubperiodId(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs disabled:opacity-50 ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              >
                <option value="">Todos los subperíodos</option>
                {activePeriod?.subperiods.map((subperiod) => <option key={subperiod.id} value={subperiod.id}>{subperiod.name}</option>)}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Tipo
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">Todos los tipos</option>
                <option value="expense">Solo Gastos</option>
                <option value="income">Solo Ingresos</option>
                <option value="transfer">Solo Transferencias</option>
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Cuenta
              </label>
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">Todas las cuentas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Categoría
              </label>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Etiqueta
              </label>
              <select
                value={filterTagId}
                onChange={(e) => setFilterTagId(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">Todas las etiquetas</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-rose-500 hover:underline cursor-pointer font-medium"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BULK SUCCESS BANNER */}
      {bulkSuccessNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{bulkSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setBulkSuccessNotice(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SELECTION MODE TOOLBAR */}
      {isSelectionMode && (
        <div
          className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
            isDark ? 'bg-sky-500/10 border-sky-500/25 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckSquare className="w-4 h-4 text-sky-500 shrink-0" />
            <span>
              <strong>{selectedTxIds.size}</strong> de {displayedTransactions.length} seleccionados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (selectedTxIds.size === displayedTransactions.length) {
                  setSelectedTxIds(new Set());
                } else {
                  setSelectedTxIds(new Set(displayedTransactions.map((t) => t.id)));
                }
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors cursor-pointer"
            >
              {selectedTxIds.size === displayedTransactions.length
                ? 'Deseleccionar'
                : 'Seleccionar visibles'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedTxIds(new Set());
              }}
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
              }`}
              title="Salir del modo selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FILTERED RESULTS SUMMARY */}
      <div
        className={`px-4 py-3 rounded-2xl border ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Resumen de resultados filtrados
          </p>
          <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {displayedTransactions.length} registro{displayedTransactions.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {([
            { label: 'Ingresos', amount: filteredTotals.income, color: isDark ? 'text-emerald-400' : 'text-emerald-700' },
            { label: 'Egresos', amount: filteredTotals.expense, color: isDark ? 'text-rose-400' : 'text-rose-700' },
            { label: 'Neto', amount: filteredNet, color: filteredNet >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : (isDark ? 'text-rose-400' : 'text-rose-700') },
          ]).map((item) => (
            <div key={item.label} className={`min-w-0 rounded-xl px-2.5 py-2 ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
              <p className={`font-mono text-xs sm:text-sm font-bold truncate ${item.color}`}>
                {hideBalances ? '••••' : formatGTQ(item.amount)}
              </p>
            </div>
          ))}
        </div>
        <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Las transferencias no se incluyen en estos importes.
        </p>
      </div>

      {/* TRANSACTIONS LIST GROUPED BY DATE */}
      {displayedTransactions.length === 0 ? (
        <div
          className={`p-10 text-center rounded-3xl border ${
            isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <ReceiptText className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Sin transacciones</h3>
          <p className={`text-xs mt-1 max-w-xs mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {hasActiveFilters
              ? 'No hay transacciones que coincidan con los filtros seleccionados.'
              : 'No hay transacciones registradas en este período financiero.'}
          </p>
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="mt-4 px-4 py-2 rounded-xl bg-[#10B981] text-[#002113] font-display text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar transacción</span>
          </button>
        </div>
      ) : (
        <div className="max-h-[42dvh] sm:max-h-[55dvh] overflow-y-auto overscroll-contain space-y-4 pr-1">
          {groupedByDate.map(([dateKey, txList]) => {
            const dayTotalExpense = txList
              .filter((t) => t.type === 'expense')
              .reduce((s, t) => s + t.amount, 0);

            const dayTotalIncome = txList
              .filter((t) => t.type === 'income')
              .reduce((s, t) => s + t.amount, 0);

            return (
              <div
                key={dateKey}
                className={`rounded-3xl border overflow-hidden transition-all ${
                  isDark
                    ? 'bg-[#131927] border-white/10'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                {/* DATE GROUP HEADER */}
                <div
                  className={`px-4 py-2.5 border-b flex items-center justify-between text-xs ${
                    isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {formatShortDateES(dateKey)}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    {dayTotalIncome > 0 && (
                      <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        +{formatGTQ(dayTotalIncome)}
                      </span>
                    )}
                    {dayTotalExpense > 0 && (
                      <span className={`font-semibold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                        -{formatGTQ(dayTotalExpense)}
                      </span>
                    )}
                  </div>
                </div>

                {/* TRANSACTIONS UNDER THIS DATE */}
                <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                  {txList.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.categoryId);
                    const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
                    const acc = accounts.find((a) => a.id === tx.accountId);
                    const originAcc = accounts.find((a) => a.id === (tx.originAccountId || tx.accountId));
                    const destAcc = accounts.find((a) => a.id === tx.destinationAccountId);
                    const isSelected = selectedTxIds.has(tx.id);

                    const handleItemClick = () => {
                      if (isSelectionMode) {
                        setSelectedTxIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(tx.id)) next.delete(tx.id);
                          else next.add(tx.id);
                          return next;
                        });
                      } else {
                        onEditTransaction(tx);
                      }
                    };

                    return (
                      <div
                        key={tx.id}
                        onClick={handleItemClick}
                        className={`p-3 sm:px-4 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-sky-500/15 hover:bg-sky-500/20'
                              : 'bg-sky-50/90 hover:bg-sky-100/80'
                            : isDark
                            ? 'hover:bg-white/5'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                          {/* CHECKBOX IN SELECTION MODE */}
                          {isSelectionMode && (
                            <div className="shrink-0">
                              <div
                                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-sky-600 border-sky-600 text-white'
                                    : isDark
                                    ? 'border-white/20 bg-black/20'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                              </div>
                            </div>
                          )}

                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              tx.type === 'income'
                                ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                : tx.type === 'transfer'
                                ? isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-50 text-sky-600'
                                : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {tx.type === 'income' ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : tx.type === 'transfer' ? (
                              <ArrowRightLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {tx.type === 'transfer'
                                  ? cat?.name
                                    ? `${cat.name} (Transferencia)`
                                    : 'Transferencia'
                                  : cat?.name || 'Sin categoría'}
                              </span>
                              {tx.isCreditCardPayment && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                  isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-700'
                                }`}>
                                  Pago Tarjeta
                                </span>
                              )}
                            </div>

                            {tx.type === 'transfer' && (
                              <p className={`text-[11px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Sale −{formatGTQ(tx.amount)} → Entra +{formatGTQ(tx.amount)}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {tx.type === 'transfer' ? (
                                <>
                                  {originAcc && <AccountBadge account={originAcc} />}
                                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
                                  {destAcc && <AccountBadge account={destAcc} />}
                                </>
                              ) : acc && (
                                <>
                                  {sub?.name && <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub.name} ·</span>}
                                  <AccountBadge account={acc} />
                                </>
                              )}
                              {tx.note && <span className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— "{tx.note}"</span>}
                            </div>
                            <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              Registrada {formatRecordedAt(tx.createdAt)}
                            </p>

                            {/* TAGS BADGES */}
                            {tx.tagIds && tx.tagIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {tx.tagIds.map((tid) => {
                                  const tObj = tags.find((item) => item.id === tid);
                                  if (!tObj) return null;
                                  return (
                                    <span
                                      key={tid}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border"
                                      style={{
                                        backgroundColor: `${tObj.color}15`,
                                        borderColor: `${tObj.color}35`,
                                        color: tObj.color,
                                      }}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: tObj.color }}
                                      />
                                      <span>{tObj.name}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono text-xs font-bold block ${
                              tx.type === 'income'
                                ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                : tx.type === 'transfer'
                                ? isDark ? 'text-sky-400' : 'text-sky-600'
                                : isDark ? 'text-rose-400' : 'text-rose-600'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                            {hideBalances ? '••••' : formatGTQ(tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FLOATING BULK ACTIONS BOTTOM BAR */}
      {isSelectionMode && selectedTxIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-md p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#111726]/95 backdrop-blur-md border border-white/20 shadow-2xl text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-extrabold flex items-center justify-center">
              {selectedTxIds.size}
            </span>
            <span className="text-xs font-semibold">
              seleccionado{selectedTxIds.size === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkTagModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <TagIcon className="w-3.5 h-3.5" />
              <span>Asignar Etiquetas</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTxIds(new Set())}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Limpiar selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN MASIVA */}
      <BulkTagModal
        isOpen={isBulkTagModalOpen}
        onClose={() => setIsBulkTagModalOpen(false)}
        selectedTransactionIds={Array.from(selectedTxIds)}
        onSuccess={(updatedCount) => {
          setBulkSuccessNotice(`Se actualizaron las etiquetas de ${updatedCount} registro${updatedCount === 1 ? '' : 's'}.`);
          setSelectedTxIds(new Set());
          setIsSelectionMode(false);
        }}
      />

      {/* ESTADO DE CUENTA MODAL */}
      <AccountStatementModal
        isOpen={isAccountStatementOpen}
        onClose={() => setIsAccountStatementOpen(false)}
      />
    </div>
  );
};

const formatRecordedAt = (value?: string) => {
  if (!value) return 'sin fecha de registro disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sin fecha de registro disponible';
  return date.toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const AccountBadge: React.FC<{ account: { name: string; color?: string } }> = ({ account }) => {
  const color = account.color || '#10B981';
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border"
      style={{ backgroundColor: `${color}15`, borderColor: `${color}35`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate">{account.name}</span>
    </span>
  );
};
