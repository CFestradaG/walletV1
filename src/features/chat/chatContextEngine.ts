import {
  Account,
  Category,
  FinancialPeriod,
  Transaction,
  Budget,
} from '../../core/types/models';
import { PortfolioSummary } from '../transactions/financialEngine';

export interface PseudonymizedFinancialContext {
  periodName: string;
  periodDates: string;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  budgetProgressPct: number;
  accountsSummary: string;
  topExpenseCategories: Array<{
    categoryName: string;
    spent: number;
    budget: number;
  }>;
  categoriesList: string[];
  liquidAccountsList: Array<{
    name: string;
    balance: number;
  }>;
}

/**
 * Extrae un resumen cuantitativo y completamente seudonimizado de la situación financiera activa.
 * Cumple con la regla de CERO Información Personal Identificable (PII):
 * - No incluye correos, nombres de personas ni notas personales de transacciones.
 * - Seudonimiza los nombres de bancos o números de cuenta.
 */
export function buildPseudonymizedContext(params: {
  activePeriod: FinancialPeriod | null;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  portfolioSummary: PortfolioSummary;
}): PseudonymizedFinancialContext {
  const { activePeriod, accounts, categories, transactions, budgets } = params;

  // Fechas y nombre del período
  const periodName = activePeriod ? activePeriod.name : 'Período Activo';
  const periodDates = activePeriod
    ? `${activePeriod.startDate} a ${activePeriod.endDate}`
    : 'Rango en curso';

  // Transacciones del período activo
  const periodTxs = activePeriod
    ? transactions.filter((t) => t.date >= activePeriod.startDate && t.date <= activePeriod.endDate)
    : transactions;

  const totalIncome = periodTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = periodTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpenses;

  // Progreso general de presupuestos en categorías de egreso
  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.isActive);
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.targetAmount, 0);
  const budgetProgressPct =
    totalBudgeted > 0 ? Math.round((totalExpenses / totalBudgeted) * 100) : 0;

  // Resumen de categorías con mayor egreso en el período
  const categorySpentMap = new Map<string, number>();
  for (const tx of periodTxs) {
    if (tx.type === 'expense' && tx.categoryId) {
      const current = categorySpentMap.get(tx.categoryId) || 0;
      categorySpentMap.set(tx.categoryId, current + tx.amount);
    }
  }

  const topExpenseCategories: Array<{ categoryName: string; spent: number; budget: number }> = [];
  for (const cat of expenseCategories) {
    const spent = categorySpentMap.get(cat.id) || 0;
    const b = budgets.find((bg) => bg.categoryId === cat.id);
    const target = b ? b.targetAmount : 0;
    if (spent > 0 || target > 0) {
      topExpenseCategories.push({
        categoryName: cat.name,
        spent,
        budget: target,
      });
    }
  }
  // Ordenar por mayor gasto
  topExpenseCategories.sort((a, b) => b.spent - a.spent);

  // Resumen de cuentas seudonimizadas
  const liquidAccs = accounts.filter((a) => a.status === 'active' && a.type !== 'credit_card');
  const cardAccs = accounts.filter((a) => a.status === 'active' && a.type === 'credit_card');

  const totalLiquid = liquidAccs.reduce((s, a) => s + (a.currentBalance || 0), 0);
  const totalDebt = cardAccs.reduce((s, a) => s + Math.abs(a.currentBalance || 0), 0);

  const accountsSummary = `${liquidAccs.length} cuentas de liquidez (Saldo total: Q${totalLiquid.toLocaleString('es-GT', { minimumFractionDigits: 2 })}), ${cardAccs.length} tarjetas de crédito (Deuda total: Q${totalDebt.toLocaleString('es-GT', { minimumFractionDigits: 2 })})`;

  const categoriesList = categories.filter((c) => c.isActive).map((c) => c.name);

  const liquidAccountsList = liquidAccs.map((a) => ({
    name: a.name,
    balance: a.currentBalance || 0,
  }));

  return {
    periodName,
    periodDates,
    currency: 'GTQ',
    totalIncome,
    totalExpenses,
    netSavings,
    budgetProgressPct,
    accountsSummary,
    topExpenseCategories: topExpenseCategories.slice(0, 6),
    categoriesList,
    liquidAccountsList,
  };
}
