import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
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
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { applyTransactionToAccounts, reverseTransactionOnAccounts, validateTransactionInput } from '../../features/transactions/financialEngine';

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

function accountFromSnapshot(data: Record<string, unknown>, id: string): Account {
  const account = { ...data, id } as unknown as Account;
  if (account.type === 'credit_card' && account.initialBalance > 0 && account.currentBalance > 0) {
    return { ...account, initialBalance: -Math.abs(account.initialBalance), currentBalance: -Math.abs(account.currentBalance) };
  }
  return account;
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
  if (account.userId !== userId) throw new Error('La cuenta no pertenece al usuario autenticado.');
  const accountRef = doc(db, 'users', userId, 'accounts', account.id);
  await runTransaction(db, async (firestoreTransaction) => {
    const existing = await firestoreTransaction.get(accountRef);
    const { balanceAdjustment, ...fields } = account as Account & { balanceAdjustment?: number };
    const latest = existing.exists() ? existing.data() as Account : undefined;
    const currentBalance = latest
      ? typeof balanceAdjustment === 'number'
        ? Math.round((latest.currentBalance + balanceAdjustment) * 100) / 100
        : latest.currentBalance
      : account.currentBalance;
    firestoreTransaction.set(accountRef, ownedRecord({ ...fields, currentBalance }, userId));
  });
}

export async function deleteAccountFromDb(userId: string, accountId: string): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('Usuario no autenticado.');
  await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
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
  if (tx.userId !== userId) throw new Error('El movimiento no pertenece al usuario autenticado.');
  await syncTransactionWithAccounts(userId, tx, []);
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
  if (tx.userId !== userId) throw new Error('El movimiento no pertenece al usuario autenticado.');
  const txRef = doc(db, 'users', userId, 'transactions', tx.id);
  await runTransaction(db, async (firestoreTransaction) => {
    const oldSnapshot = await firestoreTransaction.get(txRef);
    const previous = oldSnapshot.exists() ? { ...oldSnapshot.data(), id: oldSnapshot.id } as Transaction : undefined;
    const accountIds = new Set<string>();
    const collect = (item?: Transaction) => {
      if (!item) return;
      [item.accountId, item.originAccountId, item.destinationAccountId].forEach((id) => { if (id) accountIds.add(id); });
    };
    collect(previous);
    collect(tx);
    const accountRefs = [...accountIds].map((id) => doc(db, 'users', userId, 'accounts', id));
    const accountSnapshots = await Promise.all(accountRefs.map((ref) => firestoreTransaction.get(ref)));
    const currentAccounts = accountSnapshots.flatMap((snapshot) => snapshot.exists()
      ? [accountFromSnapshot(snapshot.data(), snapshot.id)]
      : []);
    const categoriesSnapshot = await getDocs(collection(db, 'users', userId, 'categories'));
    const categories = categoriesSnapshot.docs.map((item) => ({ ...item.data(), id: item.id } as unknown as Category));
    const validation = validateTransactionInput({
      userId, type: tx.type, amount: tx.amount, currency: tx.currency,
      accountId: tx.accountId, categoryId: tx.categoryId, subcategoryId: tx.subcategoryId,
      originAccountId: tx.originAccountId, destinationAccountId: tx.destinationAccountId, date: tx.date,
    }, currentAccounts, categories, previous);
    if (!validation.valid) throw new Error(validation.error || 'El movimiento no es válido.');
    let accounts = previous ? reverseTransactionOnAccounts(previous, currentAccounts) : currentAccounts;
    if (previous) accounts = reverseTransactionOnAccounts(previous, accounts);
    accounts = applyTransactionToAccounts(tx, accounts);
    firestoreTransaction.set(txRef, ownedRecord(tx, userId));
    for (const account of accounts) {
      firestoreTransaction.set(doc(db, 'users', userId, 'accounts', account.id), ownedRecord(account, userId));
    }
  });
}

export async function deleteTransactionFromDb(userId: string, txId: string): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('Usuario no autenticado.');
  await deleteTransactionWithAccounts(userId, txId, []);
}

/**
 * Atomically deletes a transaction and updates the reverted account balances in a single writeBatch.
 */
export async function deleteTransactionWithAccounts(
  userId: string,
  txId: string,
  accounts: Account[]
): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('Usuario no autenticado.');
  const txRef = doc(db, 'users', userId, 'transactions', txId);
  await runTransaction(db, async (firestoreTransaction) => {
    const txSnapshot = await firestoreTransaction.get(txRef);
    if (!txSnapshot.exists()) return;
    const target = { ...txSnapshot.data(), id: txSnapshot.id } as Transaction;
    if (target.userId !== userId) throw new Error('El movimiento no pertenece al usuario autenticado.');
    const ids = [target.accountId, target.originAccountId, target.destinationAccountId].filter((id): id is string => Boolean(id));
    const refs = [...new Set(ids)].map((id) => doc(db, 'users', userId, 'accounts', id));
    const snapshots = await Promise.all(refs.map((ref) => firestoreTransaction.get(ref)));
    const accounts = snapshots.flatMap((snapshot) => snapshot.exists()
      ? [accountFromSnapshot(snapshot.data(), snapshot.id)]
      : []);
    const reverted = reverseTransactionOnAccounts(target, accounts);
    firestoreTransaction.delete(txRef);
    for (const account of reverted) {
      firestoreTransaction.set(doc(db, 'users', userId, 'accounts', account.id), ownedRecord(account, userId));
    }
  });
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
      ...(hasExistingCategories ? [] : initialStore.categories.map((item): [typeof collections[number], string, InitialRecord] => ['categories', item.id, item])),
      ...(hasExistingPeriods ? [] : initialStore.periods.map((item): [typeof collections[number], string, InitialRecord] => ['periods', item.id, item])),
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

/** Borra los datos financieros del usuario y vuelve a crear el conjunto inicial. */
export async function resetUserFinancialData(userId: string, initialStore: UserDataStore): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('Usuario no autenticado.');
  const collectionNames = ['settings', 'categories', 'periods', 'budgets'] as const;
  const snapshots = await Promise.all(
    collectionNames.map((name) => getDocs(collection(db, 'users', userId, name)))
  );

  let batch = writeBatch(db);
  let pendingDeletes = 0;
  for (const snapshot of snapshots) {
    for (const item of snapshot.docs) {
      batch.delete(item.ref);
      pendingDeletes += 1;
      if (pendingDeletes >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        pendingDeletes = 0;
      }
    }
  }
  if (pendingDeletes > 0) await batch.commit();

  await seedUserInitialData(userId, initialStore);
}
