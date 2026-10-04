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
import {
  auth,
  db as firestoreDb,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase/firebase';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  onSnapshot,
} from 'firebase/firestore';
import {
  deleteAccountFromDb,
  deleteBudgetFromDb,
  deleteCategoryFromDb,
  deletePeriodFromDb,
  deleteTransactionFromDb,
  deleteTransactionWithAccounts,
  seedUserInitialData,
  syncAccount,
  syncBudget,
  syncCategory,
  syncPeriod,
  syncProfile,
  syncSettings,
  syncTransaction,
  syncTransactionWithAccounts,
  resetUserFinancialData,
} from '../firebase/firestoreSync';
import {
  offlineQueue,
  loadQueueFromStorage,
} from '../sync/offlineQueue';

const STORAGE_KEY = 'wallet_app_v4_store';
const SESSION_USER_KEY = 'wallet_app_v4_user_id';

interface StoredDatabase {
  users: Record<string, UserDataStore>;
}

function readLocalUserStore(userId: string): UserDataStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDatabase;
    return parsed?.users?.[userId] ?? null;
  } catch {
    return null;
  }
}

function mergeLocalStoreForUpload(defaultStore: UserDataStore, localStore: UserDataStore | null, uid: string): UserDataStore {
  if (!localStore) return defaultStore;
  const mergeById = <T extends { id: string }>(defaults: T[], local: T[]) => {
    const records = new Map(defaults.map((item) => [item.id, item]));
    local.forEach((item) => records.set(item.id, item));
    return [...records.values()];
  };
  return {
    ...defaultStore,
    ...localStore,
    profile: { ...localStore.profile, ...defaultStore.profile, id: uid },
    settings: { ...defaultStore.settings, ...localStore.settings, userId: uid },
    accounts: mergeById(defaultStore.accounts, localStore.accounts || []),
    categories: mergeById(defaultStore.categories, localStore.categories || []),
    periods: mergeById(defaultStore.periods, localStore.periods || []),
    transactions: (localStore.transactions || []).map((tx) => ({ ...tx, userId: uid })),
    budgets: mergeById(defaultStore.budgets, localStore.budgets || []),
  };
}

function normalizeOwnedDocuments<T extends { userId?: string }>(
  documents: Array<{ data: () => unknown }>,
  uid: string,
  repairMissingOwner: (record: T) => void
): T[] {
  return documents.flatMap((document) => {
    const record = document.data() as T;
    const ownedRecord = { ...record, userId: uid } as T;
    if (record.userId !== uid) repairMissingOwner(ownedRecord);
    return [ownedRecord];
  });
}

interface WalletContextValue {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerUser: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void> | void;
  recoverPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void> | void;
  switchUserMode: (mode: 'demo_francisco' | 'clean_new_user') => void;
  resetAccountData: () => Promise<{ ok: boolean; error?: string }>;
  updateUserProfile: (name: string, email: string) => void;

  settings: UserSettings;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  toggleHideBalances: () => void;
  syncError: string | null;

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
  updateCategoryName: (categoryId: string, name: string) => { ok: boolean; error?: string };
  updateSubcategoryName: (categoryId: string, subcategoryId: string, name: string) => { ok: boolean; error?: string };
  toggleCategoryActive: (categoryId: string) => void;
  addSubcategory: (
    categoryId: string,
    name: string,
    icon: string
  ) => { ok: boolean; error?: string };
  removeSubcategory: (categoryId: string, subcategoryId: string) => { ok: boolean; error?: string };

  periods: FinancialPeriod[];
  activePeriod: FinancialPeriod | null;
  setActivePeriodId: (periodId: string) => void;
  createFinancialPeriod: (input: {
    name: string;
    referenceMonth: number;
    startDate: string;
    endDate: string;
    subdivisionMode: SubdivisionMode;
    activateImmediately?: boolean;
  }) => PeriodValidationResult;
  updateFinancialPeriod: (
    periodId: string,
    input: {
      name: string;
      referenceMonth: number;
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
    referenceMonth: number;
    startDate: string;
    endDate: string;
    subdivisionMode: SubdivisionMode;
    activateImmediately?: boolean;
  }) => PeriodValidationResult;
  updatePeriod: (
    periodId: string,
    input: {
      name: string;
      referenceMonth: number;
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
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  updateSettings: (partial: Partial<UserSettings>) => void;
  deleteCategory: (categoryId: string) => { ok: boolean; error?: string };
  deleteAccount: (accountId: string) => void;

  isOnline: boolean;
  isSyncing: boolean;
  pendingOfflineCount: number;
  lastSyncTime: number | null;
  forceSyncNow: () => Promise<void>;
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
  const [remoteTransactionsLoaded, setRemoteTransactionsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_USER_KEY);
      if (saved === '__LOGGED_OUT__') return null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (currentUserId) void offlineQueue.processUserQueue(currentUserId);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUserId]);

