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

export async function syncProfile(userId: string, profile: UserProfile): Promise<void> {
  const path = `users/${userId}`;
  try {
    await setDoc(doc(db, 'users', userId), profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncSettings(userId: string, settings: UserSettings): Promise<void> {
  const path = `users/${userId}/settings/default`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'default'), settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncAccount(userId: string, account: Account): Promise<void> {
  const path = `users/${userId}/accounts/${account.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'accounts', account.id), account);
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
    await setDoc(doc(db, 'users', userId, 'categories', category.id), category);
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
    await setDoc(doc(db, 'users', userId, 'periods', period.id), period);
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
    await setDoc(doc(db, 'users', userId, 'transactions', tx.id), tx);
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

export async function syncBudget(userId: string, budget: Budget): Promise<void> {
  const path = `users/${userId}/budgets/${budget.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'budgets', budget.id), budget);
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
    const batch = writeBatch(db);
    if (!existing.exists()) batch.set(userDocRef, initialStore.profile);
    const seedIfMissing = <T extends { id?: string }>(name: typeof collections[number], id: string, data: T) => {
      if (!existingIds[collections.indexOf(name)].has(id)) {
        batch.set(doc(db, 'users', userId, name, id), data);
      }
    };
    seedIfMissing('settings', 'default', initialStore.settings);
    initialStore.accounts.forEach((item) => seedIfMissing('accounts', item.id, item));
    initialStore.categories.forEach((item) => seedIfMissing('categories', item.id, item));
    initialStore.periods.forEach((item) => seedIfMissing('periods', item.id, item));
    initialStore.transactions.forEach((item) => seedIfMissing('transactions', item.id, item));
    initialStore.budgets.forEach((item) => seedIfMissing('budgets', item.id, item));

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
