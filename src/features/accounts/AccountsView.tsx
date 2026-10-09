import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Banknote,
  Calendar,
  Check,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Landmark,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { Account, AccountType, Transaction } from '../../core/types/models';
import { formatGTQ } from '../../core/utils/formatters';
import { getCreditCardTacticalTip } from '../analytics/financialHealthEngine';

interface AccountsViewProps {
  onPayCreditCard: (cardId: string) => void;
  onNewTransactionForAccount: (accId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  onPayCreditCard,
  onNewTransactionForAccount,
}) => {
  const {
    accounts,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleArchiveAccount,
    settings,
    toggleHideBalances,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const hideBalances = settings.hideBalances;

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balanceStr, setBalanceStr] = useState('0');
  const [creditLimitStr, setCreditLimitStr] = useState('0');
  const [cutoffDayStr, setCutoffDayStr] = useState('15');
  const [paymentDueDayStr, setPaymentDueDayStr] = useState('5');
  const [currency, setCurrency] = useState('GTQ');
  const [color, setColor] = useState('#10B981');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter archived
  const [showArchived, setShowArchived] = useState(false);

  // Separated accounts: Liquid vs Credit Cards
  const activeAccounts = accounts.filter((a) =>
    showArchived ? true : a.status === 'active'
  );

  const liquidAccounts = activeAccounts.filter((a) => a.type !== 'credit_card');
  const creditAccounts = activeAccounts.filter((a) => a.type === 'credit_card');

  const totalLiquid = liquidAccounts
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + (a.currentBalance ?? a.balance ?? 0), 0);

  const totalCreditDebt = creditAccounts
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + Math.max(0, -(a.currentBalance ?? a.balance ?? 0)), 0);

  // Subtle tactical credit card advice
  const creditCardTip = useMemo(() => {
    return getCreditCardTacticalTip(accounts);
  }, [accounts]);

  const startCreate = () => {
    setEditingAccount(null);
    setName('');
    setType('bank');
    setBalanceStr('0');
    setCreditLimitStr('5000');
    setCutoffDayStr('15');
    setPaymentDueDayStr('5');
    setCurrency('GTQ');
    setColor('#10B981');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const startEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    const currentBalance = acc.currentBalance ?? acc.balance ?? 0;
    setBalanceStr(String(acc.type === 'credit_card' ? Math.max(0, -currentBalance) : currentBalance));
    setCreditLimitStr(String(acc.creditLimit || 0));
    setCutoffDayStr(String(acc.cutoffDay || 15));
    setPaymentDueDayStr(String(acc.paymentDueDay || 5));
    setCurrency(acc.currency || 'GTQ');
    setColor(acc.color || '#10B981');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Ingresa un nombre para la cuenta.');
      return;
    }

    const numBal = parseFloat(balanceStr) || 0;
    const numLimit = type === 'credit_card' ? parseFloat(creditLimitStr) || 0 : undefined;
    const numCutoff = type === 'credit_card' ? Math.min(31, Math.max(1, parseInt(cutoffDayStr, 10) || 15)) : undefined;
    const numPaymentDue = type === 'credit_card' ? Math.min(31, Math.max(1, parseInt(paymentDueDayStr, 10) || 5)) : undefined;

    try {
      if (editingAccount) {
        const editedBalance = type === 'credit_card' ? -Math.abs(numBal) : numBal;
        const originalInputBalance = editingAccount.type === 'credit_card'
          ? Math.max(0, -(editingAccount.currentBalance ?? editingAccount.balance ?? 0))
          : (editingAccount.currentBalance ?? editingAccount.balance ?? 0);
        updateAccount(editingAccount.id, {
          name: name.trim(),
          creditLimit: numLimit,
          cutoffDay: numCutoff,
          paymentDueDay: numPaymentDue,
          ...(numBal !== originalInputBalance ? { currentBalance: editedBalance } : {}),
          icon: editingAccount.icon || 'Landmark',
          color,
        });
      } else {
        createAccount({
          name: name.trim(),
          type,
          initialBalance: numBal,
          creditLimit: numLimit,
          cutoffDay: numCutoff,
          paymentDueDay: numPaymentDue,
          icon: 'Landmark',
          color,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la cuenta.');
    }
  };

  const toggleArchive = (acc: Account) => {
    toggleArchiveAccount(acc.id);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar esta cuenta definitivamente?')) {
      deleteAccount(id);
      setIsModalOpen(false);
    }
  };

  const getAccountIcon = (t: AccountType) => {
    switch (t) {
      case 'cash':
        return Banknote;
      case 'bank':
        return Landmark;
      case 'savings':
        return PiggyBank;
      case 'credit_card':
        return CreditCard;
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER & TOP TOTALS */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display font-bold text-base">Mis Cuentas</h1>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Administración de liquidez y tarjetas de crédito
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleHideBalances}
              className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                isDark ? 'border-white/10 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={startCreate}
              className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva cuenta</span>
            </button>
          </div>
        </div>

        {/* LIQUIDITY SUMMARY BANNER */}
        <div className={`grid grid-cols-2 gap-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div>
            <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total Líquido
            </span>
            <p className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {hideBalances ? '••••••••' : formatGTQ(totalLiquid)}
            </p>
          </div>

          <div>
            <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Deuda Total Tarjetas
            </span>
            <p className="font-mono text-base font-extrabold text-rose-600 dark:text-rose-400">
              {hideBalances ? '••••••••' : formatGTQ(totalCreditDebt)}
            </p>
          </div>
        </div>
      </div>

      {/* LIQUID ACCOUNTS SECTION */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Cuentas Disponibles ({liquidAccounts.length})
          </span>
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className={`text-[11px] cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
          </button>
        </div>

        {liquidAccounts.length === 0 ? (
          <div className={`p-6 text-center rounded-2xl border border-dashed text-xs ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
            Aún no tienes cuentas disponibles registradas.
          </div>
        ) : (
          <div className="space-y-2">
            {liquidAccounts.map((acc) => {
              const Icon = getAccountIcon(acc.type);
              const isArchived = acc.status === 'archived';

              return (
                <div
                  key={acc.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    isArchived
                      ? isDark
                        ? 'opacity-60 bg-black/10 border-white/5'
                        : 'opacity-60 bg-slate-100 border-slate-200'
                      : isDark
                      ? 'bg-[#131927] border-white/10'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${acc.color || '#10B981'}20` }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{ color: acc.color || '#10B981' }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{acc.name}</span>
                        {isArchived && (
                          <span className="text-[9px] px-1 rounded bg-slate-500/20 text-slate-400 font-mono">
                            Archivada
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {acc.type === 'cash'
                          ? 'Efectivo'
                          : acc.type === 'bank'
                          ? 'Banco'
                          : 'Ahorro'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold block">
                        {hideBalances
                          ? '••••'
                          : formatGTQ(acc.currentBalance ?? acc.balance ?? 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onNewTransactionForAccount(acc.id)}
                        title="Nueva transacción con esta cuenta"
                        className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(acc)}
                        aria-label="Editar cuenta"
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREDIT CARDS SECTION (EXPLICITLY SEPARATED) */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Tarjetas de Crédito ({creditAccounts.length})
          </span>
        </div>

        {creditAccounts.length === 0 ? (
          <div className={`p-6 text-center rounded-2xl border border-dashed text-xs ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
            No tienes tarjetas de crédito configuradas.
          </div>
        ) : (
          <div className="space-y-2.5">
            {creditCardTip && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 transition-all ${
                  creditCardTip.type === 'due_reminder'
                    ? isDark
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                      : 'bg-amber-50/90 border-amber-200 text-amber-900'
                    : isDark
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200'
                    : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                    creditCardTip.type === 'due_reminder'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-indigo-500/20 text-indigo-400'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[11px] block">
                      {creditCardTip.title}
                    </span>
                    {creditCardTip.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold font-mono ${
                          creditCardTip.type === 'due_reminder'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        {creditCardTip.badge}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[10.5px] leading-snug line-clamp-2 mt-0.5 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {creditCardTip.message}
                  </p>
                </div>
              </div>
            )}

            {creditAccounts.map((card) => {
              const debt = Math.max(0, -(card.currentBalance ?? card.balance ?? 0));
              const limit = card.creditLimit || 0;
              const available = Math.max(0, limit - debt);
              const utilization = limit > 0 ? Math.min(100, Math.round((debt / limit) * 100)) : 0;
              const isArchived = card.status === 'archived';

              return (
                <div
                  key={card.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isArchived
                      ? isDark
                        ? 'opacity-60 bg-black/10 border-white/5'
                        : 'opacity-60 bg-slate-100 border-slate-200'
                      : isDark
                      ? 'bg-[#131927] border-white/10'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${card.color || '#F43F5E'}25`,
                          color: card.color || '#F43F5E',
                        }}
                      >
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{card.name}</span>
                          {isArchived && (
                            <span className="text-[9px] px-1 rounded bg-slate-500/20 text-slate-400 font-mono">
                              Archivada
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Límite: {formatGTQ(limit)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPayCreditCard(card.id)}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Pagar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(card)}
                        aria-label="Editar tarjeta"
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Utilization bar */}
                  <div className={`w-full h-2 rounded-full overflow-hidden my-2 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        utilization > 80
                          ? 'bg-rose-500'
                          : utilization > 50
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>

                  <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>
                      Deuda actual: <strong className="text-rose-600 dark:text-rose-400 font-mono">{hideBalances ? '••••' : formatGTQ(debt)}</strong>
                    </span>
                    <span>
                      Disponible: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{hideBalances ? '••••' : formatGTQ(available)}</strong>
                    </span>
                  </div>

                  {/* Cutoff & Payment Dates Badges */}
                  <div className={`mt-2.5 pt-2 border-t flex flex-wrap items-center gap-2 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center gap-1 font-semibold">
                      <Calendar className="w-3 h-3" />
                      <span>Corte: Día {card.cutoffDay || 15}</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3" />
                      <span>Pago: Día {card.paymentDueDay || 5}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-5 space-y-4 ${
              isDark
                ? 'bg-[#131927] border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
              <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`p-1 rounded-lg cursor-pointer transition-colors ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Nombre de la cuenta
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Banco Industrial, Billetera, etc."
                className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Tipo de cuenta
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="bank">Banco (Monetaria)</option>
                <option value="cash">Efectivo</option>
                <option value="savings">Ahorro</option>
                <option value="credit_card">Tarjeta de Crédito</option>
              </select>
            </div>

            {/* Selector de color */}
            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Color de la cuenta
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: 'Esmeralda', hex: '#10B981' },
                  { name: 'Azul BI', hex: '#0284C7' },
                  { name: 'Menta', hex: '#34D399' },
                  { name: 'Rojo BAC', hex: '#F43F5E' },
                  { name: 'Púrpura', hex: '#8B5CF6' },
                  { name: 'Ámbar', hex: '#F59E0B' },
                  { name: 'Cian', hex: '#06B6D4' },
                  { name: 'Índigo', hex: '#6366F1' },
                  { name: 'Fucsia', hex: '#EC4899' },
                  { name: 'Naranja', hex: '#F97316' },
                  { name: 'Pizarra', hex: '#64748B' },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                      color === c.hex
                        ? `ring-2 ring-emerald-500 ring-offset-2 ${isDark ? 'ring-offset-[#131927]' : 'ring-offset-white'} scale-110 shadow-md`
                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {color === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
                <div className="relative flex items-center">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded-full cursor-pointer border border-slate-300 dark:border-white/20 bg-transparent p-0 overflow-hidden"
                    title="Color personalizado"
                  />
                </div>
              </div>
            </div>

            {type === 'credit_card' ? (
              <>
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Deuda actual (GTQ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={balanceStr}
                    onChange={(e) => setBalanceStr(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Límite de crédito (GTQ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditLimitStr}
                    onChange={(e) => setCreditLimitStr(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Día de corte (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cutoffDayStr}
                      onChange={(e) => setCutoffDayStr(e.target.value)}
                      placeholder="15"
                      className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isDark
                          ? 'bg-black/30 border-white/10 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Día de pago (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={paymentDueDayStr}
                      onChange={(e) => setPaymentDueDayStr(e.target.value)}
                      placeholder="5"
                      className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isDark
                          ? 'bg-black/30 border-white/10 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Saldo actual (GTQ)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceStr}
                  onChange={(e) => setBalanceStr(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            )}

            {editingAccount && (
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleArchive(editingAccount)}
                  className={`text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {editingAccount.status === 'active' ? (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archivar cuenta</span>
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      <span>Reactivar cuenta</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(editingAccount.id)}
                  className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            )}

            <div className="pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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
                {editingAccount ? 'Actualizar cuenta' : 'Guardar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