  useEffect(() => {
    const unsub = offlineQueue.subscribe((status) => {
      setIsSyncing(status.isProcessing);
      setPendingOfflineCount(status.pendingCount);
      if (status.lastSyncTime) setLastSyncTime(status.lastSyncTime);
      if (status.lastError) setSyncError(status.lastError);
      else if (status.pendingCount === 0) setSyncError(null);
    });
    if (currentUserId) {
      setPendingOfflineCount(offlineQueue.getPendingCount(currentUserId));
    }
    return () => unsub();
  }, [currentUserId]);

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

  // Synchronize with Firebase Auth and Firestore real-time listeners
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Unsubscribe existing Firestore listeners
      unsubs.forEach((unsub) => unsub());
      unsubs = [];

      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const reportReadError = (error: unknown, label: string, path: string): never => {
          const code = (error as { code?: string })?.code;
          setSyncError(`No se pudieron descargar ${label}${code ? ` (${code})` : ''}.`);
          return handleFirestoreError(error, OperationType.GET, path);
        };
        setRemoteTransactionsLoaded(false);
        setCurrentUserId(uid);

        const profile: UserProfile = {
          id: uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
          email: firebaseUser.email || '',
          photoUrl: firebaseUser.photoURL || undefined,
          provider: firebaseUser.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'email',
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
        };

        const initialStore = createCleanUserStore(profile);

        setDb((prev) => {
          if (!prev.users[uid]) {
            return {
              ...prev,
              users: {
                ...prev.users,
                [uid]: initialStore,
              },
            };
          }
          return prev;
        });

        // Upload data saved locally for this Firebase user before remote snapshots
        // replace the local state. This recovers records created before cloud sync.
        const uploadStore = mergeLocalStoreForUpload(initialStore, readLocalUserStore(uid), uid);
        try {
          await Promise.all([syncProfile(uid, profile), seedUserInitialData(uid, uploadStore)]);
          if (auth.currentUser?.uid === uid) setSyncError(null);
        } catch (error) {
          console.error('No se pudieron sincronizar los datos locales con Firestore:', error);
          if (auth.currentUser?.uid === uid) {
            setSyncError('No se pudieron guardar tus datos en la nube. Se conservan en este dispositivo; revisa tu conexión e inténtalo de nuevo.');
          }
        }
        if (auth.currentUser?.uid !== uid) return;

        // Real-time listener for accounts
        const unsubAccounts = onSnapshot(
          collection(firestoreDb, 'users', uid, 'accounts'),
          (snap) => {
            const remoteAccs = normalizeOwnedDocuments<Account>(snap.docs, uid, (account) => {
              offlineQueue.enqueue(uid, 'SAVE_ACCOUNT', { account });
            });

            // Reconcile with pending offline mutations
            const pendingQueue = loadQueueFromStorage(uid);
            const pendingAccountSaves = new Map<string, Account>();
            for (const item of pendingQueue) {
              if (item.type === 'SAVE_ACCOUNT') {
                pendingAccountSaves.set(item.payload.account.id, item.payload.account);
              } else if (item.type === 'SAVE_TX_AND_ACCOUNTS' || item.type === 'DELETE_TX_AND_ACCOUNTS') {
                if (Array.isArray(item.payload.accounts)) {
                  for (const acc of item.payload.accounts) {
                    pendingAccountSaves.set(acc.id, acc);
                  }
                }
              }
            }
            const pendingAccountDeletes = new Set(
              pendingQueue
                .filter((m) => m.type === 'DELETE_ACCOUNT')
                .map((m) => m.payload.accountId)
            );

            let reconciled = remoteAccs.filter((acc) => !pendingAccountDeletes.has(acc.id));
            reconciled = reconciled.map((acc) => {
              if (pendingAccountSaves.has(acc.id)) {
                const localVersion = pendingAccountSaves.get(acc.id)!;
                pendingAccountSaves.delete(acc.id);
                return localVersion;
              }
              return acc;
            });
            for (const localAcc of pendingAccountSaves.values()) {
              reconciled.push(localAcc);
            }

            setDb((prev) => {
              const current = prev.users[uid] || initialStore;
              return { ...prev, users: { ...prev.users, [uid]: { ...current, accounts: reconciled } } };
            });
          },
          (err) => reportReadError(err, 'las cuentas', `users/${uid}/accounts`)
        );
        unsubs.push(unsubAccounts);

        // Real-time listener for categories
        const unsubCategories = onSnapshot(
          collection(firestoreDb, 'users', uid, 'categories'),
          (snap) => {
            const remoteCats = normalizeOwnedDocuments<Category>(snap.docs, uid, (category) => {
              offlineQueue.enqueue(uid, 'SAVE_CATEGORY', { category });
            });
            const pendingQueue = loadQueueFromStorage(uid);
            const pendingDeletes = new Set(
              pendingQueue
                .filter((m) => m.type === 'DELETE_CATEGORY')
                .map((m) => m.payload.categoryId)
            );
            const pendingSaves = new Map<string, Category>(
              pendingQueue
                .filter((m) => m.type === 'SAVE_CATEGORY')
                .map((m) => [m.payload.category.id, m.payload.category])
            );

            let reconciled = remoteCats.filter((c) => !pendingDeletes.has(c.id));
            reconciled = reconciled.map((c) => {
              if (pendingSaves.has(c.id)) {
                const local = pendingSaves.get(c.id)!;
                pendingSaves.delete(c.id);
                return local;
              }
              return c;
            });
            for (const localCat of pendingSaves.values()) {
              reconciled.push(localCat);
            }

            setDb((prev) => {
              const current = prev.users[uid] || initialStore;
              return { ...prev, users: { ...prev.users, [uid]: { ...current, categories: reconciled } } };
            });
          },
          (err) => reportReadError(err, 'las categorías', `users/${uid}/categories`)
        );
        unsubs.push(unsubCategories);

