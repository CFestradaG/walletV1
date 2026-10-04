import {
  Account,
  Budget,
  Category,
  FinancialPeriod,
  Transaction,
  TransactionType,
} from '../../core/types/models';
import { isValidISODateString, resolveTransactionPeriod } from '../financial_periods/periodEngine';

export interface TransactionValidationResult {
  valid: boolean;
  error?: string;
}

export interface PortfolioSummary {
  availableMoney: number;
  totalDebt: number;
  rawDebtBalance: number;
  netBalance: number;
  activeLiquidAccountsCount: number;
  activeCreditCardsCount: number;
}

export interface PeriodFinancialSummary {
  periodId?: string;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  totalTransfers: number;
  totalCardPayments: number;
  transactionCount: number;
}

export function calculatePortfolioSummary(accounts: Account[]): PortfolioSummary {
  const activeAccounts = accounts.filter((a) => a.status === 'active');

  let availableMoney = 0;
  let rawDebtBalance = 0;
  let activeLiquidAccountsCount = 0;
  let activeCreditCardsCount = 0;

  for (const acc of activeAccounts) {
    if (acc.type === 'credit_card') {
      activeCreditCardsCount++;
      if (acc.currentBalance < 0) {
        rawDebtBalance += acc.currentBalance;
      }
    } else {
      activeLiquidAccountsCount++;
      availableMoney += acc.currentBalance;
    }
  }

  const totalDebt = Math.abs(rawDebtBalance);
  const netBalance = Math.round((availableMoney - totalDebt) * 100) / 100;

  return {
    availableMoney: Math.round(availableMoney * 100) / 100,
    totalDebt: Math.round(totalDebt * 100) / 100,
    rawDebtBalance: Math.round(rawDebtBalance * 100) / 100,
    netBalance,
    activeLiquidAccountsCount,
    activeCreditCardsCount,
  };
}

export function validateTransactionInput(
  input: {
    userId: string;
    type: TransactionType;
    amount: number;
    currency: string;
    accountId?: string;
    categoryId?: string;
    subcategoryId?: string;
    originAccountId?: string;
    destinationAccountId?: string;
    date: string;
  },
  accounts: Account[],
  categories: Category[],
  existingTxToReverse?: Transaction
): TransactionValidationResult {
  if (!input.userId) {
    return { valid: false, error: 'Usuario no autenticado.' };
  }

  if (typeof input.amount !== 'number' || Number.isNaN(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'El monto debe ser mayor que cero.' };
  }

  if (!input.currency || input.currency.trim().length !== 3) {
    return { valid: false, error: 'La moneda seleccionada no es válida.' };
  }

  if (!isValidISODateString(input.date)) {
    return { valid: false, error: 'La fecha de la transacción es obligatoria y debe ser válida.' };
  }

  const simulatedAccounts = existingTxToReverse
    ? reverseTransactionOnAccounts(existingTxToReverse, accounts)
    : accounts;

  if (input.type === 'transfer') {
    const originId = input.originAccountId || input.accountId;
    if (!originId || !input.destinationAccountId) {
      return {
        valid: false,
        error: 'Debes seleccionar la cuenta de origen y la cuenta de destino.',
      };
    }

    if (originId === input.destinationAccountId) {
      return {
        valid: false,
        error: 'La cuenta de origen y la cuenta de destino deben ser diferentes.',
      };
    }

    const originAcc = simulatedAccounts.find(
      (a) => a.id === originId && a.userId === input.userId && a.status === 'active'
    );
    const destAcc = simulatedAccounts.find(
      (a) => a.id === input.destinationAccountId && a.userId === input.userId && a.status === 'active'
    );

    if (!originAcc) {
      return { valid: false, error: 'La cuenta de origen no existe o está inactiva.' };
    }
    if (!destAcc) {
      return { valid: false, error: 'La cuenta de destino no existe o está inactiva.' };
    }

    return { valid: true };
  }

  if (!input.accountId) {
    return { valid: false, error: 'La cuenta es obligatoria.' };
  }

  const account = simulatedAccounts.find(
    (a) => a.id === input.accountId && a.userId === input.userId && a.status === 'active'
  );
  if (!account) {
    return { valid: false, error: 'La cuenta seleccionada no existe o no pertenece al usuario.' };
  }

  if (!input.categoryId) {
    return { valid: false, error: 'La categoría es obligatoria.' };
  }

  const category = categories.find(
    (c) => c.id === input.categoryId && c.userId === input.userId && c.type === input.type
  );
  if (!category) {
    return {
      valid: false,
      error: 'La categoría seleccionada no existe o no corresponde al tipo de transacción.',
    };
  }

  if (input.subcategoryId) {
    const belongsToCategory = category.subcategories.some((s) => s.id === input.subcategoryId);
    if (!belongsToCategory) {
      return {
        valid: false,
        error: 'La subcategoría seleccionada no pertenece a la categoría principal.',
      };
    }
  }

  if (input.type === 'expense') {
    if (account.type === 'credit_card' && typeof account.creditLimit === 'number' && account.creditLimit > 0) {
      const currentDebt = Math.abs(Math.min(0, account.currentBalance));
      if (currentDebt + input.amount > account.creditLimit) {
        const availableCredit = Math.max(0, account.creditLimit - currentDebt);
        return {
          valid: false,
          error: `El gasto excede el límite disponible de la tarjeta ${account.name} (Disponible: Q${availableCredit.toFixed(2)}).`,
        };
      }
    }
  }

  return { valid: true };
}

