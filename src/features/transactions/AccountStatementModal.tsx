import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Landmark,
  Printer,
  ReceiptText,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { formatDateSlash, formatGTQ, formatShortDateES } from '../../core/utils/formatters';
import {
  buildAccountStatementData,
  exportStatementToCSV,
} from './accountStatementEngine';

export interface AccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccountId?: string;
}

export const AccountStatementModal: React.FC<AccountStatementModalProps> = ({
  isOpen,
  onClose,
  initialAccountId = 'all',
}) => {
  const {
    currentUser,
    accounts,
    categories,
    periods,
    activePeriod,
    transactions,
    settings,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const hideBalances = settings.hideBalances;

  // Selected period, subperiod and account filter
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(activePeriod?.id || '');
  const [selectedSubperiodId, setSelectedSubperiodId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Keep selected period in sync with activePeriod if not set
  const currentPeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId) || activePeriod || periods[0];
  }, [periods, selectedPeriodId, activePeriod]);

  // Reset subperiod if period changes
  const handlePeriodChange = (newPeriodId: string) => {
    setSelectedPeriodId(newPeriodId);
    setSelectedSubperiodId('');
  };

  // Generate statement data
  const statementData = useMemo(() => {
    if (!currentPeriod) return null;
    return buildAccountStatementData({
      period: currentPeriod,
      subperiodId: selectedSubperiodId || undefined,
      accountIdFilter: selectedAccountId,
      accounts,
      transactions,
      categories,
      userDisplayName: currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuario Wallet',
    });
  }, [
    currentPeriod,
    selectedSubperiodId,
    selectedAccountId,
    accounts,
    transactions,
    categories,
    currentUser,
  ]);

  // Filtered transactions inside statement preview based on search term
  const displayedStatementRows = useMemo(() => {
    if (!statementData) return [];
    if (!searchTerm.trim()) return statementData.transactions;

    const term = searchTerm.toLowerCase();
    return statementData.transactions.filter((row) => {
      return (
        row.note.toLowerCase().includes(term) ||
        row.categoryName.toLowerCase().includes(term) ||
        (row.subcategoryName && row.subcategoryName.toLowerCase().includes(term)) ||
        row.accountName.toLowerCase().includes(term) ||
        (row.destinationAccountName && row.destinationAccountName.toLowerCase().includes(term))
      );
    });
  }, [statementData, searchTerm]);

  if (!isOpen || !statementData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    exportStatementToCSV(statementData);
  };

  const selectedAccountObj = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border transition-all ${
          isDark
            ? 'bg-[#0f1422] border-white/10 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
        }`}
      >
        {/* HEADER BAR (No se imprime) */}
        <div
          className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 no-print ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ReceiptText className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Estado de Cuenta
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {currentPeriod.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rango: {statementData.dateRangeStr} · Moneda: Quetzales (GTQ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
              title="Descargar archivo CSV estructurado"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer active:scale-95"
              title="Imprimir o guardar como PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLES DE FILTRO (No se imprimen) */}
        <div
          className={`p-4 border-b grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 no-print ${
            isDark ? 'border-white/5 bg-[#0a0d17]' : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          {/* Selector de Período */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Período Fiscal
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className={`w-full px-3 py-1.5 rounded-xl text-xs border font-medium outline-hidden transition-all ${
                isDark
                  ? 'bg-[#131927] border-white/10 text-white focus:border-emerald-500'
                  : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatShortDateES(p.startDate)} - {formatShortDateES(p.endDate)})
                </option>
              ))}
            </select>
          </div>

          {/* Subperíodo (si aplica) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Subperíodo / Corte
            </label>
            <select
              value={selectedSubperiodId}
              onChange={(e) => setSelectedSubperiodId(e.target.value)}
              disabled={!currentPeriod.subperiods || currentPeriod.subperiods.length === 0}
              className={`w-full px-3 py-1.5 rounded-xl text-xs border font-medium outline-hidden transition-all disabled:opacity-50 ${
                isDark
                  ? 'bg-[#131927] border-white/10 text-white focus:border-emerald-500'
                  : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
            >
              <option value="">Todo el período completo</option>
              {currentPeriod.subperiods?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatShortDateES(s.startDate)} - {formatShortDateES(s.endDate)})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Cuenta */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Filtrar por Cuenta
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className={`w-full px-3 py-1.5 rounded-xl text-xs border font-medium outline-hidden transition-all ${
                isDark
                  ? 'bg-[#131927] border-white/10 text-white focus:border-emerald-500'
                  : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
            >
              <option value="all">Todas las cuentas consolidadas</option>
              {accounts
                .filter((a) => a.status === 'active')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type === 'credit_card' ? 'Tarjeta' : a.type === 'bank' ? 'Banco' : 'Efectivo'})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* CONTENEDOR DOCUMENTO / ESTADO DE CUENTA (ÁREA IMPRIMIBLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" id="statement-print-area">
          {/* MEMBRETE DEL ESTADO DE CUENTA */}
          <div className="border-b pb-5 mb-6 border-slate-200 dark:border-white/10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    W
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      ESTADO DE CUENTA OFICIAL
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Wallet · Gestión Financiera Personal
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs space-y-0.5 text-slate-600 dark:text-slate-300">
                <p>
                  <strong className="text-slate-900 dark:text-white">Titular:</strong>{' '}
                  {statementData.userDisplayName}
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">Período:</strong>{' '}
                  {statementData.period.name}
                  {statementData.subperiod ? ` (${statementData.subperiod.name})` : ''}
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">Rango de Fechas:</strong>{' '}
                  {statementData.dateRangeStr}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Emitido el: {statementData.generatedAt}
                </p>
              </div>
            </div>
          </div>

          {/* RESUMEN FINANCIERO DEL PERÍODO */}
          <div className="mb-6 print-avoid-break">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              Resumen Global del Período
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Ingresos del Período
                </p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {formatGTQ(statementData.totalIncome, { hide: hideBalances })}
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Gastos del Período
                </p>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                  {formatGTQ(statementData.totalExpense, { hide: hideBalances })}
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Balance Neto del Período
                </p>
                <p
                  className={`text-base font-bold mt-1 tabular-nums ${
                    statementData.netResult >= 0
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {formatGTQ(statementData.netResult, { showSign: true, hide: hideBalances })}
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Total Movimientos
                </p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
                  {statementData.transactions.length} registros
                </p>
              </div>
            </div>
          </div>

          {/* TABLA RESUMEN POR CUENTA */}
          <div className="mb-8 print-avoid-break">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                Resumen Consolidado por Cuenta
              </h3>
              {selectedAccountId !== 'all' && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  Filtrado por: {selectedAccountObj?.name}
                </span>
              )}
            </div>

            <div
              className={`rounded-xl border overflow-x-auto ${
                isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'
              }`}
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <th className="py-2.5 px-3 font-semibold">Cuenta</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-indigo-600 dark:text-indigo-400">
                      Saldo Actual (en Vivo)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Saldo Inicial Período</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-emerald-600 dark:text-emerald-400">
                      Entradas (+)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right text-rose-600 dark:text-rose-400">
                      Salidas (-)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Flujo Neto</th>
                    <th className="py-2.5 px-3 font-semibold text-right font-bold">Saldo Final Período</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Límite / Deuda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {statementData.accountSummaries.map((item) => {
                    const isCredit = item.account.type === 'credit_card';
                    return (
                      <tr
                        key={item.account.id}
                        className={isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/70'}
                      >
                        <td className="py-2.5 px-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.account.color }}
                            />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {item.account.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {isCredit
                                  ? 'Tarjeta de Crédito'
                                  : item.account.type === 'bank'
                                  ? 'Banco'
                                  : item.account.type === 'cash'
                                  ? 'Efectivo'
                                  : 'Ahorro'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                          {formatGTQ(item.currentBalance, { hide: hideBalances })}
                        </td>

                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {formatGTQ(item.startingBalance, { hide: hideBalances })}
                        </td>

                        <td className="py-2.5 px-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                          +{formatGTQ(item.totalIncome + item.totalTransfersIn, { hide: hideBalances })}
                        </td>

                        <td className="py-2.5 px-3 text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">
                          -{formatGTQ(item.totalExpense + item.totalTransfersOut, { hide: hideBalances })}
                        </td>

                        <td
                          className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                            item.netMovement >= 0
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {formatGTQ(item.netMovement, { showSign: true, hide: hideBalances })}
                        </td>

                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatGTQ(item.endingBalance, { hide: hideBalances })}
                        </td>

                        <td className="py-2.5 px-3 text-right tabular-nums text-[11px] text-slate-500">
                          {isCredit ? (
                            <div>
                              <span>Deuda: {formatGTQ(item.debt || 0, { hide: hideBalances })}</span>
                              <br />
                              <span className="text-[10px] text-slate-400">
                                Disp: {formatGTQ(item.availableCredit || 0, { hide: hideBalances })}
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETALLE CRONOLÓGICO DE TRANSACCIONES */}
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ReceiptText className="w-3.5 h-3.5 text-teal-500" />
                Detalle Cronológico de Transacciones ({displayedStatementRows.length})
              </h3>

              {/* Barra de búsqueda rápida (No se imprime) */}
              <div className="relative w-full sm:w-64 no-print">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar en el estado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border outline-hidden transition-all ${
                    isDark
                      ? 'bg-[#131927] border-white/10 text-white placeholder-slate-500 focus:border-teal-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                  }`}
                />
              </div>
            </div>

            {displayedStatementRows.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border rounded-xl border-dashed border-slate-200 dark:border-white/10">
                No hay transacciones registradas para los filtros seleccionados en este período.
              </div>
            ) : (
              <div
                className={`rounded-xl border overflow-x-auto ${
                  isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'
                }`}
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr
                      className={`border-b ${
                        isDark ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <th className="py-2.5 px-3 font-semibold">Fecha</th>
                      <th className="py-2.5 px-3 font-semibold">Concepto / Categoría</th>
                      <th className="py-2.5 px-3 font-semibold">Cuenta</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Débito (-)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Crédito (+)</th>
                      <th className="py-2.5 px-3 font-semibold text-right font-bold">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {displayedStatementRows.map((row) => {
                      const isExpense = row.type === 'expense';
                      const isIncome = row.type === 'income';
                      const isTransfer = row.type === 'transfer';

                      return (
                        <tr
                          key={row.transaction.id}
                          className={isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/70'}
                        >
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                            {formatDateSlash(row.date)}
                            {row.time ? ` ${row.time}` : ''}
                          </td>

                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {row.categoryName}
                              {row.subcategoryName ? ` · ${row.subcategoryName}` : ''}
                            </p>
                            {row.note && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                {row.note}
                              </p>
                            )}
                          </td>

                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            <div>
                              <span>{row.accountName}</span>
                              {row.destinationAccountName && (
                                <span className="text-[10px] text-slate-400 block">
                                  → {row.destinationAccountName}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-3 text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                            {row.debitAmount !== null
                              ? `-${formatGTQ(row.debitAmount, { hide: hideBalances })}`
                              : '-'}
                          </td>

                          <td className="py-2 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                            {row.creditAmount !== null
                              ? `+${formatGTQ(row.creditAmount, { hide: hideBalances })}`
                              : '-'}
                          </td>

                          <td
                            className={`py-2 px-3 text-right tabular-nums font-bold ${
                              isIncome
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isExpense
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isIncome ? '+' : isExpense ? '-' : ''}
                            {formatGTQ(row.amount, { hide: hideBalances })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PIE DE PÁGINA DEL ESTADO (CERTIFICACIÓN) */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-slate-400">
            <p>Documento generado por Wallet · Finanzas Personales en Quetzales (GTQ)</p>
            <p>Corte al período: {statementData.period.name} · Registros: {statementData.transactions.length}</p>
          </div>
        </div>

        {/* FOOTER BAR DEL MODAL (No se imprime) */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0 no-print ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <p className="text-xs text-slate-500">
            {statementData.transactions.length} transacciones en el período seleccionado.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar a CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDark
                  ? 'border-white/10 hover:bg-white/10 text-slate-300'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