        // Real-time listener for periods
        const unsubPeriods = onSnapshot(
          collection(firestoreDb, 'users', uid, 'periods'),
          (snap) => {
            const remotePers = normalizeOwnedDocuments<FinancialPeriod>(snap.docs, uid, (period) => {
              offlineQueue.enqueue(uid, 'SAVE_PERIOD', { period });
            });
            const pendingQueue = loadQueueFromStorage(uid);
            const pendingDeletes = new Set(
              pendingQueue
                .filter((m) => m.type === 'DELETE_PERIOD')
                .map((m) => m.payload.periodId)
            );
            const pendingSaves = new Map<string, FinancialPeriod>(
              pendingQueue
                .filter((m) => m.type === 'SAVE_PERIOD')
                .map((m) => [m.payload.period.id, m.payload.period])
            );

            let reconciled = remotePers.filter((p) => !pendingDeletes.has(p.id));
            reconciled = reconciled.map((p) => {
              if (pendingSaves.has(p.id)) {
                const local = pendingSaves.get(p.id)!;
                pendingSaves.delete(p.id);
                return local;
              }
              return p;
            });
            for (const localPer of pendingSaves.values()) {
              reconciled.push(localPer);
            }

            setDb((prev) => {
              const current = prev.users[uid] || initialStore;
              const preferredActiveId =
                current.settings?.activePeriodId ||
                reconciled.find((period) => period.isActive)?.id ||
                reconciled[0]?.id;
              return {
                ...prev,
                users: {
                  ...prev.users,
                  [uid]: {
                    ...current,
                    periods: reconciled,
                    activePeriodId: preferredActiveId || current.activePeriodId,
                  },
                },
              };
            });
          },
          (err) => reportReadError(err, 'los períodos', `users/${uid}/periods`)
        );
        unsubs.push(unsubPeriods);

        // Real-time listener for transactions
        const unsubTransactions = onSnapshot(
          collection(firestoreDb, 'users', uid, 'transactions'),
          (snap) => {
            const remoteTxs = snap.docs.flatMap((d) => {
              const data = d.data() as Transaction;
              const owned = { ...data, userId: uid };
              if (data.userId !== uid) offlineQueue.enqueue(uid, 'SAVE_TX_AND_ACCOUNTS', { transaction: owned, accounts: [] });
              return [owned];
            });

            // Reconcile with pending offline mutations
            const pendingQueue = loadQueueFromStorage(uid);
            const pendingDeletes = new Set(
              pendingQueue
                .filter((m) => m.type === 'DELETE_TX_AND_ACCOUNTS')
                .map((m) => m.payload.transactionId)
            );
            const pendingSaves = new Map<string, Transaction>(
              pendingQueue
                .filter((m) => m.type === 'SAVE_TX_AND_ACCOUNTS')
                .map((m) => [m.payload.transaction.id, m.payload.transaction])
            );

            let reconciled = remoteTxs.filter((tx) => !pendingDeletes.has(tx.id));
            reconciled = reconciled.map((tx) => {
              if (pendingSaves.has(tx.id)) {
                const localVersion = pendingSaves.get(tx.id)!;
                pendingSaves.delete(tx.id);
                return localVersion;
              }
              return tx;
            });
            for (const localTx of pendingSaves.values()) {
              reconciled.unshift(localTx);
            }

            setDb((prev) => {
              const current = prev.users[uid] || initialStore;
              return {
                ...prev,
                users: {
                  ...prev.users,
                  [uid]: {
                    ...current,
                    transactions: reconciled,
                  },
                },
              };
            });
            setRemoteTransactionsLoaded(true);
          },
          (err) => {
            console.error('No se pudieron cargar las transacciones desde Firestore:', err);
            const errorCode = (err as { code?: string }).code;
            setSyncError(`No se pudieron cargar tus transacciones desde la nube${errorCode ? ` (${errorCode})` : ''}. Revisa tu conexión.`);
            handleFirestoreError(err, OperationType.GET, `users/${uid}/transactions`);
          }
        );
        unsubs.push(unsubTransactions);

