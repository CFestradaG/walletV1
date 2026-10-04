import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Account,
  AccountType,
  Budget,
  Category,
  FinancialPeriod,
  SubdivisionMode,
  ThemeMode,
  Transaction,
  TransactionType,
  UserProfile,
  UserSettings,
} from '../types/models';
import {
  createActiveDemoUserStore,
  createCleanUserStore,
  UserDataStore,
} from '../data/initialData';
import {
  generateSubperiods,
  PeriodValidationResult,
  resolveTransactionPeriod,
  syncTransactionsWithPeriods,
  validateFinancialPeriod,
} from '../../features/financial_periods/periodEngine';
import {
  applyTransactionToAccounts,
  BudgetProgress,
  calculateBudgetProgress,
  calculatePeriodSummary,
  calculatePortfolioSummary,
  getTransactionsForPeriod,
  PeriodFinancialSummary,
  PortfolioSummary,
  reverseTransactionOnAccounts,
  TransactionValidationResult,
  validateTransactionInput,
} from '../../features/transactions/financialEngine';

const STORAGE_KEY = 'wallet_app_v4_store';
const SESSION_USER_KEY = 'wallet_app_v4_user_id';

interface StoredDatabase {
  users: Record<string, UserDataStore>;
}

interface WalletContextValue {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => { ok: boolean; error?: string };
  registerUser: (
    name: string,
    email: string,
    password: string
  ) => { ok: boolean; error?: string };
  loginWithGoogle: () => void;
  recoverPassword: (email: string) => { ok: boolean; message: string };
  logout: () => void;
  switchUserMode: (mode: 'demo_francisco' | 'clean_new_user') => void;
  updateUserProfile: (name: string, email: string) => void;

  settings: UserSettings;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  toggleHideBalances: () => void;
  toggleOfflineMode: () => void;
  syncPendingOperations: () => void;
  pendingSyncCount: number;

  accounts: Account[];
  activeAccounts: Account[];
  liquidAccounts: Account[];
  creditCardAccounts: Account[];
  portfolioSummary: PortfolioSummary;
  createAccount: (input: {
    name: string;
    subtitle?: string;
    type: AccountType;
    initialBalance: number;
    creditLimit?: number;
    cutoffDay?: number;
    paymentDueDay?: number;
    icon: string;
    color: string;
  }) => { ok: boolean; error?: string };
  updateAccount: (
    accountId: string,
    input: {
      name: string;
      subtitle?: string;
      creditLimit?: number;
      cutoffDay?: number;
      paymentDueDay?: number;
      icon: string;
      color: string;
    }
  ) => { ok: boolean; error?: string };
  toggleArchiveAccount: (accountId: string) => void;

  categories: Category[];
  createCategory: (input: {
    name: string;
    type: 'expense' | 'income';
    icon: string;
    color: string;
  }) => { ok: boolean; error?: string };
  toggleCategoryActive: (categoryId: string) => void;
  addSubcategory: (
    categoryId: string,
    name: string,
    icon: string
  ) => { ok: boolean; error?: string };
  removeSubcategory: (categoryId: string, subcategoryId: string) => void;

  periods: FinancialPeriod[];
  activePeriod: FinancialPeriod | null;
  setActivePeriodId: (periodId: string) => void;
  createFinancialPeriod: (input: {
    name: string;
    startDate: string;
    endDate: string;
    subdivisionMode: SubdivisionMode;
    activateImmediately?: boolean;
  }) => PeriodValidationResult;
  updateFinancialPeriod: (
    periodId: string,
    input: {
      name: string;
      startDate: string;
      endDate: string;
      subdivisionMode: SubdivisionMode;
    }
  ) => PeriodValidationResult;
  deleteFinancialPeriod: (periodId: string) => { ok: boolean; error?: string };

  transactions: Transaction[];
  activePeriodTransactions: Transaction[];
  activePeriodSummary: PeriodFinancialSummary;
  createTransaction: (input: {
    type: TransactionType;
    amount: number;
    accountId?: string;
    categoryId?: string;
    subcategoryId?: string;
    originAccountId?: string;
    destinationAccountId?: string;
    isCreditCardPayment?: boolean;
    date: string;
    time?: string;
    note: string;
  }) => TransactionValidationResult;
  updateTransaction: (
    txId: string,
    input: {
      type: TransactionType;
      amount: number;
      accountId?: string;
      categoryId?: string;
      subcategoryId?: string;
      originAccountId?: string;
      destinationAccountId?: string;
      isCreditCardPayment?: boolean;
      date: string;
      time?: string;
      note: string;
    }
  ) => TransactionValidationResult;
  deleteTransaction: (txId: string) => void;

