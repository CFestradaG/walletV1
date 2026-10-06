import React, { useState } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Download,
  LayoutDashboard,
  Landmark,
  Lock,
  Monitor,
  Moon,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Shield,
  Sun,
} from 'lucide-react';
import { WalletProvider, useWallet } from './core/state/WalletContext';
import { AuthScreen } from './features/auth/AuthScreen';
import { DashboardView } from './features/dashboard/DashboardView';
import { AccountsView } from './features/accounts/AccountsView';
import { TransactionsView } from './features/transactions/TransactionsView';
import { AnalyticsView } from './features/analytics/AnalyticsView';
import { MoreView } from './features/settings/MoreView';
import { TransactionModal } from './features/transactions/TransactionModal';
import { PeriodsModal } from './features/financial_periods/PeriodsModal';
import { AnnualBudgetModal } from './features/annual_budget/AnnualBudgetModal';
import { SecurityLockScreen } from './core/security/SecurityLockScreen';
import { SecuritySettingsModal } from './core/security/SecuritySettingsModal';
import { PWAInstallModal } from './core/pwa/PWAInstallModal';
import { usePWAInstall } from './core/pwa/usePWAInstall';
import { useAppLock } from './core/security/useAppLock';
import { getSecurityConfig } from './core/security/securityService';
import { Transaction, TransactionType } from './core/types/models';

type MainTab = 'inicio' | 'cuentas' | 'transacciones' | 'analisis' | 'mas';