        // Real-time listener for budgets
        const unsubBudgets = onSnapshot(
          collection(firestoreDb, 'users', uid, 'budgets'),
          (snap) => {
            const remoteBudgets = normalizeOwnedDocuments<Budget>(snap.docs, uid, (budget) => {
              offlineQueue.enqueue(uid, 'SAVE_BUDGET', { budget });
            });
            const pendingQueue = loadQueueFromStorage(uid);
            const pendingDeletes = new Set(
              pendingQueue
                .filter((m) => m.type === 'DELETE_BUDGET')
                .map((m) => m.payload.budgetId)
            );
            const pendingSaves = new Map<string, Budget>(
              pendingQueue
                .filter((m) => m.type === 'SAVE_BUDGET')
                .map((m) => [m.payload.budget.id, m.payload.budget])
            );

            let reconciled = remoteBudgets.filter((b) => !pendingDeletes.has(b.id));
            reconciled = reconciled.map((b) => {
              if (pendingSaves.has(b.id)) {
                const local = pendingSaves.get(b.id)!;
                pendingSaves.delete(b.id);
                return local;
              }
              return b;
            });
            for (const localB of pendingSaves.values()) {
              reconciled.push(localB);
            }

            setDb((prev) => {
              const current = prev.users[uid] || initialStore;
              return {
                ...prev,
                users: {
                  ...prev.users,
                  [uid]: {
                    ...current,
                    budgets: reconciled,
                  },
                },
              };
            });
          },
          (err) => reportReadError(err, 'los presupuestos', `users/${uid}/budgets`)
        );
        unsubs.push(unsubBudgets);

