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
  pendingSync?: boolean;
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
  startDate: string;
  endDate: string;
  subdivisionMode: SubdivisionMode;
  status: PeriodStatus;
  isActive: boolean;
  subperiods: Subperiod[];
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
  hideSensitiveBalances?: boolean;
  offlineSimulation: boolean;
  appProtection: boolean;
  biometrics: boolean;
  hasPin: boolean;
}

