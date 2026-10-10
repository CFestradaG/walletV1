import {
  deleteAccountFromDb,
  deleteBudgetFromDb,
  deleteCategoryFromDb,
  deletePeriodFromDb,
  deleteTransactionWithAccounts,
  syncAccount,
  syncBudget,
  syncAnnualProjections,
  seedAnnualProjectionsIfMissing,
  syncCategory,
  syncPeriod,
  syncSecurityPreferences,
  syncSettings,
  syncTransactionWithAccounts,
} from '../firebase/firestoreSync';

export type MutationType =
  | 'SAVE_TX_AND_ACCOUNTS'
  | 'DELETE_TX_AND_ACCOUNTS'
  | 'SAVE_ACCOUNT'
  | 'DELETE_ACCOUNT'
  | 'SAVE_CATEGORY'
  | 'DELETE_CATEGORY'
  | 'SAVE_PERIOD'
  | 'DELETE_PERIOD'
  | 'SAVE_BUDGET'
  | 'DELETE_BUDGET'
  | 'SAVE_SETTINGS'
  | 'SAVE_SECURITY_PREFERENCES'
  | 'SAVE_ANNUAL_PROJECTIONS'
  | 'MIGRATE_ANNUAL_PROJECTIONS';

export interface OfflineMutation {
  id: string;
  userId: string;
  type: MutationType;
  payload: any;
  createdAt: number;
  retries: number;
  lastAttemptAt?: number;
  error?: string;
}

const QUEUE_STORAGE_PREFIX = 'wallet_offline_queue_v1_';

export function getQueueStorageKey(userId: string): string {
  return `${QUEUE_STORAGE_PREFIX}${userId}`;
}

export function loadQueueFromStorage(userId: string): OfflineMutation[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getQueueStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading offline queue for user:', userId, e);
    return [];
  }
}

export function saveQueueToStorage(userId: string, queue: OfflineMutation[]): void {
  if (!userId) return;
  try {
    if (queue.length === 0) {
      localStorage.removeItem(getQueueStorageKey(userId));
    } else {
      localStorage.setItem(getQueueStorageKey(userId), JSON.stringify(queue));
    }
  } catch (e) {
    console.error('Error saving offline queue for user:', userId, e);
  }
}

type QueueListener = (status: {
  isProcessing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
}) => void;

export interface QueueProcessResult {
  pendingCount: number;
  lastError: string | null;
}

