import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Transaction as FirestoreTransaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const app = initializeApp();
const db = getFirestore(app, 'ai-studio-walletv1-cde1c2b5-f2a2-489f-8062-58e6963a288b');
const region = 'us-central1';
type Data = Record<string, any>;

function uidOf(request: { auth?: { uid: string } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return request.auth.uid;
}

function object(value: unknown, label: string): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', `${label} no es válido.`);
  }
  return value as Data;
}

function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', `${label} no es válido.`);
  }
  return value;
}

function text(value: unknown, label: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `${label} es obligatorio y debe tener hasta ${max} caracteres.`);
  }
  return value.trim();
}

function amount(value: unknown, label: string, allowZero = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000 || (!allowZero && value === 0)) {
    throw new HttpsError('invalid-argument', `${label} debe ser un monto válido.`);
  }
  return Math.round(value * 100) / 100;
}

function signedBalance(type: string, value: number): number {
  if (!Number.isFinite(value)) throw new HttpsError('invalid-argument', 'El saldo no es válido.');
  return type === 'credit_card'
    ? -amount(Math.abs(value), 'La deuda inicial')
    : amount(value, 'El saldo inicial');
}

function round(value: number): number { return Math.round(value * 100) / 100; }

function transactionAccountIds(tx: Data): string[] {
  if (tx.type === 'transfer') {
    const origin = id(tx.originAccountId ?? tx.accountId, 'Cuenta de origen');
    const destination = id(tx.destinationAccountId, 'Cuenta de destino');
    if (origin === destination) throw new HttpsError('invalid-argument', 'Las cuentas de transferencia deben ser distintas.');
    return [...new Set([origin, destination])];
  }
  if (tx.type !== 'expense' && tx.type !== 'income') throw new HttpsError('invalid-argument', 'Tipo de movimiento no válido.');
  return [id(tx.accountId, 'Cuenta')];
}

function validateTransactionShape(tx: Data): void {
  amount(tx.amount, 'El monto', false);
  if (tx.amount > 1_000_000_000) throw new HttpsError('invalid-argument', 'El monto excede el máximo permitido.');
  const parsedDate = typeof tx.date === 'string' ? new Date(`${tx.date}T00:00:00Z`) : null;
  if (typeof tx.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)
      || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== tx.date) {
    throw new HttpsError('invalid-argument', 'La fecha del movimiento no es válida.');
  }
  transactionAccountIds(tx);
  if (tx.type !== 'transfer') id(tx.categoryId, 'Categoría');
}

function deltas(tx: Data, direction: 1 | -1): Map<string, number> {
  const result = new Map<string, number>();
  const add = (accountId: string, value: number) => result.set(accountId, (result.get(accountId) || 0) + value * direction);
  if (tx.type === 'expense') add(tx.accountId, -tx.amount);
  else if (tx.type === 'income') add(tx.accountId, tx.amount);
  else {
    add(tx.originAccountId ?? tx.accountId, -tx.amount);
    add(tx.destinationAccountId, tx.amount);
  }
  return result;
}

