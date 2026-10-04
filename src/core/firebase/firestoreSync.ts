import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  Account,
  Budget,
  Category,
  FinancialPeriod,
  Transaction,
  UserProfile,
  UserSettings,
} from '../types/models';
import { UserDataStore } from '../data/initialData';
import { db, handleFirestoreError, OperationType } from './firebase';

type InitialRecord = UserSettings | Account | Category | FinancialPeriod | Transaction | Budget;

function sanitizeFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreValue(item)) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitizeFirestoreValue(item)])
    ) as T;
  }
  return value;
}

function ownedRecord<T extends object>(record: T, userId: string): T & { userId: string } {
  return sanitizeFirestoreValue({ ...record, userId }) as T & { userId: string };
}

export async function syncProfile(userId: string, profile: UserProfile): Promise<void> {
  const path = `users/${userId}`;
  try {
    await setDoc(doc(db, 'users', userId), sanitizeFirestoreValue({ ...profile, id: userId }), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncSettings(userId: string, settings: UserSettings): Promise<void> {
  const path = `users/${userId}/settings/default`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'default'), ownedRecord(settings, userId), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncAccount(userId: string, account: Account): Promise<void> {
  const path = `users/${userId}/accounts/${account.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'accounts', account.id), ownedRecord(account, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAccountFromDb(userId: string, accountId: string): Promise<void> {
  const path = `users/${userId}/accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncCategory(userId: string, category: Category): Promise<void> {
  const path = `users/${userId}/categories/${category.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'categories', category.id), ownedRecord(category, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromDb(userId: string, categoryId: string): Promise<void> {
  const path = `users/${userId}/categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncPeriod(userId: string, period: FinancialPeriod): Promise<void> {
  const path = `users/${userId}/periods/${period.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'periods', period.id), ownedRecord(period, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePeriodFromDb(userId: string, periodId: string): Promise<void> {
  const path = `users/${userId}/periods/${periodId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'periods', periodId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncTransaction(userId: string, tx: Transaction): Promise<void> {
  const path = `users/${userId}/transactions/${tx.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'transactions', tx.id), ownedRecord(tx, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Atomically commits a transaction and all affected accounts in a single Firestore writeBatch.
 * Guarantees that neither accounts nor the transaction get out-of-sync on Firestore.
 */
export async function syncTransactionWithAccounts(
  userId: string,
  tx: Transaction,
  accounts: Account[]
): Promise<void> {
  const path = `users/${userId}/transactions/${tx.id}`;
  try {
    const batch = writeBatch(db);
    // Write transaction
    const txRef = doc(db, 'users', userId, 'transactions', tx.id);
    batch.set(txRef, ownedRecord(tx, userId));
    // Write accounts
    for (const account of accounts) {
      const accRef = doc(db, 'users', userId, 'accounts', account.id);
      batch.set(accRef, ownedRecord(account, userId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTransactionFromDb(userId: string, txId: string): Promise<void> {
  const path = `users/${userId}/transactions/${txId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'transactions', txId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Atomically deletes a transaction and updates the reverted account balances in a single writeBatch.
 */
export async function deleteTransactionWithAccounts(
  userId: string,
  txId: string,
  accounts: Account[]
): Promise<void> {
  const path = `users/${userId}/transactions/${txId}`;
  try {
    const batch = writeBatch(db);
    const txRef = doc(db, 'users', userId, 'transactions', txId);
    batch.delete(txRef);
    for (const account of accounts) {
      const accRef = doc(db, 'users', userId, 'accounts', account.id);
      batch.set(accRef, ownedRecord(account, userId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncBudget(userId: string, budget: Budget): Promise<void> {
  const path = `users/${userId}/budgets/${budget.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'budgets', budget.id), ownedRecord(budget, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBudgetFromDb(userId: string, budgetId: string): Promise<void> {
  const path = `users/${userId}/budgets/${budgetId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'budgets', budgetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedUserInitialData(userId: string, initialStore: UserDataStore): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    const existing = await getDoc(userDocRef);
    const collections = ['settings', 'accounts', 'categories', 'periods', 'transactions', 'budgets'] as const;
    const existingDocs = await Promise.all(collections.map((name) => getDocs(collection(db, 'users', userId, name))));
    const existingIds = existingDocs.map((snapshot) => new Set(snapshot.docs.map((item) => item.id)));
    let batch = writeBatch(db);
    let pendingWrites = 0;
    const commitBatchIfFull = async () => {
      if (pendingWrites < 450) return;
      await batch.commit();
      batch = writeBatch(db);
      pendingWrites = 0;
    };
    if (!existing.exists()) {
      batch.set(userDocRef, sanitizeFirestoreValue({ ...initialStore.profile, id: userId }));
      pendingWrites += 1;
    }
    const seedIfMissing = (name: typeof collections[number], id: string, data: InitialRecord) => {
      if (!existingIds[collections.indexOf(name)].has(id)) {
        batch.set(doc(db, 'users', userId, name, id), ownedRecord(data, userId));
        pendingWrites += 1;
      }
    };
    const hasExistingPeriods = existingDocs[collections.indexOf('periods')].docs.length > 0;
    const hasExistingCategories = existingDocs[collections.indexOf('categories')].docs.length > 0;

    const records: [typeof collections[number], string, InitialRecord][] = [
      ['settings', 'default', initialStore.settings],
      ...initialStore.accounts.map((item): [typeof collections[number], string, InitialRecord] => ['accounts', item.id, item]),
      ...(hasExistingCategories ? [] : initialStore.categories.map((item): [typeof collections[number], string, InitialRecord] => ['categories', item.id, item])),
      ...(hasExistingPeriods ? [] : initialStore.periods.map((item): [typeof collections[number], string, InitialRecord] => ['periods', item.id, item])),
      ...initialStore.transactions.map((item): [typeof collections[number], string, InitialRecord] => ['transactions', item.id, item]),
      ...initialStore.budgets.map((item): [typeof collections[number], string, InitialRecord] => ['budgets', item.id, item]),
    ];
    for (const [name, id, data] of records) {
      seedIfMissing(name, id, data);
      await commitBatchIfFull();
    }

    if (pendingWrites > 0) await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