const WalletAppShell: React.FC = () => {
  const {
    currentUser,
    logout,
    isAuthenticated,
    themeMode,
    resolvedTheme,
    setThemeMode,
    settings,
    syncError,
    isOnline,
    isSyncing,
    pendingOfflineCount,
    forceSyncNow,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';

  const [activeTab, setActiveTab] = useState<MainTab>('inicio');

  // PWA Install state & hook
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Security Lock state & hook
  const { isLocked, lockNow, unlockApp } = useAppLock(currentUser?.id);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const securityConfig = currentUser ? getSecurityConfig(currentUser.id) : { enabled: false };

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [initialTxType, setInitialTxType] = useState<TransactionType>('expense');
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>(
    undefined
  );
  const [preselectedDestinationCardId, setPreselectedDestinationCardId] = useState<
    string | undefined
  >(undefined);

  // Periods & Unified Annual Budget Modals State
  const [isPeriodsModalOpen, setIsPeriodsModalOpen] = useState(false);
  const [isAnnualBudgetModalOpen, setIsAnnualBudgetModalOpen] = useState(false);

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // App Lock Screen overlay (protects financial data when locked)
  if (isLocked && currentUser) {
    return (
      <SecurityLockScreen
        userId={currentUser.id}
        onUnlocked={unlockApp}
        onLogout={logout}
      />
    );
  }

  const handleOpenNewTransaction = (options?: {
    type?: TransactionType;
    accountId?: string;
    destinationCardId?: string;
  }) => {
    setEditingTx(null);
    setInitialTxType(options?.type || 'expense');
    setPreselectedAccountId(options?.accountId);
    setPreselectedDestinationCardId(options?.destinationCardId);
    setIsTxModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setPreselectedAccountId(undefined);
    setPreselectedDestinationCardId(undefined);
    setIsTxModalOpen(true);
  };

  const cycleThemeMode = () => {
    if (themeMode === 'dark') setThemeMode('light');
    else if (themeMode === 'light') setThemeMode('system');
    else setThemeMode('dark');
  };

  const navItems: {
    id: MainTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
    { id: 'cuentas', label: 'Cuentas', icon: Landmark },
    { id: 'transacciones', label: 'Transacciones', icon: ReceiptText },
    { id: 'analisis', label: 'Análisis', icon: BarChart3 },
    { id: 'mas', label: 'Más', icon: MoreHorizontal },
  ];

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors ${
        isDark ? 'bg-[#0B0F17] text-[#DFE2EE]' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* TOP BAR CONTRACT (3 ZONES: Brand | Nav Links | Actions) */}
      <header
        className={`sticky top-0 z-30 h-14 px-4 border-b backdrop-blur-md flex items-center justify-between ${
          isDark
            ? 'bg-[#0B0F17]/85 border-white/[0.07]'
            : 'bg-white/85 border-slate-200/80'
        }`}
      >
        {/* Zone 1: Brand Title (Single text element) */}
        <button
          type="button"
          onClick={() => setActiveTab('inicio')}
          className="font-display text-lg font-bold tracking-tight cursor-pointer"
        >
          Wallet
        </button>

        {/* Zone 2: Tablet & Web Nav Links (Activo para tablet y web >= 640px) */}
        <nav className="hidden sm:flex items-center gap-1 p-1 rounded-2xl border border-white/5 bg-black/20 dark:bg-black/30">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? isDark
                      ? 'bg-emerald-500/20 text-[#4EDEA3] shadow-xs border border-emerald-500/30 font-bold'
                      : 'bg-white text-emerald-700 shadow-xs border border-emerald-200 font-bold'
                    : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions (Lock + Install + Theme Mode Switcher + Agregar Transacción) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Lock Button (only if security is active) */}
          {securityConfig.enabled && (
            <button
              type="button"
              onClick={lockNow}
              title="Bloquear Wallet ahora"
              aria-label="Bloquear Wallet ahora"
              className={`min-h-[38px] px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Bloquear</span>
            </button>
          )}

          {/* Quick Install PWA Button (if installable or iOS guide and not standalone) */}
          {!isInstalled && (isInstallable || isIOS) && (
            <button
              type="button"
              onClick={() => (isInstallable ? void install() : setIsInstallModalOpen(true))}
              title="Instalar Wallet en tu dispositivo"
              aria-label="Instalar Wallet en tu dispositivo"
              className={`min-h-[38px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-teal-500/15 border-teal-500/30 text-teal-300 hover:bg-teal-500/25'
                  : 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}

          <button
            type="button"
            onClick={cycleThemeMode}
            title={`Tema: ${
              themeMode === 'light' ? 'Claro' : themeMode === 'dark' ? 'Oscuro' : 'Sistema'
            }`}
            className={`min-h-[38px] px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-[#131927] border-white/10 text-[#DFE2EE] hover:bg-[#1E293B]'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {themeMode === 'light' ? (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            ) : themeMode === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-[#4EDEA3]" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-[#93CCFF]" />
            )}
            <span className="hidden md:inline">
              {themeMode === 'light'
                ? 'Claro'
                : themeMode === 'dark'
                ? 'Oscuro'
                : 'Sistema'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNewTransaction()}
            title="Agregar transacción"
            aria-label="Agregar transacción"
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-300 text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 border border-emerald-400/30 group cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.75] transition-transform duration-200 group-hover:rotate-90" />
          </button>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              Modo sin conexión. {pendingOfflineCount > 0 ? `${pendingOfflineCount} cambio(s) guardado(s) localmente.` : 'Tus cambios se sincronizarán al reconectar.'}
            </span>
          </div>
        </div>
      )}

      {isOnline && isSyncing && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1 text-xs text-emerald-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Sincronizando con la nube {pendingOfflineCount > 0 ? `(${pendingOfflineCount} pendiente${pendingOfflineCount > 1 ? 's' : ''})` : ''}...</span>
        </div>
      )}

      {syncError && (
        <div role="alert" className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{syncError}</span>
          </div>
          {isOnline && (
            <button
              type="button"
              onClick={() => void forceSyncNow()}
              className="underline hover:text-white font-semibold cursor-pointer text-[11px] shrink-0 ml-2"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-24 sm:pb-8">
        {activeTab === 'inicio' && (
          <DashboardView
            onOpenNewTransaction={() => handleOpenNewTransaction()}
            onEditTransaction={handleEditTransaction}
            onOpenPeriodsModal={() => setIsPeriodsModalOpen(true)}
            onNavigateTab={setActiveTab}
            onOpenAnnualBudgetModal={() => setIsAnnualBudgetModalOpen(true)}
          />
        )}

        {activeTab === 'cuentas' && (
          <AccountsView
            onPayCreditCard={(cardId) =>
              handleOpenNewTransaction({
                type: 'transfer',
                destinationCardId: cardId,
              })
            }
            onNewTransactionForAccount={(accId) =>
              handleOpenNewTransaction({
                type: 'expense',
                accountId: accId,
              })
            }
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'transacciones' && (
          <TransactionsView
            onOpenNewTransaction={() => handleOpenNewTransaction()}
            onEditTransaction={handleEditTransaction}
            onOpenPeriodsModal={() => setIsPeriodsModalOpen(true)}
          />
        )}

        {activeTab === 'analisis' && (
          <AnalyticsView
            onOpenPeriodsModal={() => setIsPeriodsModalOpen(true)}
            onOpenBudgetsModal={() => setIsAnnualBudgetModalOpen(true)}
            onOpenNewTransaction={() => handleOpenNewTransaction()}
            onOpenAnnualBudgetModal={() => setIsAnnualBudgetModalOpen(true)}
          />
        )}

        {activeTab === 'mas' && (
          <MoreView
            onOpenPeriodsModal={() => setIsPeriodsModalOpen(true)}
            onOpenBudgetsModal={() => setIsAnnualBudgetModalOpen(true)}
            onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
            onOpenInstallModal={() => setIsInstallModalOpen(true)}
          />
        )}
      </main>

      {/* FLOATING PRIMARY ACTION ON INICIO & TRANSACCIONES — SOLO MÓVIL (< 640px) */}
      {(activeTab === 'inicio' || activeTab === 'transacciones') && (
        <div className="fixed right-4 bottom-20 z-30 sm:hidden">
          <button
            type="button"
            onClick={() => handleOpenNewTransaction()}
            aria-label="Agregar transacción"
            className="min-h-[48px] h-13 px-5 rounded-full bg-[#10B981] text-[#002113] font-display text-sm font-bold shadow-[0_8px_24px_rgba(16,185,129,0.32)] flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva</span>
          </button>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR — EXCLUSIVO MÓVIL (< 640px) */}
      <nav
        aria-label="Navegación móvil"
        className={`sm:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t backdrop-blur-md ${
          isDark
            ? 'bg-[#0B0F17]/90 border-white/[0.08]'
            : 'bg-white/90 border-slate-200'
        }`}
      >
        <div className="max-w-md mx-auto h-full grid grid-cols-5 items-center px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center py-1 transition-colors cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'text-[#4EDEA3] font-semibold'
                      : 'text-emerald-600 font-semibold'
                    : isDark
                    ? 'text-[#86948A] hover:text-[#DFE2EE]'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] mt-0.5 whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* GLOBAL MODALS */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        editingTransaction={editingTx}
        initialType={initialTxType}
        preselectedAccountId={preselectedAccountId}
        preselectedDestinationCardId={preselectedDestinationCardId}
      />

      <PeriodsModal
        isOpen={isPeriodsModalOpen}
        onClose={() => setIsPeriodsModalOpen(false)}
      />

      <AnnualBudgetModal
        isOpen={isAnnualBudgetModalOpen}
        onClose={() => setIsAnnualBudgetModalOpen(false)}
      />

      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        userId={currentUser?.id || ''}
        userDisplayName={currentUser?.name}
        onLockNow={lockNow}
      />

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onInstallNative={install}
        isInstallable={isInstallable}
        isIOS={isIOS}
      />
    </div>
  );
};

export default function App() {
  return (
    <WalletProvider>
      <WalletAppShell />
    </WalletProvider>
  );
}
