import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpDown,
  ArrowUpRight,
  Filter,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { PeriodSelectorBar } from '../../core/widgets/PeriodSelectorBar';
import { Transaction, TransactionType } from '../../core/types/models';
import { formatGTQ, formatShortDateES } from '../../core/utils/formatters';

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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'amount_desc'>('date_desc');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterSubperiodId, setFilterSubperiodId] = useState('');

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

    // Search term in note or category name
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const matchNote = t.note ? t.note.toLowerCase().includes(q) : false;
        const matchCat = cat ? cat.name.toLowerCase().includes(q) : false;
        return matchNote || matchCat;
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
    searchTerm,
    sortOrder,
    categories,
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

  const hasActiveFilters =
    filterType !== 'all' ||
    filterAccountId !== 'all' ||
    filterCategoryId !== 'all' ||
    searchTerm.trim().length > 0;

  const resetFilters = () => {
    setFilterType('all');
    setFilterAccountId('all');
    setFilterCategoryId('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* PERIOD SELECTOR BAR */}
      <PeriodSelectorBar onOpenPeriodsModal={onOpenPeriodsModal} />

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
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {activePeriod?.name || 'Período activo'}
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilterMode('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              periodFilterMode === 'all'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({transactions.length})
          </button>
        </div>

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

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] uppercase tracking-wide text-slate-400">
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
        <label className="text-[10px] uppercase tracking-wide text-slate-400">
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
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
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
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
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
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : isDark
                ? 'border-white/10 text-slate-400 hover:text-white'
                : 'border-slate-200 text-slate-600 hover:text-slate-900'
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

        {/* EXPANDABLE FILTER ROW */}
        {isFilterPanelOpen && (
          <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
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
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
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
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
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

            {hasActiveFilters && (
              <div className="sm:col-span-3 flex justify-end pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-rose-400 hover:underline cursor-pointer"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TRANSACTIONS LIST GROUPED BY DATE */}
      {displayedTransactions.length === 0 ? (
        <div
          className={`p-10 text-center rounded-3xl border ${
            isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <ReceiptText className="w-10 h-10 mx-auto mb-2 text-slate-500" />
          <h3 className="font-bold text-sm">Sin transacciones</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
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
        <div className="space-y-4">
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
                <div className="px-4 py-2.5 bg-white/5 border-b border-white/5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">
                    {formatShortDateES(dateKey)}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    {dayTotalIncome > 0 && (
                      <span className="text-emerald-400 font-semibold">
                        +{formatGTQ(dayTotalIncome)}
                      </span>
                    )}
                    {dayTotalExpense > 0 && (
                      <span className="text-rose-400 font-semibold">
                        -{formatGTQ(dayTotalExpense)}
                      </span>
                    )}
                  </div>
                </div>

                {/* TRANSACTIONS UNDER THIS DATE */}
                <div className="divide-y divide-white/5">
                  {txList.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.categoryId);
                    const sub = cat?.subcategories.find((s) => s.id === tx.subcategoryId);
                    const acc = accounts.find((a) => a.id === tx.accountId);
                    const originAcc = accounts.find((a) => a.id === (tx.originAccountId || tx.accountId));
                    const destAcc = accounts.find((a) => a.id === tx.destinationAccountId);

                    return (
                      <div
                        key={tx.id}
                        onClick={() => onEditTransaction(tx)}
                        className="p-3 sm:px-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              tx.type === 'income'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : tx.type === 'transfer'
                                ? 'bg-sky-500/15 text-sky-400'
                                : 'bg-rose-500/15 text-rose-400'
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

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">
                                {tx.type === 'transfer'
                                  ? 'Transferencia'
                                  : cat?.name || 'Sin categoría'}
                              </span>
                              {tx.isCreditCardPayment && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 font-semibold">
                                  Pago Tarjeta
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {tx.type === 'transfer' ? (
                                <span>
                                  {originAcc?.name} (−{formatGTQ(tx.amount)}) → {destAcc?.name} (+{formatGTQ(tx.amount)})
                                </span>
                              ) : (
                                <span>
                                  {sub?.name ? `${sub.name} · ` : ''}
                                  {acc?.name}
                                </span>
                              )}
                              {tx.note && ` — "${tx.note}"`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-mono text-xs font-bold block ${
                              tx.type === 'income'
                                ? 'text-emerald-400'
                                : tx.type === 'transfer'
                                ? 'text-sky-400'
                                : 'text-rose-400'
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
    </div>
  );
};
