export type ThemeMode = 'light' | 'dark' | 'system';

export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card';

export type AccountStatus = 'active' | 'archived';

export interface Account {
  id: string;
  userId: string;
  name: string;
  subtitle?: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  currentBalance: number; // Positive for liquid accounts; <= 0 for credit card debt
  balance?: number;       // Compatibility alias for currentBalance
  creditLimit?: number;   // For credit cards (e.g. 15000)
  status: AccountStatus;
  icon: string;
  color: string;
  cutoffDay?: number;     // e.g. 15
  paymentDueDay?: number; // e.g. 5
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  icon: string;
  isActive?: boolean;
}

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isActive: boolean;
  subcategories: Subcategory[];
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  accountId?: string;
  categoryId?: string;
  subcategoryId?: string;
  originAccountId?: string;
  destinationAccountId?: string;
  isCreditCardPayment?: boolean;
  date: string; // YYYY-MM-DD
  time?: string;
  note: string;
  periodId?: string;
  subperiodId?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubdivisionMode = 'weekly' | 'biweekly' | 'monthly' | 'none';

export type PeriodStatus = 'active' | 'scheduled' | 'closed' | 'inactive' | 'in_progress';

export interface Subperiod {
  id: string;
  periodId: string;
  index: number;
  label: string; // e.g. Q1, Q2, S1
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
}

export interface FinancialPeriod {
  id: string;
  userId: string;
  name: string;
  /** Mes que representa en el Panorama Anual (1 = enero, 12 = diciembre). */
  referenceMonth?: number;
  startDate: string;
  endDate: string;
  subdivisionMode: SubdivisionMode;
  status: PeriodStatus;
  isActive: boolean;
  subperiods: Subperiod[];
  monthIndex?: number; // 0 = Enero, ..., 11 = Diciembre (vinculación directa al Panorama Anual)
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  periodId: string;
  categoryId: string;
  subcategoryId?: string;
  targetAmount: number;
  amount?: number; // Compatibility alias for targetAmount
  currency: string;
  alertThreshold80: boolean;
  alertThreshold100: boolean;
  distributeBySubperiod: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionTemplate {
  id: string;
  userId: string;
  name?: string;
  transactionType?: CategoryType;
  categoryId: string;
  subcategoryId?: string;
  amount: number;
  accountId: string;
  note: string;
  recurrenceStartDate?: string;
  recurrenceFrequency?: 'weekly' | 'biweekly' | 'monthly';
  /** Compatibilidad temporal con recordatorios de la versión anterior. */
  reminderFrequency?: 'weekly' | 'monthly';
  nextReminderAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  provider: 'email' | 'google';
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  currency: string;
  currencySymbolPosition: 'prefix' | 'suffix';
  decimalPlaces: number;
  themeMode: ThemeMode;
  hideBalances: boolean;
  activePeriodId?: string;
}

export type HealthScoreLevel = 'critical' | 'alert' | 'moderate' | 'solid' | 'excellent';

export interface WeeklyHealthProgress {
  weekIndex: number; // 1, 2, 3, 4
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  income: number;
  expenses: number;
  netSavings: number;
  burnRateVsExpectedPct: number; // e.g. 95% = dentro del ritmo esperado
  status: 'on_track' | 'warning' | 'critical';
  highlight: string;
}

export interface MonthlyExecutiveReport {
  id: string; // e.g. "report_2026_10"
  userId: string;
  schemaVersion: number; // e.g. 1
  year: number;
  month: number; // 1-12
  monthName: string;
  score: number; // 0 - 100
  level: HealthScoreLevel;
  badgeLabel: string; // e.g. "Sólida", "Excelente", "Alerta"
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePct: number; // %
  debtToIncomeRatioPct: number; // DTI %
  liquidityMonths: number; // Meses de cobertura con efectivo disponible
  weeks: WeeklyHealthProgress[];
  recommendations: Array<{
    id: string;
    type: 'debt' | 'budget' | 'savings' | 'behavior';
    priority: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    actionLabel?: string;
  }>;
  executiveSummaryText: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualExecutiveSummary {
  year: number;
  scoreAvg: number;
  level: HealthScoreLevel;
  badgeLabel: string;
  totalAnnualIncome: number;
  totalAnnualExpenses: number;
  totalAnnualSavings: number;
  annualSavingsRatePct: number;
  bestMonthName: string;
  toughestMonthName: string;
  strategicRecommendations: string[];
}

