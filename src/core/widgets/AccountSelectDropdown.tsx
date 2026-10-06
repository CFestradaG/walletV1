import React, { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  Check,
  ChevronDown,
  CreditCard,
  Landmark,
  PiggyBank,
  Wallet,
} from 'lucide-react';
import { Account, AccountType } from '../types/models';
import { formatGTQ } from '../utils/formatters';

interface AccountSelectDropdownProps {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
  excludeId?: string;
  isDark?: boolean;
  accentColor?: string;
}

const getAccountIconComponent = (type: AccountType) => {
  switch (type) {
    case 'cash':
      return Banknote;
    case 'bank':
      return Landmark;
    case 'savings':
      return PiggyBank;
    case 'credit_card':
      return CreditCard;
    default:
      return Wallet;
  }
};

export const AccountSelectDropdown: React.FC<AccountSelectDropdownProps> = ({
  accounts,
  value,
  onChange,
  placeholder = 'Selecciona una cuenta',
  excludeId,
  isDark = true,
  accentColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableAccounts = accounts.filter(
    (a) => a.status === 'active' && (!excludeId || a.id !== excludeId)
  );

  const selectedAccount = accounts.find((a) => a.id === value);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const SelectedIcon = selectedAccount
    ? getAccountIconComponent(selectedAccount.type)
    : Wallet;

  const activeColor = selectedAccount?.color || accentColor || '#10B981';

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 ${
          isOpen
            ? 'ring-2 ring-emerald-500/50'
            : ''
        } ${
          isDark
            ? 'bg-[#182032] border-white/15 text-white hover:border-white/30'
            : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 shadow-xs'
        }`}
        style={
          selectedAccount
            ? {
                borderColor: `${activeColor}50`,
                backgroundColor: isDark ? '#141c2c' : '#ffffff',
              }
            : undefined
        }
      >
        {selectedAccount ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
              style={{
                backgroundColor: `${activeColor}25`,
                color: activeColor,
              }}
            >
              <SelectedIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedAccount.name}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeColor }}
                />
              </div>
              <span className={`text-[10px] block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedAccount.subtitle ||
                  (selectedAccount.type === 'cash'
                    ? 'Efectivo'
                    : selectedAccount.type === 'bank'
                    ? 'Cuenta Bancaria'
                    : selectedAccount.type === 'savings'
                    ? 'Cuenta de Ahorro'
                    : 'Tarjeta de Crédito')}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`font-mono text-xs font-bold block ${
                  selectedAccount.type === 'credit_card'
                    ? isDark ? 'text-rose-400' : 'text-rose-600'
                    : isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              >
                {formatGTQ(selectedAccount.currentBalance ?? selectedAccount.balance ?? 0)}
              </span>
            </div>
          </div>
        ) : (
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{placeholder}</span>
        )}

        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-500' : isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border shadow-2xl max-h-64 overflow-y-auto p-1.5 space-y-1 backdrop-blur-md transition-all ${
            isDark
              ? 'bg-[#182032] border-white/20 text-white shadow-black/80'
              : 'bg-white border-slate-300 text-slate-900 shadow-xl'
          }`}
        >
          {availableAccounts.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No hay cuentas disponibles
            </div>
          ) : (
            availableAccounts.map((acc) => {
              const Icon = getAccountIconComponent(acc.type);
              const isSelected = acc.id === value;
              const accColor = acc.color || '#10B981';

              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    onChange(acc.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-white/10 text-white font-semibold'
                        : 'bg-emerald-50 text-slate-900 font-semibold'
                      : isDark
                      ? 'hover:bg-white/5 text-slate-200'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                  style={
                    isSelected
                      ? {
                          borderLeft: `3px solid ${accColor}`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${accColor}25`,
                        color: accColor,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs truncate ${
                            isDark ? 'text-white' : 'text-slate-900'
                          } ${isSelected ? 'font-bold' : 'font-medium'}`}
                        >
                          {acc.name}
                        </span>
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: accColor }}
                        />
                      </div>
                      <span
                        className={`text-[10px] block truncate ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {acc.subtitle ||
                          (acc.type === 'cash'
                            ? 'Efectivo'
                            : acc.type === 'bank'
                            ? 'Banco'
                            : acc.type === 'savings'
                            ? 'Ahorro'
                            : 'Tarjeta de Crédito')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono text-xs font-bold ${
                        acc.type === 'credit_card'
                          ? 'text-rose-400'
                          : isDark
                          ? 'text-emerald-400'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatGTQ(acc.currentBalance ?? acc.balance ?? 0)}
                    </span>
                    {isSelected && (
                      <Check
                        className="w-4 h-4 shrink-0"
                        style={{ color: accColor }}
                      />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