export function applyTransactionToAccounts(
  tx: Transaction,
  accounts: Account[]
): Account[] {
  const now = new Date().toISOString();
  return accounts.map((acc) => {
    if (tx.type === 'expense' && acc.id === tx.accountId) {
      return {
        ...acc,
        currentBalance: Math.round((acc.currentBalance - tx.amount) * 100) / 100,
        updatedAt: now,
      };
    }

    if (tx.type === 'income' && acc.id === tx.accountId) {
      return {
        ...acc,
        currentBalance: Math.round((acc.currentBalance + tx.amount) * 100) / 100,
        updatedAt: now,
      };
    }

    if (tx.type === 'transfer') {
      const originId = tx.originAccountId || tx.accountId;
      if (acc.id === originId) {
        return {
          ...acc,
          currentBalance: Math.round((acc.currentBalance - tx.amount) * 100) / 100,
          updatedAt: now,
        };
      }
      if (acc.id === tx.destinationAccountId) {
        return {
          ...acc,
          currentBalance: Math.round((acc.currentBalance + tx.amount) * 100) / 100,
          updatedAt: now,
        };
      }
    }

    return acc;
  });
}

export function reverseTransactionOnAccounts(
  tx: Transaction,
  accounts: Account[]
): Account[] {
  const now = new Date().toISOString();
  return accounts.map((acc) => {
    if (tx.type === 'expense' && acc.id === tx.accountId) {
      return {
        ...acc,
        currentBalance: Math.round((acc.currentBalance + tx.amount) * 100) / 100,
        updatedAt: now,
      };
    }

    if (tx.type === 'income' && acc.id === tx.accountId) {
      return {
        ...acc,
        currentBalance: Math.round((acc.currentBalance - tx.amount) * 100) / 100,
        updatedAt: now,
      };
    }

    if (tx.type === 'transfer') {
      const originId = tx.originAccountId || tx.accountId;
      if (acc.id === originId) {
        return {
          ...acc,
          currentBalance: Math.round((acc.currentBalance + tx.amount) * 100) / 100,
          updatedAt: now,
        };
      }
      if (acc.id === tx.destinationAccountId) {
        return {
          ...acc,
          currentBalance: Math.round((acc.currentBalance - tx.amount) * 100) / 100,
          updatedAt: now,
        };
      }
    }

    return acc;
  });
}

export function getTransactionsForPeriod(
  transactions: Transaction[],
  period?: FinancialPeriod | null
): Transaction[] {
  if (!period) return transactions;
  return transactions.filter(
    (tx) => tx.date >= period.startDate && tx.date <= period.endDate
  );
}

export function calculatePeriodSummary(
  transactions: Transaction[],
  period?: FinancialPeriod | null
): PeriodFinancialSummary {
  const periodTxs = period ? getTransactionsForPeriod(transactions, period) : transactions;

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfers = 0;
  let totalCardPayments = 0;

  for (const tx of periodTxs) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;
    } else if (tx.type === 'transfer') {
      totalTransfers += tx.amount;
      if (tx.isCreditCardPayment) {
        totalCardPayments += tx.amount;
      }
    }
  }

  return {
    periodId: period?.id,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netResult: Math.round((totalIncome - totalExpense) * 100) / 100,
    totalTransfers: Math.round(totalTransfers * 100) / 100,
    totalCardPayments: Math.round(totalCardPayments * 100) / 100,
    transactionCount: periodTxs.length,
  };
}

export interface BudgetProgress {
  budget: Budget;
  category?: Category;
  subcategoryName?: string;
  targetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  isOverBudget: boolean;
  isWarning80: boolean;
  subperiodBreakdown: {
    subperiodId: string;
    label: string;
    dateRange: string;
    allocated: number;
    spent: number;
  }[];
}

export function calculateBudgetProgress(
  budget: Budget,
  period: FinancialPeriod,
  transactions: Transaction[],
  categories: Category[]
): BudgetProgress {
  const category = categories.find((c) => c.id === budget.categoryId);
  const subcategoryName = budget.subcategoryId
    ? category?.subcategories.find((s) => s.id === budget.subcategoryId)?.name
    : undefined;

  const matchingExpenses = transactions.filter((tx) => {
    if (tx.type !== 'expense') return false;
    if (tx.date < period.startDate || tx.date > period.endDate) return false;
    if (tx.categoryId !== budget.categoryId) return false;
    if (budget.subcategoryId && tx.subcategoryId !== budget.subcategoryId) return false;
    return true;
  });

  const spentAmount =
    Math.round(matchingExpenses.reduce((sum, tx) => sum + tx.amount, 0) * 100) / 100;
  const remainingAmount = Math.round((budget.targetAmount - spentAmount) * 100) / 100;
  const percentageUsed =
    budget.targetAmount > 0
      ? Math.round((spentAmount / budget.targetAmount) * 1000) / 10
      : 0;

  const subsCount = Math.max(1, period.subperiods.length);
  const allocatedPerSub = Math.round((budget.targetAmount / subsCount) * 100) / 100;

  const subperiodBreakdown = period.subperiods.map((sub) => {
    const subSpent = matchingExpenses
      .filter((tx) => tx.date >= sub.startDate && tx.date <= sub.endDate)
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      subperiodId: sub.id,
      label: sub.label,
      dateRange: `${sub.startDate} → ${sub.endDate}`,
      allocated: allocatedPerSub,
      spent: Math.round(subSpent * 100) / 100,
    };
  });

  return {
    budget,
    category,
    subcategoryName,
    targetAmount: budget.targetAmount,
    spentAmount,
    remainingAmount,
    percentageUsed,
    isOverBudget: spentAmount > budget.targetAmount,
    isWarning80: percentageUsed >= 80 && spentAmount <= budget.targetAmount,
    subperiodBreakdown,
  };
}