async function applyTransaction(request: any, deleting: boolean): Promise<{ ok: true }> {
  const uid = uidOf(request);
  const input = object(request.data, 'Movimiento');
  const txId = id(deleting ? input.transactionId : input.transaction?.id, 'Identificador del movimiento');
  const txRef = db.doc(`users/${uid}/transactions/${txId}`);
  const inputTx: Data | null = deleting ? null : { ...object(input.transaction, 'Movimiento'), id: txId, userId: uid };
  if (inputTx) validateTransactionShape(inputTx);

  await db.runTransaction(async (firestoreTx: FirestoreTransaction) => {
    const previousSnap = await firestoreTx.get(txRef);
    const previous = previousSnap.exists ? previousSnap.data()! : null;
    if (deleting && !previous) return;

    const ids = new Set<string>([
      ...(previous ? transactionAccountIds(previous) : []),
      ...(inputTx ? transactionAccountIds(inputTx) : []),
    ]);
    const inputAccountIds = new Set(inputTx ? transactionAccountIds(inputTx) : []);
    const accountRefs = new Map([...ids].map((accountId) => [accountId, db.doc(`users/${uid}/accounts/${accountId}`)]));
    const accountSnaps = new Map<string, any>();
    for (const [accountId, ref] of accountRefs) accountSnaps.set(accountId, await firestoreTx.get(ref));
    let category: Data | undefined;
    if (inputTx && inputTx.type !== 'transfer') {
      const catId = id(inputTx.categoryId, 'Categoría');
      const categorySnap = await firestoreTx.get(db.doc(`users/${uid}/categories/${catId}`));
      category = categorySnap.exists ? categorySnap.data() : undefined;
      const expectedType = inputTx.type === 'expense' ? 'expense' : 'income';
      if (!category || category.userId !== uid || category.type !== expectedType || category.isActive === false) {
        throw new HttpsError('failed-precondition', 'La categoría no existe, está inactiva o no corresponde al movimiento.');
      }
      if (inputTx.subcategoryId && !(category.subcategories || []).some((item: Data) => item.id === inputTx.subcategoryId)) {
        throw new HttpsError('failed-precondition', 'La subcategoría no pertenece a la categoría seleccionada.');
      }
    }

    const balances = new Map<string, number>();
    const accounts = new Map<string, Data>();
    for (const [accountId, snap] of accountSnaps) {
      if (!snap.exists) throw new HttpsError('failed-precondition', 'Una cuenta del movimiento ya no existe.');
      const account = snap.data()!;
      if (inputAccountIds.has(accountId) && account.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Selecciona cuentas activas que pertenezcan a tu perfil.');
      }
      accounts.set(accountId, account);
      const storedBalance = Number(account.currentBalance ?? account.balance ?? 0);
      if (!Number.isFinite(storedBalance)) throw new HttpsError('failed-precondition', 'El saldo guardado de una cuenta no es válido.');
      const legacyPositiveDebt = account.type === 'credit_card'
        && Number(account.initialBalance) > 0 && storedBalance > 0;
      const canonicalAccount = { ...account, id: accountId, userId: uid };
      accounts.set(accountId, legacyPositiveDebt
        ? { ...canonicalAccount, initialBalance: -Math.abs(Number(account.initialBalance)) }
        : canonicalAccount);
      balances.set(accountId, legacyPositiveDebt ? -Math.abs(storedBalance) : storedBalance);
    }

    if (previous) {
      for (const [accountId, delta] of deltas(previous, -1)) balances.set(accountId, round((balances.get(accountId) || 0) + delta));
    }
    if (inputTx) {
      if (inputTx.type === 'expense') {
        const accountId = inputTx.accountId;
        const account = accounts.get(accountId)!;
        if (account.type === 'credit_card' && Number(account.creditLimit) > 0) {
          const debt = Math.max(0, -(balances.get(accountId) || 0));
          if (debt + inputTx.amount > Number(account.creditLimit)) {
            throw new HttpsError('failed-precondition', `El gasto excede el crédito disponible de ${account.name}.`);
          }
        }
      }
      for (const [accountId, delta] of deltas(inputTx, 1)) balances.set(accountId, round((balances.get(accountId) || 0) + delta));
      firestoreTx.set(txRef, { ...inputTx, amount: amount(inputTx.amount, 'El monto', false), updatedAt: new Date().toISOString() });
    } else {
      firestoreTx.delete(txRef);
    }

    for (const [accountId, balance] of balances) {
      const account = accounts.get(accountId)!;
      firestoreTx.set(accountRefs.get(accountId)!, { ...account, currentBalance: balance, updatedAt: new Date().toISOString() });
    }
  });
  return { ok: true };
}

