import assert from 'node:assert/strict';
import test from 'node:test';
import { Account, Transaction } from '../../core/types/models';
import {
  applyTransactionToAccounts,
  recalculateAccountBalances,
  reconcileAccountBalances,
  saveTransactionToAccounts,
} from './financialEngine';

const now = '2026-10-09T12:00:00.000Z';

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_cash',
    userId: 'usr_test',
    name: 'Efectivo',
    type: 'cash',
    currency: 'GTQ',
    initialBalance: 1000,
    currentBalance: 1000,
    status: 'active',
    icon: 'Wallet',
    color: '#10B981',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    userId: 'usr_test',
    type: 'expense',
    amount: 100,
    currency: 'GTQ',
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    subcategoryId: 'sub_super',
    date: '2026-10-09',
    time: '12:00',
    note: 'Prueba',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('saveTransactionToAccounts updates an existing expense without double reversing it', () => {
  const originalTx = transaction({ amount: 100 });
  const updatedTx = transaction({ amount: 120, updatedAt: '2026-10-09T12:05:00.000Z' });
  const storedAccounts = applyTransactionToAccounts(originalTx, [account()]);

  const result = saveTransactionToAccounts(updatedTx, storedAccounts, originalTx);

  assert.equal(result[0].currentBalance, 880);
});

test('saveTransactionToAccounts is idempotent when the same transaction is saved again', () => {
  const originalTx = transaction({ amount: 100 });
  const storedAccounts = applyTransactionToAccounts(originalTx, [account()]);

  const result = saveTransactionToAccounts(originalTx, storedAccounts, originalTx);

  assert.equal(result[0].currentBalance, 900);
});

test('recalculateAccountBalances rebuilds expected balances from initial balances and transactions', () => {
  const accounts = [
    account({ id: 'acc_cash', initialBalance: 1000, currentBalance: 9999 }),
    account({ id: 'acc_bank', name: 'Banco', type: 'bank', initialBalance: 500, currentBalance: 9999 }),
  ];
  const transactions = [
    transaction({ id: 'tx_expense', type: 'expense', amount: 125, accountId: 'acc_cash' }),
    transaction({
      id: 'tx_income',
      type: 'income',
      amount: 200,
      accountId: 'acc_bank',
      categoryId: 'cat_salary',
      subcategoryId: 'sub_salary',
    }),
    transaction({
      id: 'tx_transfer',
      type: 'transfer',
      amount: 50,
      accountId: undefined,
      categoryId: undefined,
      subcategoryId: undefined,
      originAccountId: 'acc_bank',
      destinationAccountId: 'acc_cash',
      note: 'Transferencia',
    }),
  ];

  const result = recalculateAccountBalances(accounts, transactions);

  assert.equal(result.find((item) => item.id === 'acc_cash')?.currentBalance, 925);
  assert.equal(result.find((item) => item.id === 'acc_bank')?.currentBalance, 650);
});

test('reconcileAccountBalances reports accounts that differ from recalculated balances', () => {
  const accounts = [account({ initialBalance: 1000, currentBalance: 980 })];
  const transactions = [transaction({ amount: 100 })];

  const result = reconcileAccountBalances(accounts, transactions);

  assert.deepEqual(result, [
    {
      accountId: 'acc_cash',
      currentBalance: 980,
      expectedBalance: 900,
      difference: -80,
      needsUpdate: true,
    },
  ]);
});
