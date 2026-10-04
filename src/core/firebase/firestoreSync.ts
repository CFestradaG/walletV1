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
    if (existing.exists()) {
      return; // Already initialized in Firestore
    }

    const batch = writeBatch(db);

    // 1. User Profile
    batch.set(userDocRef, initialStore.profile);

    // 2. Settings
    batch.set(doc(db, 'users', userId, 'settings', 'default'), initialStore.settings);

    // 3. Accounts
    for (const acc of initialStore.accounts) {
      batch.set(doc(db, 'users', userId, 'accounts', acc.id), acc);
    }

    // 4. Categories
    for (const cat of initialStore.categories) {
      batch.set(doc(db, 'users', userId, 'categories', cat.id), cat);
    }

    // 5. Periods
    for (const per of initialStore.periods) {
      batch.set(doc(db, 'users', userId, 'periods', per.id), per);
    }

    // 6. Transactions
    for (const tx of initialStore.transactions) {
      batch.set(doc(db, 'users', userId, 'transactions', tx.id), tx);
    }

    // 7. Budgets
    for (const b of initialStore.budgets) {
      batch.set(doc(db, 'users', userId, 'budgets', b.id), b);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