export const saveAccount = onCall({ region }, async (request) => {
  const uid = uidOf(request);
  const input = object(request.data?.account, 'Cuenta');
  const accountId = id(input.id, 'Identificador de cuenta');
  const name = text(input.name, 'El nombre de cuenta');
  const type = input.type;
  if (!['cash', 'bank', 'savings', 'credit_card'].includes(type)) throw new HttpsError('invalid-argument', 'Tipo de cuenta no válido.');
  const ref = db.doc(`users/${uid}/accounts/${accountId}`);
  const tombstoneRef = db.doc(`users/${uid}/accountTombstones/${accountId}`);
  await db.runTransaction(async (tx) => {
    const [currentSnap, tombstoneSnap] = await tx.getAll(ref, tombstoneRef);
    if (tombstoneSnap.exists) throw new HttpsError('failed-precondition', 'Esta cuenta fue eliminada. Actualiza los datos y crea una cuenta nueva.');
    const current = currentSnap.exists ? currentSnap.data()! : null;
    if (current?.type && current.type !== type) throw new HttpsError('failed-precondition', 'No se puede cambiar el tipo de una cuenta existente.');
    const now = new Date().toISOString();
    const creditLimit = input.creditLimit == null ? undefined : amount(input.creditLimit, 'El límite de crédito');
    if (type === 'credit_card' && (!creditLimit || creditLimit <= 0)) throw new HttpsError('invalid-argument', 'La tarjeta debe tener un límite de crédito mayor que cero.');
    let currentBalance: number;
    if (!current) {
      currentBalance = signedBalance(type, Number(input.currentBalance ?? input.initialBalance ?? 0));
    } else {
      const adjustment = input.balanceAdjustment == null ? 0 : Number(input.balanceAdjustment);
      if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 1_000_000_000) throw new HttpsError('invalid-argument', 'El ajuste de saldo no es válido.');
      const storedBalance = Number(current.currentBalance ?? current.balance ?? 0);
      if (!Number.isFinite(storedBalance)) throw new HttpsError('failed-precondition', 'El saldo guardado de la cuenta no es válido.');
      const legacyPositiveDebt = type === 'credit_card' && Number(current.initialBalance) > 0 && storedBalance > 0;
      const canonicalBalance = legacyPositiveDebt ? -Math.abs(storedBalance) : storedBalance;
      currentBalance = round(canonicalBalance + adjustment);
      if (legacyPositiveDebt) current.initialBalance = -Math.abs(Number(current.initialBalance));
      if (type === 'credit_card' && adjustment !== 0) currentBalance = -Math.abs(amount(-currentBalance, 'La deuda'));
    }
    const storedInitialBalance = current ? Number(current.initialBalance ?? 0) : signedBalance(type, Number(input.initialBalance ?? input.currentBalance ?? 0));
    const initialBalance = type === 'credit_card' && storedInitialBalance > 0
      && (current?.type === 'credit_card' ? Number(current.currentBalance ?? current.balance ?? 0) > 0 : true)
      ? -Math.abs(storedInitialBalance)
      : storedInitialBalance;
    const account = {
      ...(current || {}), id: accountId, userId: uid, name,
      subtitle: typeof input.subtitle === 'string' && input.subtitle.trim() ? input.subtitle.trim() : null,
      type, currency: text(input.currency || 'GTQ', 'La moneda', 8),
      initialBalance, currentBalance, creditLimit: type === 'credit_card' ? creditLimit : null,
      status: input.status === 'archived' ? 'archived' : 'active',
      icon: typeof input.icon === 'string' ? input.icon.slice(0, 32) : 'Landmark',
      color: typeof input.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#10B981',
      cutoffDay: type === 'credit_card' ? Math.min(31, Math.max(1, Number(input.cutoffDay) || 15)) : null,
      paymentDueDay: type === 'credit_card' ? Math.min(31, Math.max(1, Number(input.paymentDueDay) || 5)) : null,
      createdAt: current?.createdAt || now, updatedAt: now,
    };
    tx.set(ref, account);
  });
  return { ok: true };
});

export const deleteAccount = onCall({ region }, async (request) => {
  const uid = uidOf(request);
  const accountId = id(request.data?.accountId, 'Identificador de cuenta');
  const ref = db.doc(`users/${uid}/accounts/${accountId}`);
  const tombstoneRef = db.doc(`users/${uid}/accountTombstones/${accountId}`);
  await db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(ref);
    if (!accountSnap.exists) {
      tx.set(tombstoneRef, { userId: uid, deletedAt: new Date().toISOString() });
      return;
    }
    const data = accountSnap.data()!;
    const checks = [
      await tx.get(db.collection(`users/${uid}/transactions`).where('accountId', '==', accountId).limit(1)),
      await tx.get(db.collection(`users/${uid}/transactions`).where('originAccountId', '==', accountId).limit(1)),
      await tx.get(db.collection(`users/${uid}/transactions`).where('destinationAccountId', '==', accountId).limit(1)),
    ];
    if (checks.some((snapshot) => !snapshot.empty)) throw new HttpsError('failed-precondition', 'No se puede eliminar una cuenta con movimientos asociados. Archívala.');
    tx.delete(ref);
    tx.set(tombstoneRef, { userId: uid, deletedAt: new Date().toISOString() });
  });
  return { ok: true };
});

export const saveTransaction = onCall({ region }, (request) => applyTransaction(request, false));
export const deleteTransaction = onCall({ region }, (request) => applyTransaction(request, true));

export const clearFinancialAccountsAndTransactions = onCall({ region }, async (request) => {
  const uid = uidOf(request);
  const accountSnapshot = await db.collection(`users/${uid}/accounts`).get();
  for (let i = 0; i < accountSnapshot.docs.length; i += 200) {
    const batch = db.batch();
    for (const account of accountSnapshot.docs.slice(i, i + 200)) {
      batch.delete(account.ref);
      batch.set(db.doc(`users/${uid}/accountTombstones/${account.id}`), {
        userId: uid,
        deletedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
  const transactions = await db.collection(`users/${uid}/transactions`).get();
  for (let i = 0; i < transactions.docs.length; i += 400) {
      const batch = db.batch();
      for (const item of transactions.docs.slice(i, i + 400)) batch.delete(item.ref);
      await batch.commit();
  }
  return { ok: true };
});