        const unsubSettings = onSnapshot(
          collection(firestoreDb, 'users', uid, 'settings'),
          (snap) => {
            const rawSettings = snap.docs.find((d) => d.id === 'default')?.data() as Partial<UserSettings> | undefined;
            const remoteSettings = rawSettings;
            if (remoteSettings) {
              const mergedSettings = { ...initialStore.settings, ...remoteSettings, userId: uid };
              if (remoteSettings.userId !== uid) offlineQueue.enqueue(uid, 'SAVE_SETTINGS', { settings: mergedSettings });
              setDb((prev) => {
                const current = prev.users[uid] || initialStore;
                const nextActivePeriodId = mergedSettings.activePeriodId || current.activePeriodId;
                return {
                  ...prev,
                  users: {
                    ...prev.users,
                    [uid]: {
                      ...current,
                      settings: mergedSettings,
                      activePeriodId: nextActivePeriodId,
                    },
                  },
                };
              });
            }
          },
          (err) => reportReadError(err, 'la configuración', `users/${uid}/settings`)
        );
        unsubs.push(unsubSettings);
      } else {
        setRemoteTransactionsLoaded(false);
        setCurrentUserId(null);
      }
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
      unsubscribeAuth();
    };
  }, []);

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

  const resetAccountData = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUserId || !currentUserStore) {
      return { ok: false, error: 'Inicia sesión para restablecer la cuenta.' };
    }
    const isFirebaseUser = auth.currentUser?.uid === currentUserId;
    if (isFirebaseUser && typeof navigator !== 'undefined' && !navigator.onLine) {
      return { ok: false, error: 'Conéctate a internet para restablecer los datos en todos tus dispositivos.' };
    }
    if (offlineQueue.getPendingCount(currentUserId) > 0) {
      return { ok: false, error: 'Espera a que se sincronicen los cambios pendientes antes de restablecer la cuenta.' };
    }

    const cleanStore = createCleanUserStore(currentUserStore.profile);
    cleanStore.settings = { ...cleanStore.settings, ...currentUserStore.settings, userId: currentUserId };
    cleanStore.profile = currentUserStore.profile;

    try {
      if (isFirebaseUser) await resetUserFinancialData(currentUserId, cleanStore);
      const projectionPrefix = `wallet_category_projections_${currentUserId}_`;
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(projectionPrefix)) localStorage.removeItem(key);
      }
      updateCurrentUserStore(() => cleanStore);
      setSyncError(null);
      return { ok: true };
    } catch (error) {
      console.error('No se pudieron restablecer los datos de la cuenta:', error);
      return { ok: false, error: 'No se pudo restablecer la cuenta. No se actualizaron los datos en este dispositivo.' };
    }
  };

  const trackSync = (operation: Promise<void>, label: string) => {
    void operation.then(() => setSyncError(null)).catch((error) => {
      console.error(`Falló la sincronización de ${label}:`, error);
      const errorCode = (error as { code?: string })?.code;
      setSyncError(`No se pudo sincronizar ${label}${errorCode ? ` (${errorCode})` : ''}. El cambio sigue guardado en este dispositivo.`);
    });
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, error: 'Ingresa un correo electrónico válido.' };
    }
    if (!password) {
      return { ok: false, error: 'Ingresa tu contraseña.' };
    }
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.code === 'auth/invalid-credential' ? 'Correo o contraseña incorrectos.' : error?.message || 'No se pudo iniciar sesión.' };
    }
  };

  const registerUser = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
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

    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(credential.user, { displayName: cleanName });
      return { ok: true };
    } catch (error: any) {
      const message = error?.code === 'auth/email-already-in-use' ? 'Ya existe una cuenta registrada con este correo.' : error?.message || 'No se pudo crear la cuenta.';
      return { ok: false, error: message };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        setCurrentUserId(res.user.uid);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      throw err;
    }
  };

  const recoverPassword = async (email: string): Promise<{ ok: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, message: 'Ingresa un correo electrónico válido.' };
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return { ok: true, message: `Se ha enviado un enlace de recuperación de contraseña a ${cleanEmail}.` };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'No se pudo enviar el enlace de recuperación.' };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
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
    if (!currentUserStore || !currentUserId) return;
    const profile = { ...currentUserStore.profile, name: name.trim(), email: email.trim() };
    updateCurrentUserStore((store) => ({
      ...store,
      profile,
    }));
    if (auth.currentUser?.uid === currentUserId) trackSync(syncProfile(currentUserId, profile), 'el perfil');
  };

  const setThemeMode = (mode: ThemeMode) => {
    if (!currentUserId || !currentUserStore) return;
    const nextSettings = { ...currentUserStore.settings, themeMode };
    updateCurrentUserStore((store) => ({
      ...store,
      settings: nextSettings,
    }));
    if (auth.currentUser?.uid === currentUserId) trackSync(syncSettings(currentUserId, nextSettings), 'la configuración');
  };

  const toggleHideBalances = () => {
    if (!currentUserId || !currentUserStore) return;
    const nextSettings = { ...currentUserStore.settings, hideBalances: !currentUserStore.settings.hideBalances };
    updateCurrentUserStore((store) => ({
      ...store,
      settings: nextSettings,
    }));
    if (auth.currentUser?.uid === currentUserId) trackSync(syncSettings(currentUserId, nextSettings), 'la configuración');
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

    if (auth.currentUser && auth.currentUser.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_ACCOUNT', { account: newAccount });
    }

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

    const existing = currentUserStore?.accounts.find((a) => a.id === accountId);
    if (!existing) return { ok: false, error: 'La cuenta no existe.' };

    const updatedAccount: Account = {
      ...existing,
      name: cleanName,
      subtitle: input.subtitle?.trim() || undefined,
      creditLimit: existing.type === 'credit_card' ? input.creditLimit : undefined,
      cutoffDay: existing.type === 'credit_card' ? (input.cutoffDay ?? existing.cutoffDay ?? 15) : undefined,
      paymentDueDay: existing.type === 'credit_card' ? (input.paymentDueDay ?? existing.paymentDueDay ?? 5) : undefined,
      icon: input.icon,
      color: input.color,
      updatedAt: new Date().toISOString(),
    };

    updateCurrentUserStore((store) => ({
      ...store,
      accounts: store.accounts.map((acc) => (acc.id === accountId ? updatedAccount : acc)),
    }));

    if (auth.currentUser && auth.currentUser.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_ACCOUNT', { account: updatedAccount });
    }

    return { ok: true };
  };

  const toggleArchiveAccount = (accountId: string) => {
    const existing = currentUserStore?.accounts.find((acc) => acc.id === accountId);
    if (!existing) return;
    const updatedAccount = {
      ...existing,
      status: existing.status === 'active' ? ('archived' as const) : ('active' as const),
      updatedAt: new Date().toISOString(),
    };
    updateCurrentUserStore((store) => ({
      ...store,
      accounts: store.accounts.map((acc) => (acc.id === accountId ? updatedAccount : acc)),
    }));
    if (auth.currentUser?.uid === currentUserId && currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_ACCOUNT', { account: updatedAccount });
    }
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
    if (currentUserStore?.categories.some((item) => item.type === input.type && item.name.toLowerCase() === cleanName.toLowerCase())) {
      return { ok: false, error: 'Ya existe una categoría con ese nombre para este tipo.' };
    }

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

    if (auth.currentUser && auth.currentUser.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_CATEGORY', { category: newCat });
    }

    return { ok: true };
  };

  const toggleCategoryActive = (categoryId: string) => {
    const category = currentUserStore?.categories.find((item) => item.id === categoryId);
    if (!category) return;
    const updatedCategory = { ...category, isActive: !category.isActive };
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) => (c.id === categoryId ? updatedCategory : c)),
    }));
    if (auth.currentUser?.uid === currentUserId && currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_CATEGORY', { category: updatedCategory });
    }
  };

  const addSubcategory = (
    categoryId: string,
    name: string,
    icon: string
  ): { ok: boolean; error?: string } => {
    if (!currentUserId || !currentUserStore) return { ok: false, error: 'Usuario no autenticado.' };
    const cleanName = name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la subcategoría es obligatorio.' };
    const category = currentUserStore.categories.find((item) => item.id === categoryId);
    if (!category) return { ok: false, error: 'La categoría ya no existe.' };
    if (category.subcategories.some((item) => item.name.toLowerCase() === cleanName.toLowerCase())) {
      return { ok: false, error: 'Ya existe una subcategoría con ese nombre en esta categoría.' };
    }
    const updatedCategory: Category = {
      ...category,
      subcategories: [
        ...category.subcategories,
        {
          id: `sub_${Date.now()}`,
          categoryId,
          name: cleanName,
          icon: icon || '🏷️',
        },
      ],
    };
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) =>
        c.id === categoryId ? updatedCategory : c
      ),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_CATEGORY', { category: updatedCategory });
    }
    return { ok: true };
  };

  const updateCategoryName = (categoryId: string, name: string): { ok: boolean; error?: string } => {
    if (!currentUserId || !currentUserStore) return { ok: false, error: 'Usuario no autenticado.' };
    const cleanName = name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la categoría es obligatorio.' };
    const category = currentUserStore.categories.find((item) => item.id === categoryId);
    if (!category) return { ok: false, error: 'La categoría ya no existe.' };
    if (
      currentUserStore.categories.some(
        (item) => item.id !== categoryId && item.type === category.type && item.name.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      return { ok: false, error: 'Ya existe una categoría con ese nombre para este tipo.' };
    }
    const updatedCategory = { ...category, name: cleanName };
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((item) => (item.id === categoryId ? updatedCategory : item)),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_CATEGORY', { category: updatedCategory });
    }
    return { ok: true };
  };

  const updateSubcategoryName = (categoryId: string, subcategoryId: string, name: string): { ok: boolean; error?: string } => {
    if (!currentUserId || !currentUserStore) return { ok: false, error: 'Usuario no autenticado.' };
    const cleanName = name.trim();
    if (!cleanName) return { ok: false, error: 'El nombre de la subcategoría es obligatorio.' };
    const category = currentUserStore.categories.find((item) => item.id === categoryId);
    if (!category || !category.subcategories.some((item) => item.id === subcategoryId)) return { ok: false, error: 'La subcategoría ya no existe.' };
    if (category.subcategories.some((item) => item.id !== subcategoryId && item.name.toLowerCase() === cleanName.toLowerCase())) {
      return { ok: false, error: 'Ya existe una subcategoría con ese nombre en esta categoría.' };
    }
    const updatedCategory = {
      ...category,
      subcategories: category.subcategories.map((item) => (item.id === subcategoryId ? { ...item, name: cleanName } : item)),
    };
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((item) => (item.id === categoryId ? updatedCategory : item)),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_CATEGORY', { category: updatedCategory });
    }
    return { ok: true };
  };

  const removeSubcategory = (categoryId: string, subcategoryId: string): { ok: boolean; error?: string } => {
    if (!currentUserId || !currentUserStore) return { ok: false, error: 'Usuario no autenticado.' };
    if (auth.currentUser?.uid === currentUserId && !remoteTransactionsLoaded) {
      return { ok: false, error: 'Espera a que termine la sincronización antes de eliminar una subcategoría.' };
    }
    const category = currentUserStore.categories.find((item) => item.id === categoryId);
    if (!category || !category.subcategories.some((item) => item.id === subcategoryId)) return { ok: false, error: 'La subcategoría ya no existe.' };
    if (category.subcategories.length <= 1) return { ok: false, error: 'Cada categoría debe conservar al menos una subcategoría.' };
    const hasTransactions = currentUserStore.transactions.some((item) => item.subcategoryId === subcategoryId);
    const hasBudgets = currentUserStore.budgets.some((item) => item.subcategoryId === subcategoryId);
    if (hasTransactions || hasBudgets) return { ok: false, error: 'No se puede eliminar: esta subcategoría tiene transacciones o presupuestos asociados.' };
    const updatedCategory = { ...category, subcategories: category.subcategories.filter((item) => item.id !== subcategoryId) };
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.map((c) =>
        c.id === categoryId ? updatedCategory : c
      ),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_CATEGORY', { category: updatedCategory });
    }
    return { ok: true };
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
    if (!currentUserStore || !currentUserId) return;
    const updatedSettings: UserSettings = {
      ...currentUserStore.settings,
      activePeriodId: periodId,
      userId: currentUserId,
    };
    const updatedPeriods = currentUserStore.periods.map((period) => ({
      ...period,
      isActive: period.id === periodId,
      status: period.id === periodId ? ('active' as const) : period.status === 'active' ? ('closed' as const) : period.status,
    }));
    updateCurrentUserStore((store) => ({
      ...store,
      activePeriodId: periodId,
      settings: updatedSettings,
      periods: updatedPeriods,
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_SETTINGS', { settings: updatedSettings });
      for (const p of updatedPeriods) {
        offlineQueue.enqueue(currentUserId, 'SAVE_PERIOD', { period: p });
      }
    }
  };

  const createFinancialPeriod = (input: {
    name: string;
    referenceMonth: number;
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
      referenceMonth: input.referenceMonth,
      startDate: input.startDate,
      endDate: input.endDate,
      subdivisionMode: input.subdivisionMode,
      status: shouldActivate ? 'active' : 'scheduled',
      isActive: shouldActivate,
      subperiods,
      createdAt: now,
      updatedAt: now,
    };

    const updatedPeriods = [
      ...currentUserStore.periods.map((period) => shouldActivate ? { ...period, isActive: false } : period),
      newPeriod,
    ];
    const updatedTransactions = syncTransactionsWithPeriods(currentUserStore.transactions, updatedPeriods);
    updateCurrentUserStore((store) => ({
      ...store,
      periods: updatedPeriods,
      activePeriodId: shouldActivate ? newPeriodId : store.activePeriodId,
      transactions: updatedTransactions,
    }));

    if (auth.currentUser && auth.currentUser.uid === currentUserId) {
      for (const period of updatedPeriods) {
        offlineQueue.enqueue(currentUserId, 'SAVE_PERIOD', { period });
      }
      for (const tx of updatedTransactions) {
        offlineQueue.enqueue(currentUserId, 'SAVE_TX_AND_ACCOUNTS', { transaction: tx, accounts: [] });
      }
    }

    return { valid: true };
  };

  const updateFinancialPeriod = (
    periodId: string,
    input: {
      name: string;
      referenceMonth: number;
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

    const updatedPeriods = currentUserStore.periods.map((period) => period.id === periodId
      ? {
          ...period,
          name: input.name.trim(),
          referenceMonth: input.referenceMonth,
          startDate: input.startDate,
          endDate: input.endDate,
          subdivisionMode: input.subdivisionMode,
          subperiods: newSubperiods,
          updatedAt: new Date().toISOString(),
        }
      : period
    );
    const updatedTransactions = syncTransactionsWithPeriods(currentUserStore.transactions, updatedPeriods);
    updateCurrentUserStore((store) => ({ ...store, periods: updatedPeriods, transactions: updatedTransactions }));
    if (auth.currentUser?.uid === currentUserId && currentUserId) {
      for (const period of updatedPeriods) {
        offlineQueue.enqueue(currentUserId, 'SAVE_PERIOD', { period });
      }
      for (const tx of updatedTransactions) {
        offlineQueue.enqueue(currentUserId, 'SAVE_TX_AND_ACCOUNTS', { transaction: tx, accounts: [] });
      }
    }

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
    if (currentUserStore.budgets.some((budget) => budget.periodId === periodId)) {
      return { ok: false, error: 'No se puede eliminar: el período tiene presupuestos asociados.' };
    }

    const remaining = currentUserStore.periods.filter((period) => period.id !== periodId);
    const nextActiveId = currentUserStore.activePeriodId === periodId ? remaining[0].id : currentUserStore.activePeriodId;
    const updatedPeriods = remaining.map((period) => ({ ...period, isActive: period.id === nextActiveId }));
    const updatedTransactions = syncTransactionsWithPeriods(currentUserStore.transactions, updatedPeriods);
    updateCurrentUserStore((store) => ({
      ...store,
      periods: updatedPeriods,
      activePeriodId: nextActiveId,
      transactions: updatedTransactions,
    }));
    if (auth.currentUser?.uid === currentUserId && currentUserId) {
      offlineQueue.enqueue(currentUserId, 'DELETE_PERIOD', { periodId });
      for (const period of updatedPeriods) {
        offlineQueue.enqueue(currentUserId, 'SAVE_PERIOD', { period });
      }
    }

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
      createdAt: now,
      updatedAt: now,
    };

    updateCurrentUserStore((store) => {
      const updatedAccounts = applyTransactionToAccounts(newTx, store.accounts);
      if (auth.currentUser && auth.currentUser.uid === currentUserId) {
        offlineQueue.enqueue(currentUserId, 'SAVE_TX_AND_ACCOUNTS', {
          transaction: newTx,
          accounts: updatedAccounts,
        });
      }
      return {
        ...store,
        accounts: updatedAccounts,
        transactions: [newTx, ...store.transactions],
      };
    });

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
    if (existingTx.userId !== currentUserId) {
      return { valid: false, error: 'La transacción no pertenece al usuario actual.' };
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
      updatedAt: new Date().toISOString(),
    };

    updateCurrentUserStore((store) => {
      const reversedAccounts = reverseTransactionOnAccounts(existingTx, store.accounts);
      const finalAccounts = applyTransactionToAccounts(updatedTx, reversedAccounts);
      if (auth.currentUser?.uid === currentUserId) {
        offlineQueue.enqueue(currentUserId, 'SAVE_TX_AND_ACCOUNTS', {
          transaction: updatedTx,
          accounts: finalAccounts,
        });
      }
      return {
        ...store,
        accounts: finalAccounts,
        transactions: store.transactions.map((t) => (t.id === txId ? updatedTx : t)),
      };
    });

    return { valid: true };
  };

  const deleteTransaction = (txId: string) => {
    const target = currentUserStore?.transactions.find((t) => t.id === txId);
    if (!target || target.userId !== currentUserId) return;
    updateCurrentUserStore((store) => {
      const target = store.transactions.find((t) => t.id === txId);
      if (!target) return store;
      const revertedAccounts = reverseTransactionOnAccounts(target, store.accounts);
      if (auth.currentUser?.uid === currentUserId) {
        offlineQueue.enqueue(currentUserId, 'DELETE_TX_AND_ACCOUNTS', {
          transactionId: txId,
          accounts: revertedAccounts,
        });
      }
      return {
        ...store,
        accounts: revertedAccounts,
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
    if (!currentUserId || !currentUserStore) return { ok: false, error: 'Usuario no autenticado.' };
    if (input.targetAmount <= 0 || Number.isNaN(input.targetAmount)) {
      return { ok: false, error: 'El monto objetivo debe ser mayor que cero.' };
    }
    if (!input.categoryId) {
      return { ok: false, error: 'Selecciona una categoría para el presupuesto.' };
    }
    if (!currentUserStore.periods.some((period) => period.id === input.periodId)) {
      return { ok: false, error: 'El período seleccionado no pertenece a esta cuenta.' };
    }
    const category = currentUserStore.categories.find((item) => item.id === input.categoryId);
    if (!category || (input.subcategoryId && !category.subcategories.some((item) => item.id === input.subcategoryId))) {
      return { ok: false, error: 'La categoría o subcategoría seleccionada no es válida.' };
    }

    const now = new Date().toISOString();
    const existing = input.id ? currentUserStore.budgets.find((budget) => budget.id === input.id) : undefined;
    if (input.id && !existing) return { ok: false, error: 'El presupuesto no existe en esta cuenta.' };
    const budget: Budget = existing
      ? {
          ...existing,
          userId: currentUserId,
          periodId: input.periodId,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId || undefined,
          targetAmount: Math.round(input.targetAmount * 100) / 100,
          alertThreshold80: input.alertThreshold80,
          alertThreshold100: input.alertThreshold100,
          distributeBySubperiod: input.distributeBySubperiod,
          updatedAt: now,
        }
      : {
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
    updateCurrentUserStore((store) => ({
      ...store,
      budgets: existing
        ? store.budgets.map((item) => (item.id === budget.id ? budget : item))
        : [...store.budgets, budget],
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_BUDGET', { budget });
    }

    return { ok: true };
  };

  const deleteBudget = (budgetId: string) => {
    if (!currentUserId || !currentUserStore?.budgets.some((budget) => budget.id === budgetId)) return;
    updateCurrentUserStore((store) => ({
      ...store,
      budgets: store.budgets.filter((b) => b.id !== budgetId),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'DELETE_BUDGET', { budgetId });
    }
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
    if (!currentUserStore || !currentUserId) return;
    const nextSettings = {
      ...currentUserStore.settings,
      ...partial,
      userId: currentUserId,
    };
    updateCurrentUserStore((store) => ({
      ...store,
      settings: nextSettings,
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'SAVE_SETTINGS', { settings: nextSettings });
    }
  };

  const deleteCategory = (categoryId: string): { ok: boolean; error?: string } => {
    if (!currentUserId || !currentUserStore) return { ok: false, error: 'Usuario no autenticado.' };
    if (auth.currentUser?.uid === currentUserId && !remoteTransactionsLoaded) {
      return { ok: false, error: 'Espera a que termine la sincronización antes de eliminar una categoría.' };
    }
    const category = currentUserStore.categories.find((item) => item.id === categoryId);
    if (!category) return { ok: false, error: 'La categoría ya no existe.' };
    const subcategoryIds = new Set(category.subcategories.map((item) => item.id));
    const hasTransactions = currentUserStore.transactions.some((item) =>
      item.categoryId === categoryId || (!!item.subcategoryId && subcategoryIds.has(item.subcategoryId))
    );
    const hasBudgets = currentUserStore.budgets.some((item) =>
      item.categoryId === categoryId || (!!item.subcategoryId && subcategoryIds.has(item.subcategoryId))
    );
    if (hasTransactions || hasBudgets) {
      return { ok: false, error: 'No se puede eliminar: esta categoría tiene transacciones o presupuestos asociados. Puedes cambiarle el nombre.' };
    }
    updateCurrentUserStore((store) => ({
      ...store,
      categories: store.categories.filter((c) => c.id !== categoryId),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'DELETE_CATEGORY', { categoryId });
    }
    return { ok: true };
  };

  const deleteAccount = (accountId: string) => {
    if (!currentUserId || !currentUserStore?.accounts.some((account) => account.id === accountId)) return;
    const hasTransactions = currentUserStore.transactions.some((tx) =>
      tx.accountId === accountId || tx.originAccountId === accountId || tx.destinationAccountId === accountId
    );
    if (hasTransactions) {
      setSyncError('No se puede eliminar esta cuenta porque tiene transacciones asociadas.');
      return;
    }
    updateCurrentUserStore((store) => ({
      ...store,
      accounts: store.accounts.filter((a) => a.id !== accountId),
    }));
    if (auth.currentUser?.uid === currentUserId) {
      offlineQueue.enqueue(currentUserId, 'DELETE_ACCOUNT', { accountId });
    }
  };

  const forceSyncNow = async () => {
    if (currentUserId) {
      await offlineQueue.processUserQueue(currentUserId);
    }
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
        resetAccountData,
        updateUserProfile,

        settings,
        themeMode,
        resolvedTheme,
        setThemeMode,
        toggleHideBalances,
        syncError,

        isOnline,
        isSyncing,
        pendingOfflineCount,
        lastSyncTime,
        forceSyncNow,

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
        updateCategoryName,
        updateSubcategoryName,
        toggleCategoryActive,
        addSubcategory,
        removeSubcategory,
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