  budgets: Budget[];
  activePeriodBudgetsProgress: BudgetProgress[];
  saveBudget: (input: {
    id?: string;
    periodId: string;
    categoryId: string;
    subcategoryId?: string;
    targetAmount: number;
    alertThreshold80: boolean;
    alertThreshold100: boolean;
    distributeBySubperiod: boolean;
  }) => { ok: boolean; error?: string };
  deleteBudget: (budgetId: string) => void;

  // Convenience aliases and helpers
  selectActivePeriod: (periodId: string) => void;
  createPeriod: (input: {
    name: string;
    startDate: string;
    endDate: string;
    subdivisionMode: SubdivisionMode;
    activateImmediately?: boolean;
  }) => PeriodValidationResult;
  updatePeriod: (
    periodId: string,
    input: {
      name: string;
      startDate: string;
      endDate: string;
      subdivisionMode: SubdivisionMode;
    }
  ) => PeriodValidationResult;
  deletePeriod: (periodId: string) => { ok: boolean; error?: string };
  createBudget: (input: {
    periodId: string;
    categoryId: string;
    subcategoryId?: string;
    amount: number;
  }) => { ok: boolean; error?: string };
  updateBudget: (
    budgetId: string,
    input: {
      categoryId: string;
      subcategoryId?: string;
      amount: number;
    }
  ) => { ok: boolean; error?: string };
  resetPassword: (email: string) => { ok: boolean; message: string };
  updateSettings: (partial: Partial<UserSettings>) => void;
  deleteCategory: (categoryId: string) => void;
  updateCategory: (categoryId: string, input: Partial<Category>) => void;
  deleteAccount: (accountId: string) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function loadInitialDatabase(): StoredDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredDatabase;
      if (parsed && parsed.users && Object.keys(parsed.users).length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  const demoStore = createActiveDemoUserStore();
  const cleanUserProfile: UserProfile = {
    id: 'usr_nuevo',
    name: 'Usuario Nuevo',
    email: 'nuevo@wallet.gt',
    provider: 'email',
    createdAt: '2027-02-15T08:00:00.000Z',
  };
  const cleanStore = createCleanUserStore(cleanUserProfile);

  return {
    users: {
      [demoStore.profile.id]: demoStore,
      [cleanStore.profile.id]: cleanStore,
    },
  };
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<StoredDatabase>(() => loadInitialDatabase());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_USER_KEY);
      if (saved === '__LOGGED_OUT__') return null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'usr_francisco';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // ignore
    }
  }, [db]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_USER_KEY, currentUserId ?? '__LOGGED_OUT__');
    } catch {
      // ignore
    }
  }, [currentUserId]);

  const currentUserStore: UserDataStore | null = useMemo(() => {
    if (!currentUserId) return null;
    return db.users[currentUserId] || null;
  }, [db, currentUserId]);

  const defaultSettings: UserSettings = {
    userId: currentUserId || 'guest',
    currency: 'GTQ',
    currencySymbolPosition: 'prefix',
    decimalPlaces: 2,
    themeMode: 'dark',
    hideBalances: false,
    offlineSimulation: false,
    appProtection: true,
    biometrics: true,
    hasPin: true,
  };

  const settings = currentUserStore?.settings ?? defaultSettings;
  const themeMode = settings.themeMode;

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemPrefersDark]);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.style.backgroundColor = '#0F131C';
      document.body.style.color = '#DFE2EE';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#F8FAFC';
      document.body.style.color = '#0F172A';
    }
  }, [resolvedTheme]);

  const updateCurrentUserStore = (updater: (store: UserDataStore) => UserDataStore) => {
    if (!currentUserId) return;
    setDb((prev) => {
      const existing = prev.users[currentUserId];
      if (!existing) return prev;
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUserId]: updater(existing),
        },
      };
    });
  };

  const loginWithEmail = (email: string, password: string): { ok: boolean; error?: string } => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, error: 'Ingresa un correo electrónico válido.' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const foundUser = (Object.values(db.users) as UserDataStore[]).find(
      (u) => u.profile.email.toLowerCase() === cleanEmail
    );

    if (foundUser) {
      setCurrentUserId(foundUser.profile.id);
      return { ok: true };
    }

    const newId = `usr_${Date.now()}`;
    const nameFromEmail = cleanEmail.split('@')[0].replace(/[._]/g, ' ');
    const displayName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    const newProfile: UserProfile = {
      id: newId,
      name: displayName,
      email: cleanEmail,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };
    const newStore = createCleanUserStore(newProfile);

    setDb((prev) => ({
      ...prev,
      users: {
        ...prev.users,
        [newId]: newStore,
      },
    }));
    setCurrentUserId(newId);
    return { ok: true };
  };

  const registerUser = (
    name: string,
    email: string,
    password: string
  ): { ok: boolean; error?: string } => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return { ok: false, error: 'El nombre completo es obligatorio.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, error: 'Ingresa un correo electrónico válido.' };
    }
    if (!password || password.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    const exists = (Object.values(db.users) as UserDataStore[]).some(
      (u) => u.profile.email.toLowerCase() === cleanEmail
    );
    if (exists) {
      return { ok: false, error: 'Ya existe una cuenta registrada con este correo.' };
    }

    const newId = `usr_${Date.now()}`;
    const newProfile: UserProfile = {
      id: newId,
      name: cleanName,
      email: cleanEmail,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    const newStore = createCleanUserStore(newProfile);

    setDb((prev) => ({
      ...prev,
      users: {
        ...prev.users,
        [newId]: newStore,
      },
    }));
    setCurrentUserId(newId);
    return { ok: true };
  };

  const loginWithGoogle = () => {
    setCurrentUserId('usr_francisco');
  };

  const recoverPassword = (email: string): { ok: boolean; message: string } => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, message: 'Ingresa un correo electrónico válido.' };
    }
    return {
      ok: true,
      message: `Se ha enviado un enlace de recuperación de contraseña a ${cleanEmail}.`,
    };
  };

  const logout = () => {
    setCurrentUserId(null);
  };

  const switchUserMode = (mode: 'demo_francisco' | 'clean_new_user') => {
    if (mode === 'demo_francisco') {
      if (!db.users['usr_francisco']) {
        const demo = createActiveDemoUserStore();
        setDb((prev) => ({
          ...prev,
          users: { ...prev.users, [demo.profile.id]: demo },
        }));
      }
      setCurrentUserId('usr_francisco');
    } else {
      if (!db.users['usr_nuevo']) {
        const clean = createCleanUserStore({
          id: 'usr_nuevo',
          name: 'Usuario Nuevo',
          email: 'nuevo@wallet.gt',
          provider: 'email',
          createdAt: new Date().toISOString(),
        });
        setDb((prev) => ({
          ...prev,
          users: { ...prev.users, [clean.profile.id]: clean },
        }));
      }
      setCurrentUserId('usr_nuevo');
    }
  };

  const updateUserProfile = (name: string, email: string) => {
    if (!name.trim() || !email.trim()) return;
    updateCurrentUserStore((store) => ({
      ...store,
      profile: {
        ...store.profile,
        name: name.trim(),
        email: email.trim(),
      },
    }));
  };

  const setThemeMode = (mode: ThemeMode) => {
    updateCurrentUserStore((store) => ({
      ...store,
      settings: {
        ...store.settings,
        themeMode: mode,
      },
    }));
  };

  const toggleHideBalances = () => {
    updateCurrentUserStore((store) => ({
      ...store,
      settings: {
        ...store.settings,
        hideBalances: !store.settings.hideBalances,
      },
    }));
  };

  const toggleOfflineMode = () => {
    updateCurrentUserStore((store) => ({
      ...store,
      settings: {
        ...store.settings,
        offlineSimulation: !store.settings.offlineSimulation,
      },
    }));
  };

  const syncPendingOperations = () => {
    updateCurrentUserStore((store) => ({
      ...store,
      settings: {
        ...store.settings,
        offlineSimulation: false,
      },
      transactions: store.transactions.map((tx) => ({
        ...tx,
        pendingSync: false,
      })),
    }));
  };

  const accounts = currentUserStore?.accounts ?? [];
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'active'),
    [accounts]
  );
  const liquidAccounts = useMemo(
    () => activeAccounts.filter((a) => a.type !== 'credit_card'),
    [activeAccounts]
  );
  const creditCardAccounts = useMemo(
    () => activeAccounts.filter((a) => a.type === 'credit_card'),
    [activeAccounts]
  );
  const portfolioSummary = useMemo(
    () => calculatePortfolioSummary(accounts),
    [accounts]
  );

  const createAccount = (input: {
    name: string;
    subtitle?: string;
    type: AccountType;
    initialBalance: number;
    creditLimit?: number;
    cutoffDay?: number;
    paymentDueDay?: number;
    icon: string;
    color: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUserId) return { ok: false, error: 'Usuario no autenticado.' };
    const cleanName = input.name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la cuenta es obligatorio.' };

    const normalizedBalance =
      input.type === 'credit_card'
        ? -Math.abs(input.initialBalance)
        : Math.max(0, input.initialBalance);

    const now = new Date().toISOString();
    const newAccount: Account = {
      id: `acc_${Date.now()}`,
      userId: currentUserId,
      name: cleanName,
      subtitle: input.subtitle?.trim() || undefined,
      type: input.type,
      currency: 'GTQ',
      initialBalance: normalizedBalance,
      currentBalance: normalizedBalance,
      creditLimit: input.type === 'credit_card' ? input.creditLimit || 15000 : undefined,
      status: 'active',
      icon: input.icon || '🏦',
      color: input.color || '#10B981',
      cutoffDay: input.type === 'credit_card' ? (input.cutoffDay || 15) : undefined,
      paymentDueDay: input.type === 'credit_card' ? (input.paymentDueDay || 5) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    updateCurrentUserStore((store) => ({
      ...store,
      accounts: [...store.accounts, newAccount],
    }));

    return { ok: true };
  };

  const updateAccount = (
    accountId: string,
    input: {
      name: string;
      subtitle?: string;
      creditLimit?: number;
      cutoffDay?: number;
      paymentDueDay?: number;
      icon: string;
      color: string;
    }
  ): { ok: boolean; error?: string } => {
    const cleanName = input.name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la cuenta es obligatorio.' };

    updateCurrentUserStore((store) => ({
      ...store,
      accounts: store.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              name: cleanName,
              subtitle: input.subtitle?.trim() || undefined,
              creditLimit: acc.type === 'credit_card' ? input.creditLimit : undefined,
              cutoffDay: acc.type === 'credit_card' ? (input.cutoffDay ?? acc.cutoffDay ?? 15) : undefined,
              paymentDueDay: acc.type === 'credit_card' ? (input.paymentDueDay ?? acc.paymentDueDay ?? 5) : undefined,
              icon: input.icon,
              color: input.color,
              updatedAt: new Date().toISOString(),
            }
          : acc
      ),
    }));
    return { ok: true };
  };

  const toggleArchiveAccount = (accountId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      accounts: store.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              status: acc.status === 'active' ? 'archived' : 'active',
              updatedAt: new Date().toISOString(),
            }
          : acc
      ),
    }));
  };

  const categories = currentUserStore?.categories ?? [];

  const createCategory = (input: {
    name: string;
    type: 'expense' | 'income';
    icon: string;
    color: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUserId) return { ok: false, error: 'No autenticado.' };
    const cleanName = input.name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la categoría es obligatorio.' };

    const catId = `cat_${Date.now()}`;
    const newCat: Category = {
      id: catId,
      userId: currentUserId,
      name: cleanName,
      type: input.type,
      icon: input.icon || '🏷️',
      color: input.color || '#10B981',
      isActive: true,
      subcategories: [
        {
          id: `sub_${Date.now()}_1`,
          categoryId: catId,
          name: 'General',
          icon: input.icon || '🏷️',
        },
      ],
    };

    updateCurrentUserStore((store) => ({
      ...store,
      categories: [...store.categories, newCat],
    }));
    return { ok: true };
  };

  const toggleCategoryActive = (categoryId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) =>
        c.id === categoryId ? { ...c, isActive: !c.isActive } : c
      ),
    }));
  };

  const addSubcategory = (
    categoryId: string,
    name: string,
    icon: string
  ): { ok: boolean; error?: string } => {
    const cleanName = name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la subcategoría es obligatorio.' };

    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              subcategories: [
                ...c.subcategories,
                {
                  id: `sub_${Date.now()}`,
                  categoryId,
                  name: cleanName,
                  icon: icon || '🏷️',
                },
              ],
            }
          : c
      ),
    }));
    return { ok: true };
  };

  const removeSubcategory = (categoryId: string, subcategoryId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) =>
        c.id === categoryId && c.subcategories.length > 1
          ? {
              ...c,
              subcategories: c.subcategories.filter((s) => s.id !== subcategoryId),
            }
          : c
      ),
    }));
  };

  const periods = useMemo(() => {
    const raw = currentUserStore?.periods ?? [];
    return [...raw].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [currentUserStore?.periods]);

  const activePeriod = useMemo(() => {
    if (!currentUserStore) return null;
    return (
      periods.find((p) => p.id === currentUserStore.activePeriodId) ||
      periods.find((p) => p.isActive) ||
      periods[0] ||
      null
    );
  }, [periods, currentUserStore]);

  const setActivePeriodId = (periodId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      activePeriodId: periodId,
      periods: store.periods.map((p) => ({
        ...p,
        isActive: p.id === periodId,
        status: p.id === periodId ? 'active' : p.status === 'active' ? 'closed' : p.status,
      })),
    }));
  };

  const createFinancialPeriod = (input: {
    name: string;
    startDate: string;
    endDate: string;
    subdivisionMode: SubdivisionMode;
    activateImmediately?: boolean;
  }): PeriodValidationResult => {
    if (!currentUserId || !currentUserStore) {
      return { valid: false, error: 'Usuario no autenticado.' };
    }

    const validation = validateFinancialPeriod(input, currentUserStore.periods);
    if (!validation.valid) {
      return validation;
    }

    const now = new Date().toISOString();
    const newPeriodId = `per_${Date.now()}`;
    const subperiods = generateSubperiods(
      newPeriodId,
      input.startDate,
      input.endDate,
      input.subdivisionMode
    );

    const shouldActivate = input.activateImmediately ?? true;

    const newPeriod: FinancialPeriod = {
      id: newPeriodId,
      userId: currentUserId,
      name: input.name.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      subdivisionMode: input.subdivisionMode,
      status: shouldActivate ? 'active' : 'scheduled',
      isActive: shouldActivate,
      subperiods,
      createdAt: now,
      updatedAt: now,
    };

    updateCurrentUserStore((store) => {
      const updatedPeriods = [
        ...store.periods.map((p) =>
          shouldActivate ? { ...p, isActive: false } : p
        ),
        newPeriod,
      ];
      return {
        ...store,
        periods: updatedPeriods,
        activePeriodId: shouldActivate ? newPeriodId : store.activePeriodId,
        transactions: syncTransactionsWithPeriods(store.transactions, updatedPeriods),
      };
    });

    return { valid: true };
  };

  const updateFinancialPeriod = (
    periodId: string,
    input: {
      name: string;
      startDate: string;
      endDate: string;
      subdivisionMode: SubdivisionMode;
    }
  ): PeriodValidationResult => {
    if (!currentUserStore) {
      return { valid: false, error: 'Usuario no autenticado.' };
    }

    const validation = validateFinancialPeriod(input, currentUserStore.periods, periodId);
    if (!validation.valid) {
      return validation;
    }

    const newSubperiods = generateSubperiods(
      periodId,
      input.startDate,
      input.endDate,
      input.subdivisionMode
    );

    updateCurrentUserStore((store) => {
      const updatedPeriods = store.periods.map((p) =>
        p.id === periodId
          ? {
              ...p,
              name: input.name.trim(),
              startDate: input.startDate,
              endDate: input.endDate,
              subdivisionMode: input.subdivisionMode,
              subperiods: newSubperiods,
              updatedAt: new Date().toISOString(),
            }
          : p
      );

      return {
        ...store,
        periods: updatedPeriods,
        transactions: syncTransactionsWithPeriods(store.transactions, updatedPeriods),
      };
    });

    return { valid: true };
  };

  const deleteFinancialPeriod = (periodId: string): { ok: boolean; error?: string } => {
    if (!currentUserStore) return { ok: false, error: 'No autenticado.' };
    if (currentUserStore.periods.length <= 1) {
      return {
        ok: false,
        error: 'Debe existir al menos un período financiero activo.',
      };
    }

    updateCurrentUserStore((store) => {
      const remaining = store.periods.filter((p) => p.id !== periodId);
      const nextActiveId =
        store.activePeriodId === periodId ? remaining[0].id : store.activePeriodId;
      return {
        ...store,
        periods: remaining.map((p) => ({
          ...p,
          isActive: p.id === nextActiveId,
        })),
        activePeriodId: nextActiveId,
        transactions: syncTransactionsWithPeriods(store.transactions, remaining),
      };
    });

    return { ok: true };
  };

  const transactions = useMemo(() => {
    const raw = currentUserStore?.transactions ?? [];
    return [...raw].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [currentUserStore?.transactions]);

  const activePeriodTransactions = useMemo(
    () => getTransactionsForPeriod(transactions, activePeriod),
    [transactions, activePeriod]
  );

  const activePeriodSummary = useMemo(
    () => calculatePeriodSummary(transactions, activePeriod),
    [transactions, activePeriod]
  );

  const pendingSyncCount = useMemo(
    () => transactions.filter((tx) => tx.pendingSync).length,
    [transactions]
  );

  const createTransaction = (input: {
    type: TransactionType;
    amount: number;
    accountId?: string;
    categoryId?: string;
    subcategoryId?: string;
    originAccountId?: string;
    destinationAccountId?: string;
    isCreditCardPayment?: boolean;
    date: string;
    time?: string;
    note: string;
  }): TransactionValidationResult => {
    if (!currentUserId || !currentUserStore) {
      return { valid: false, error: 'Usuario no autenticado.' };
    }

    const validation = validateTransactionInput(
      {
        userId: currentUserId,
        type: input.type,
        amount: input.amount,
        currency: 'GTQ',
        accountId: input.accountId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        originAccountId: input.originAccountId,
        destinationAccountId: input.destinationAccountId,
        date: input.date,
      },
      currentUserStore.accounts,
      currentUserStore.categories
    );

    if (!validation.valid) {
      return validation;
    }

    const now = new Date().toISOString();
    const resolved = resolveTransactionPeriod(input.date, currentUserStore.periods);
    const assignedPeriod =
      resolved.period ||
      currentUserStore.periods.find((p) => p.id === currentUserStore.activePeriodId) ||
      currentUserStore.periods[0];
    const assignedSubperiod =
      resolved.subperiod ||
      assignedPeriod?.subperiods?.[0];

    const destAcc = currentUserStore.accounts.find((a) => a.id === input.destinationAccountId);
    const isCardPayment =
      input.type === 'transfer' &&
      (Boolean(input.isCreditCardPayment) || destAcc?.type === 'credit_card');

    const effectiveOriginId = input.originAccountId || input.accountId;

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUserId,
      type: input.type,
      amount: Math.round(input.amount * 100) / 100,
      currency: 'GTQ',
      accountId: input.type !== 'transfer' ? input.accountId : undefined,
      categoryId: input.type !== 'transfer' ? input.categoryId : undefined,
      subcategoryId: input.type !== 'transfer' ? input.subcategoryId : undefined,
      originAccountId: input.type === 'transfer' ? effectiveOriginId : undefined,
      destinationAccountId: input.type === 'transfer' ? input.destinationAccountId : undefined,
      isCreditCardPayment: isCardPayment,
      date: input.date,
      time: input.time || new Date().toTimeString().slice(0, 5),
      note: input.note.trim() || (input.type === 'transfer' ? 'Transferencia entre cuentas' : ''),
      periodId: assignedPeriod?.id,
      subperiodId: assignedSubperiod?.id,
      pendingSync: currentUserStore.settings.offlineSimulation,
      createdAt: now,
      updatedAt: now,
    };

    updateCurrentUserStore((store) => ({
      ...store,
      accounts: applyTransactionToAccounts(newTx, store.accounts),
      transactions: [newTx, ...store.transactions],
    }));

    return { valid: true };
  };

  const updateTransaction = (
    txId: string,
    input: {
      type: TransactionType;
      amount: number;
      accountId?: string;
      categoryId?: string;
      subcategoryId?: string;
      originAccountId?: string;
      destinationAccountId?: string;
      isCreditCardPayment?: boolean;
      date: string;
      time?: string;
      note: string;
    }
  ): TransactionValidationResult => {
    if (!currentUserId || !currentUserStore) {
      return { valid: false, error: 'Usuario no autenticado.' };
    }

    const existingTx = currentUserStore.transactions.find((t) => t.id === txId);
    if (!existingTx) {
      return { valid: false, error: 'La transacción no existe.' };
    }

    const validation = validateTransactionInput(
      {
        userId: currentUserId,
        type: input.type,
        amount: input.amount,
        currency: 'GTQ',
        accountId: input.accountId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        originAccountId: input.originAccountId,
        destinationAccountId: input.destinationAccountId,
        date: input.date,
      },
      currentUserStore.accounts,
      currentUserStore.categories,
      existingTx
    );

    if (!validation.valid) {
      return validation;
    }

    const resolved = resolveTransactionPeriod(input.date, currentUserStore.periods);
    const assignedPeriod =
      resolved.period ||
      currentUserStore.periods.find((p) => p.id === currentUserStore.activePeriodId) ||
      currentUserStore.periods[0];
    const assignedSubperiod =
      resolved.subperiod ||
      assignedPeriod?.subperiods?.[0];

    const destAcc = currentUserStore.accounts.find((a) => a.id === input.destinationAccountId);
    const isCardPayment =
      input.type === 'transfer' &&
      (Boolean(input.isCreditCardPayment) || destAcc?.type === 'credit_card');

    const effectiveOriginId = input.originAccountId || input.accountId;

    const updatedTx: Transaction = {
      ...existingTx,
      type: input.type,
      amount: Math.round(input.amount * 100) / 100,
      accountId: input.type !== 'transfer' ? input.accountId : undefined,
      categoryId: input.type !== 'transfer' ? input.categoryId : undefined,
      subcategoryId: input.type !== 'transfer' ? input.subcategoryId : undefined,
      originAccountId: input.type === 'transfer' ? effectiveOriginId : undefined,
      destinationAccountId: input.type === 'transfer' ? input.destinationAccountId : undefined,
      isCreditCardPayment: isCardPayment,
      date: input.date,
      time: input.time || existingTx.time,
      note: input.note.trim(),
      periodId: assignedPeriod?.id,
      subperiodId: assignedSubperiod?.id,
      pendingSync: currentUserStore.settings.offlineSimulation,
      updatedAt: new Date().toISOString(),
    };

    updateCurrentUserStore((store) => {
      const reversedAccounts = reverseTransactionOnAccounts(existingTx, store.accounts);
      const finalAccounts = applyTransactionToAccounts(updatedTx, reversedAccounts);
      return {
        ...store,
        accounts: finalAccounts,
        transactions: store.transactions.map((t) => (t.id === txId ? updatedTx : t)),
      };
    });

    return { valid: true };
  };

  const deleteTransaction = (txId: string) => {
    updateCurrentUserStore((store) => {
      const target = store.transactions.find((t) => t.id === txId);
      if (!target) return store;
      return {
        ...store,
        accounts: reverseTransactionOnAccounts(target, store.accounts),
        transactions: store.transactions.filter((t) => t.id !== txId),
      };
    });
  };

  const budgets = currentUserStore?.budgets ?? [];

  const activePeriodBudgetsProgress = useMemo(() => {
    if (!activePeriod) return [];
    const periodBudgets = budgets.filter((b) => b.periodId === activePeriod.id);
    return periodBudgets.map((b) =>
      calculateBudgetProgress(b, activePeriod, transactions, categories)
    );
  }, [budgets, activePeriod, transactions, categories]);

  const saveBudget = (input: {
    id?: string;
    periodId: string;
    categoryId: string;
    subcategoryId?: string;
    targetAmount: number;
    alertThreshold80: boolean;
    alertThreshold100: boolean;
    distributeBySubperiod: boolean;
  }): { ok: boolean; error?: string } => {
    if (!currentUserId) return { ok: false, error: 'Usuario no autenticado.' };
    if (input.targetAmount <= 0 || Number.isNaN(input.targetAmount)) {
      return { ok: false, error: 'El monto objetivo debe ser mayor que cero.' };
    }
    if (!input.categoryId) {
      return { ok: false, error: 'Selecciona una categoría para el presupuesto.' };
    }

    const now = new Date().toISOString();

    updateCurrentUserStore((store) => {
      if (input.id) {
        return {
          ...store,
          budgets: store.budgets.map((b) =>
            b.id === input.id
              ? {
                  ...b,
                  periodId: input.periodId,
                  categoryId: input.categoryId,
                  subcategoryId: input.subcategoryId || undefined,
                  targetAmount: Math.round(input.targetAmount * 100) / 100,
                  alertThreshold80: input.alertThreshold80,
                  alertThreshold100: input.alertThreshold100,
                  distributeBySubperiod: input.distributeBySubperiod,
                  updatedAt: now,
                }
              : b
          ),
        };
      }

      const newBudget: Budget = {
        id: `bdg_${Date.now()}`,
        userId: currentUserId,
        periodId: input.periodId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId || undefined,
        targetAmount: Math.round(input.targetAmount * 100) / 100,
        currency: 'GTQ',
        alertThreshold80: input.alertThreshold80,
        alertThreshold100: input.alertThreshold100,
        distributeBySubperiod: input.distributeBySubperiod,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...store,
        budgets: [...store.budgets, newBudget],
      };
    });

    return { ok: true };
  };

  const deleteBudget = (budgetId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      budgets: store.budgets.filter((b) => b.id !== budgetId),
    }));
  };

  const selectActivePeriod = (periodId: string) => setActivePeriodId(periodId);
  const createPeriod = (input: any) => createFinancialPeriod(input);
  const updatePeriod = (periodId: string, input: any) => updateFinancialPeriod(periodId, input);
  const deletePeriod = (periodId: string) => deleteFinancialPeriod(periodId);

  const createBudget = (input: {
    periodId: string;
    categoryId: string;
    subcategoryId?: string;
    amount: number;
  }) => {
    return saveBudget({
      periodId: input.periodId,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      targetAmount: input.amount,
      alertThreshold80: true,
      alertThreshold100: true,
      distributeBySubperiod: false,
    });
  };

  const updateBudget = (
    budgetId: string,
    input: {
      categoryId: string;
      subcategoryId?: string;
      amount: number;
    }
  ) => {
    return saveBudget({
      id: budgetId,
      periodId: activePeriod?.id || '',
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      targetAmount: input.amount,
      alertThreshold80: true,
      alertThreshold100: true,
      distributeBySubperiod: false,
    });
  };

  const resetPassword = (email: string) => recoverPassword(email);

  const updateSettings = (partial: Partial<UserSettings>) => {
    updateCurrentUserStore((store) => ({
      ...store,
      settings: {
        ...store.settings,
        ...partial,
        hideBalances:
          partial.hideSensitiveBalances !== undefined
            ? partial.hideSensitiveBalances
            : partial.hideBalances !== undefined
            ? partial.hideBalances
            : store.settings.hideBalances,
        hideSensitiveBalances:
          partial.hideSensitiveBalances !== undefined
            ? partial.hideSensitiveBalances
            : partial.hideBalances !== undefined
            ? partial.hideBalances
            : store.settings.hideBalances,
      },
    }));
  };

  const deleteCategory = (categoryId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.filter((c) => c.id !== categoryId),
    }));
  };

  const updateCategory = (categoryId: string, input: Partial<Category>) => {
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) =>
        c.id === categoryId ? { ...c, ...input } : c
      ),
    }));
  };

  const deleteAccount = (accountId: string) => {
    updateCurrentUserStore((store) => ({
      ...store,
      accounts: store.accounts.filter((a) => a.id !== accountId),
    }));
  };

  return (
    <WalletContext.Provider
      value={{
        currentUser: currentUserStore?.profile ?? null,
        isAuthenticated: Boolean(currentUserStore),
        loginWithEmail,
        registerUser,
        loginWithGoogle,
        recoverPassword,
        logout,
        switchUserMode,
        updateUserProfile,

        settings,
        themeMode,
        resolvedTheme,
        setThemeMode,
        toggleHideBalances,
        toggleOfflineMode,
        syncPendingOperations,
        pendingSyncCount,

        accounts,
        activeAccounts,
        liquidAccounts,
        creditCardAccounts,
        portfolioSummary,
        createAccount,
        updateAccount,
        toggleArchiveAccount,
        deleteAccount,

        categories,
        createCategory,
        toggleCategoryActive,
        addSubcategory,
        removeSubcategory,
        updateCategory,
        deleteCategory,

        periods,
        activePeriod,
        setActivePeriodId,
        createFinancialPeriod,
        updateFinancialPeriod,
        deleteFinancialPeriod,
        selectActivePeriod,
        createPeriod,
        updatePeriod,
        deletePeriod,

        transactions,
        activePeriodTransactions,
        activePeriodSummary,
        createTransaction,
        updateTransaction,
        deleteTransaction,

        budgets,
        activePeriodBudgetsProgress,
        saveBudget,
        deleteBudget,
        createBudget,
        updateBudget,

        resetPassword,
        updateSettings,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside a WalletProvider');
  }
  return ctx;
}