class OfflineQueueManager {
  private processingUsers = new Set<string>();
  private listeners = new Set<QueueListener>();
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processAllQueues();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.processAllQueues();
        }
      });
      // Safety periodic poll every 30s to re-try failed or queued mutations
      setInterval(() => {
        if (navigator.onLine) {
          this.processAllQueues();
        }
      }, 30000);
    }
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(isProcessing: boolean, pendingCount: number) {
    for (const listener of this.listeners) {
      try {
        listener({
          isProcessing,
          pendingCount,
          lastSyncTime: this.lastSyncTime,
          lastError: this.lastError,
        });
      } catch (err) {
        console.error('Error in queue listener', err);
      }
    }
  }

  public enqueue(
    userId: string,
    type: MutationType,
    payload: any
  ): OfflineMutation {
    const queue = loadQueueFromStorage(userId);
    const mutation: OfflineMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      type,
      payload,
      createdAt: Date.now(),
      retries: 0,
    };

    queue.push(mutation);
    saveQueueToStorage(userId, queue);
    this.notify(this.processingUsers.has(userId), queue.length);

    // Fire processing attempt immediately
    void this.processUserQueue(userId);

    return mutation;
  }

  public getPendingCount(userId: string): number {
    return loadQueueFromStorage(userId).length;
  }

  public async processUserQueue(userId: string): Promise<QueueProcessResult> {
    if (!userId) return { pendingCount: 0, lastError: null };
    if (this.processingUsers.has(userId)) {
      return { pendingCount: this.getPendingCount(userId), lastError: this.lastError };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const q = loadQueueFromStorage(userId);
      this.notify(false, q.length);
      return { pendingCount: q.length, lastError: 'Sin conexión a internet.' };
    }

    this.processingUsers.add(userId);
    let queue = loadQueueFromStorage(userId);
    this.notify(true, queue.length);

    try {
      while (queue.length > 0) {
        const item = queue[0];
        try {
          await this.executeMutation(item);
          // Mutation executed successfully: pop from queue
          queue.shift();
          saveQueueToStorage(userId, queue);
          this.lastSyncTime = Date.now();
          this.lastError = null;
          this.notify(true, queue.length);
        } catch (error: any) {
          console.error(`Failed to process offline mutation ${item.type}:`, error);
          item.retries += 1;
          item.lastAttemptAt = Date.now();
          item.error = error?.message || String(error);
          this.lastError = item.error || 'Error de sincronización';

          // If network is offline or transient connection issue, pause processing queue
          if (
            !navigator.onLine ||
            error?.code === 'unavailable' ||
            error?.message?.includes('network') ||
            error?.message?.includes('offline')
          ) {
            saveQueueToStorage(userId, queue);
            break;
          }

          // For permanent errors, remove from the queue to prevent blocking (INT-03)
          console.error('Permanent error encountered, discarding mutation from queue to unblock.', item);
          queue.shift();
          saveQueueToStorage(userId, queue);
          continue;
        }
      }
    } finally {
      this.processingUsers.delete(userId);
      queue = loadQueueFromStorage(userId);
      this.notify(false, queue.length);
    }
    return { pendingCount: this.getPendingCount(userId), lastError: this.lastError };
  }

  private async executeMutation(item: OfflineMutation): Promise<void> {
    const { userId, type, payload } = item;
    switch (type) {
      case 'SAVE_TX_AND_ACCOUNTS':
        await syncTransactionWithAccounts(userId, payload.transaction, payload.accounts);
        break;
      case 'DELETE_TX_AND_ACCOUNTS':
        await deleteTransactionWithAccounts(userId, payload.transactionId, payload.accounts);
        break;
      case 'SAVE_ACCOUNT':
        await syncAccount(userId, payload.account);
        break;
      case 'DELETE_ACCOUNT':
        await deleteAccountFromDb(userId, payload.accountId);
        break;
      case 'SAVE_CATEGORY':
        await syncCategory(userId, payload.category);
        break;
      case 'DELETE_CATEGORY':
        await deleteCategoryFromDb(userId, payload.categoryId);
        break;
      case 'SAVE_PERIOD':
        await syncPeriod(userId, payload.period);
        break;
      case 'DELETE_PERIOD':
        await deletePeriodFromDb(userId, payload.periodId);
        break;
      case 'SAVE_BUDGET':
        await syncBudget(userId, payload.budget);
        break;
      case 'DELETE_BUDGET':
        await deleteBudgetFromDb(userId, payload.budgetId);
        break;
      case 'SAVE_SETTINGS':
        await syncSettings(userId, payload.settings);
        break;
      case 'SAVE_SECURITY_PREFERENCES':
        await syncSecurityPreferences(userId, payload.preferences);
        break;
      case 'SAVE_ANNUAL_PROJECTIONS':
        await syncAnnualProjections(userId, payload.plan);
        break;
      case 'MIGRATE_ANNUAL_PROJECTIONS':
        await seedAnnualProjectionsIfMissing(userId, payload.plan);
        break;
      default:
        console.warn(`Unknown mutation type: ${type}`);
    }
  }

  public processAllQueues(): void {
    if (typeof localStorage === 'undefined') return;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(QUEUE_STORAGE_PREFIX)) {
        const userId = key.substring(QUEUE_STORAGE_PREFIX.length);
        if (userId) {
          void this.processUserQueue(userId);
        }
      }
    }
  }
}

export const offlineQueue = new OfflineQueueManager();
