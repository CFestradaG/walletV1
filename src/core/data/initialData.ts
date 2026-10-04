import {
  Account,
  Budget,
  Category,
  FinancialPeriod,
  Transaction,
  UserProfile,
  UserSettings,
} from '../types/models';
import {
  generateSubperiods,
  syncTransactionsWithPeriods,
} from '../../features/financial_periods/periodEngine';
import { applyTransactionToAccounts } from '../../features/transactions/financialEngine';

export interface UserDataStore {
  profile: UserProfile;
  settings: UserSettings;
  accounts: Account[];
  categories: Category[];
  periods: FinancialPeriod[];
  activePeriodId: string;
  transactions: Transaction[];
  budgets: Budget[];
}

export function createDefaultCategories(userId: string): Category[] {
  const expenseCategories: Omit<Category, 'userId'>[] = [
    {
      id: `cat_food_${userId}`,
      name: 'Alimentación',
      type: 'expense',
      icon: '🍔',
      color: '#10B981',
      isActive: true,
      subcategories: [
        { id: `sub_rest_${userId}`, categoryId: `cat_food_${userId}`, name: 'Restaurantes', icon: '🍽️' },
        { id: `sub_super_${userId}`, categoryId: `cat_food_${userId}`, name: 'Supermercado', icon: '🛒' },
        { id: `sub_cafe_${userId}`, categoryId: `cat_food_${userId}`, name: 'Cafetería', icon: '☕' },
        { id: `sub_deliv_${userId}`, categoryId: `cat_food_${userId}`, name: 'Delivery', icon: '🛵' },
        { id: `sub_fast_${userId}`, categoryId: `cat_food_${userId}`, name: 'Comida rápida', icon: '🍔' },
        { id: `sub_bakery_${userId}`, categoryId: `cat_food_${userId}`, name: 'Panadería', icon: '🥖' },
      ],
    },
    {
      id: `cat_trans_${userId}`,
      name: 'Transporte',
      type: 'expense',
      icon: '🚗',
      color: '#0284C7',
      isActive: true,
      subcategories: [
        { id: `sub_fuel_${userId}`, categoryId: `cat_trans_${userId}`, name: 'Gasolina', icon: '⛽' },
        { id: `sub_taxi_${userId}`, categoryId: `cat_trans_${userId}`, name: 'Uber / Taxi', icon: '🚕' },
        { id: `sub_pub_${userId}`, categoryId: `cat_trans_${userId}`, name: 'Transporte público', icon: '🚌' },
        { id: `sub_maint_t_${userId}`, categoryId: `cat_trans_${userId}`, name: 'Mantenimiento', icon: '🔧' },
        { id: `sub_park_${userId}`, categoryId: `cat_trans_${userId}`, name: 'Estacionamiento', icon: '🅿️' },
      ],
    },
    {
      id: `cat_home_${userId}`,
      name: 'Vivienda',
      type: 'expense',
      icon: '🏠',
      color: '#8B5CF6',
      isActive: true,
      subcategories: [
        { id: `sub_rent_${userId}`, categoryId: `cat_home_${userId}`, name: 'Renta / Hipoteca', icon: '🏢' },
        { id: `sub_home_mnt_${userId}`, categoryId: `cat_home_${userId}`, name: 'Mantenimiento', icon: '🛋️' },
        { id: `sub_home_shp_${userId}`, categoryId: `cat_home_${userId}`, name: 'Muebles & Hogar', icon: '🪑' },
      ],
    },
    {
      id: `cat_health_${userId}`,
      name: 'Salud',
      type: 'expense',
      icon: '❤️',
      color: '#F43F5E',
      isActive: true,
      subcategories: [
        { id: `sub_meds_${userId}`, categoryId: `cat_health_${userId}`, name: 'Farmacia', icon: '💊' },
        { id: `sub_doc_${userId}`, categoryId: `cat_health_${userId}`, name: 'Consulta médica', icon: '🩺' },
        { id: `sub_lab_${userId}`, categoryId: `cat_health_${userId}`, name: 'Seguro médico', icon: '🛡️' },
        { id: `sub_gym_${userId}`, categoryId: `cat_health_${userId}`, name: 'Gimnasio', icon: '🏋️' },
      ],
    },
    {
      id: `cat_edu_${userId}`,
      name: 'Educación',
      type: 'expense',
      icon: '📚',
      color: '#F59E0B',
      isActive: true,
      subcategories: [
        { id: `sub_courses_${userId}`, categoryId: `cat_edu_${userId}`, name: 'Cursos online', icon: '💻' },
        { id: `sub_books_${userId}`, categoryId: `cat_edu_${userId}`, name: 'Libros', icon: '📖' },
        { id: `sub_uni_${userId}`, categoryId: `cat_edu_${userId}`, name: 'Universidad', icon: '🎓' },
      ],
    },
    {
      id: `cat_ent_${userId}`,
      name: 'Entretenimiento',
      type: 'expense',
      icon: '🎉',
      color: '#EC4899',
      isActive: true,
      subcategories: [
        { id: `sub_stream_${userId}`, categoryId: `cat_ent_${userId}`, name: 'Streaming', icon: '🎬' },
        { id: `sub_cine_${userId}`, categoryId: `cat_ent_${userId}`, name: 'Eventos / Cine', icon: '🎟️' },
        { id: `sub_games_${userId}`, categoryId: `cat_ent_${userId}`, name: 'Videojuegos', icon: '🎮' },
        { id: `sub_travel_${userId}`, categoryId: `cat_ent_${userId}`, name: 'Viajes', icon: '✈️' },
      ],
    },
    {
      id: `cat_util_${userId}`,
      name: 'Servicios',
      type: 'expense',
      icon: '⚡',
      color: '#EAB308',
      isActive: true,
      subcategories: [
        { id: `sub_elec_${userId}`, categoryId: `cat_util_${userId}`, name: 'Electricidad', icon: '💡' },
        { id: `sub_water_${userId}`, categoryId: `cat_util_${userId}`, name: 'Agua', icon: '💧' },
        { id: `sub_net_${userId}`, categoryId: `cat_util_${userId}`, name: 'Internet', icon: '📶' },
        { id: `sub_phone_${userId}`, categoryId: `cat_util_${userId}`, name: 'Teléfono', icon: '📱' },
      ],
    },
    {
      id: `cat_shop_${userId}`,
      name: 'Compras',
      type: 'expense',
      icon: '🛍️',
      color: '#06B6D4',
      isActive: true,
      subcategories: [
        { id: `sub_clothes_${userId}`, categoryId: `cat_shop_${userId}`, name: 'Ropa & Calzado', icon: '👕' },
        { id: `sub_tech_${userId}`, categoryId: `cat_shop_${userId}`, name: 'Electrónica', icon: '🎧' },
        { id: `sub_personal_${userId}`, categoryId: `cat_shop_${userId}`, name: 'Belleza', icon: '✨' },
      ],
    },
    {
      id: `cat_other_${userId}`,
      name: 'Otros',
      type: 'expense',
      icon: '⚙️',
      color: '#64748B',
      isActive: true,
      subcategories: [
        { id: `sub_unf_${userId}`, categoryId: `cat_other_${userId}`, name: 'Imprevistos', icon: '⚠️' },
        { id: `sub_don_${userId}`, categoryId: `cat_other_${userId}`, name: 'Donaciones', icon: '🎁' },
        { id: `sub_com_${userId}`, categoryId: `cat_other_${userId}`, name: 'Comisiones', icon: '💳' },
      ],
    },
  ];

  const incomeCategories: Omit<Category, 'userId'>[] = [
    {
      id: `cat_salary_${userId}`,
      name: 'Salario',
      type: 'income',
      icon: '💼',
      color: '#10B981',
      isActive: true,
      subcategories: [
        { id: `sub_sal_q_${userId}`, categoryId: `cat_salary_${userId}`, name: 'Nómina quincenal', icon: '💵' },
        { id: `sub_sal_m_${userId}`, categoryId: `cat_salary_${userId}`, name: 'Nómina mensual', icon: '🏦' },
        { id: `sub_sal_b14_${userId}`, categoryId: `cat_salary_${userId}`, name: 'Aguinaldo / Bono 14', icon: '🏅' },
      ],
    },
    {
      id: `cat_bonus_${userId}`,
      name: 'Bonificación',
      type: 'income',
      icon: '🎯',
      color: '#34D399',
      isActive: true,
      subcategories: [
        { id: `sub_bon_perf_${userId}`, categoryId: `cat_bonus_${userId}`, name: 'Bono desempeño', icon: '📈' },
        { id: `sub_bon_comm_${userId}`, categoryId: `cat_bonus_${userId}`, name: 'Comisiones', icon: '🤝' },
      ],
    },
    {
      id: `cat_free_${userId}`,
      name: 'Freelance',
      type: 'income',
      icon: '💻',
      color: '#38BDF8',
      isActive: true,
      subcategories: [
        { id: `sub_free_cons_${userId}`, categoryId: `cat_free_${userId}`, name: 'Consultoría', icon: '🧠' },
        { id: `sub_free_proj_${userId}`, categoryId: `cat_free_${userId}`, name: 'Proyecto externo', icon: '🚀' },
      ],
    },
    {
      id: `cat_other_inc_${userId}`,
      name: 'Otros ingresos',
      type: 'income',
      icon: '✨',
      color: '#A78BFA',
      isActive: true,
      subcategories: [
        { id: `sub_inc_ref_${userId}`, categoryId: `cat_other_inc_${userId}`, name: 'Reembolsos', icon: '🔄' },
        { id: `sub_inc_int_${userId}`, categoryId: `cat_other_inc_${userId}`, name: 'Intereses', icon: '📊' },
        { id: `sub_inc_gift_${userId}`, categoryId: `cat_other_inc_${userId}`, name: 'Regalos', icon: '🎁' },
      ],
    },
  ];

  return [...expenseCategories, ...incomeCategories].map((c) => ({
    ...c,
    userId,
    subcategories: c.subcategories.map((s) => ({
      ...s,
      isActive: true,
    })),
  }));
}

export function createCleanUserStore(profile: UserProfile): UserDataStore {
  const userId = profile.id;
  const now = new Date().toISOString();
  const categories = createDefaultCategories(userId);
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  const toISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const startDate = toISODate(periodStart);
  const endDate = toISODate(periodEnd);
  const periodMonth = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' }).format(today);
  const periodName = `${periodMonth.charAt(0).toLocaleUpperCase('es-GT')}${periodMonth.slice(1)}`;
  const defaultPeriodId = `per_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}_${userId}`;
  const defaultPeriod: FinancialPeriod = {
    id: defaultPeriodId,
    userId,
    name: periodName,
    startDate,
    endDate,
    subdivisionMode: 'monthly',
    status: 'active',
    isActive: true,
    subperiods: generateSubperiods(defaultPeriodId, startDate, endDate, 'monthly'),
    createdAt: now,
    updatedAt: now,
  };

  return {
    profile,
    settings: {
      userId,
      currency: 'GTQ',
      currencySymbolPosition: 'prefix',
      decimalPlaces: 2,
      themeMode: 'dark',
      hideBalances: false,
    },
    accounts: [],
    categories,
    periods: [defaultPeriod],
    activePeriodId: defaultPeriodId,
    transactions: [],
    budgets: [],
  };
}

export function createActiveDemoUserStore(): UserDataStore {
  const userId = 'usr_francisco';
  const now = '2027-02-15T10:00:00.000Z';

  const profile: UserProfile = {
    id: userId,
    name: 'Francisco Estrada',
    email: 'francisco@estrada.gt',
    provider: 'email',
    createdAt: '2026-12-01T08:00:00.000Z',
  };

  const categories = createDefaultCategories(userId);

  const p1Id = `per_sep26_${userId}`;
  const p2Id = `per_oct26_${userId}`;
  const p3Id = `per_nov26_${userId}`;

  const periods: FinancialPeriod[] = [
    {
      id: p1Id,
      userId,
      name: 'Septiembre 2026',
      startDate: '2026-08-27',
      endDate: '2026-09-26',
      subdivisionMode: 'biweekly',
      status: 'closed',
      isActive: false,
      subperiods: generateSubperiods(p1Id, '2026-08-27', '2026-09-26', 'biweekly'),
      createdAt: '2026-08-27T08:00:00.000Z',
      updatedAt: '2026-09-26T23:59:00.000Z',
    },
    {
      id: p2Id,
      userId,
      name: 'Octubre 2026',
      startDate: '2026-09-27',
      endDate: '2026-10-26',
      subdivisionMode: 'biweekly',
      status: 'active',
      isActive: true,
      subperiods: generateSubperiods(p2Id, '2026-09-27', '2026-10-26', 'biweekly'),
      createdAt: '2026-09-27T08:00:00.000Z',
      updatedAt: now,
    },
    {
      id: p3Id,
      userId,
      name: 'Noviembre 2026',
      startDate: '2026-10-27',
      endDate: '2026-11-26',
      subdivisionMode: 'biweekly',
      status: 'scheduled',
      isActive: false,
      subperiods: generateSubperiods(p3Id, '2026-10-27', '2026-11-26', 'biweekly'),
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: now,
    },
  ];

  let accounts: Account[] = [
    {
      id: `acc_cash_${userId}`,
      userId,
      name: 'Efectivo Físico',
      subtitle: 'Billetera',
      type: 'cash',
      currency: 'GTQ',
      initialBalance: 2515,
      currentBalance: 2450,
      status: 'active',
      icon: '💵',
      color: '#10B981',
      createdAt: '2026-12-27T08:00:00.000Z',
      updatedAt: now,
    },
    {
      id: `acc_bank_${userId}`,
      userId,
      name: 'Banco Industrial',
      subtitle: 'Monetaria ****4920',
      type: 'bank',
      currency: 'GTQ',
      initialBalance: 9125,
      currentBalance: 18350,
      status: 'active',
      icon: '🏦',
      color: '#0284C7',
      createdAt: '2026-12-27T08:00:00.000Z',
      updatedAt: now,
    },
    {
      id: `acc_savings_${userId}`,
      userId,
      name: 'BAC Débito',
      subtitle: 'Cuenta Ahorro Meta (3.5% TEA)',
      type: 'savings',
      currency: 'GTQ',
      initialBalance: 12420.5,
      currentBalance: 12000,
      status: 'active',
      icon: '🐷',
      color: '#34D399',
      createdAt: '2026-12-27T08:00:00.000Z',
      updatedAt: now,
    },
    {
      id: `acc_card_${userId}`,
      userId,
      name: 'BAC Cashback Platinum',
      subtitle: 'Visa Platinum •••• 1042',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalance: -3620,
      currentBalance: -3820,
      creditLimit: 15000,
      status: 'active',
      icon: '💳',
      color: '#F43F5E',
      cutoffDay: 15,
      paymentDueDay: 5,
      createdAt: '2026-12-27T08:00:00.000Z',
      updatedAt: now,
    },
  ];

  const rawTransactions: Transaction[] = [
    // Today / Recent transactions matching current active period (Octubre 2026)
    {
      id: `tx_rec_1_${userId}`,
      userId,
      type: 'expense',
      amount: 65,
      currency: 'GTQ',
      accountId: `acc_cash_${userId}`,
      categoryId: `cat_food_${userId}`,
      subcategoryId: `sub_rest_${userId}`,
      date: '2026-10-03',
      time: '11:20 AM',
      note: 'Almuerzo Ejecutivo',
      createdAt: '2026-10-03T11:20:00.000Z',
      updatedAt: '2026-10-03T11:20:00.000Z',
    },
    {
      id: `tx_rec_2_${userId}`,
      userId,
      type: 'income',
      amount: 9225,
      currency: 'GTQ',
      accountId: `acc_bank_${userId}`,
      categoryId: `cat_salary_${userId}`,
      subcategoryId: `sub_sal_q_${userId}`,
      date: '2026-10-03',
      time: '08:00 AM',
      note: 'Depósito Nómina Quincenal',
      createdAt: '2026-10-03T08:00:00.000Z',
      updatedAt: '2026-10-03T08:00:00.000Z',
    },
    {
      id: `tx_rec_3_${userId}`,
      userId,
      type: 'expense',
      amount: 420.5,
      currency: 'GTQ',
      accountId: `acc_savings_${userId}`,
      categoryId: `cat_food_${userId}`,
      subcategoryId: `sub_super_${userId}`,
      date: '2026-10-02',
      time: '06:45 PM',
      note: 'Supermercado La Torre',
      createdAt: '2026-10-02T18:45:00.000Z',
      updatedAt: '2026-10-02T18:45:00.000Z',
    },
    {
      id: `tx_rec_4_${userId}`,
      userId,
      type: 'expense',
      amount: 200,
      currency: 'GTQ',
      accountId: `acc_card_${userId}`,
      categoryId: `cat_trans_${userId}`,
      subcategoryId: `sub_fuel_${userId}`,
      date: '2026-10-01',
      time: '07:15 AM',
      note: 'Gasolina Puma',
      createdAt: '2026-10-01T07:15:00.000Z',
      updatedAt: '2026-10-01T07:15:00.000Z',
    },
    // Additional period transactions to match Q 18,450 income and Q 9,230 expenses
    {
      id: `tx_rec_5_${userId}`,
      userId,
      type: 'income',
      amount: 9225,
      currency: 'GTQ',
      accountId: `acc_bank_${userId}`,
      categoryId: `cat_salary_${userId}`,
      subcategoryId: `sub_sal_q_${userId}`,
      date: '2026-09-30',
      time: '08:00 AM',
      note: 'Depósito Nómina Fin de Mes',
      createdAt: '2026-09-30T08:00:00.000Z',
      updatedAt: '2026-09-30T08:00:00.000Z',
    },
    {
      id: `tx_rec_6_${userId}`,
      userId,
      type: 'expense',
      amount: 979.5,
      currency: 'GTQ',
      accountId: `acc_bank_${userId}`,
      categoryId: `cat_food_${userId}`,
      subcategoryId: `sub_super_${userId}`,
      date: '2026-10-01',
      time: '04:00 PM',
      note: 'Despensa Supermercado Paiz',
      createdAt: '2026-10-01T16:00:00.000Z',
      updatedAt: '2026-10-01T16:00:00.000Z',
    },
    {
      id: `tx_rec_7_${userId}`,
      userId,
      type: 'expense',
      amount: 450,
      currency: 'GTQ',
      accountId: `acc_card_${userId}`,
      categoryId: `cat_trans_${userId}`,
      subcategoryId: `sub_fuel_${userId}`,
      date: '2026-09-29',
      time: '08:15 AM',
      note: 'Combustible Shell V-Power',
      createdAt: '2026-09-29T08:15:00.000Z',
      updatedAt: '2026-09-29T08:15:00.000Z',
    },
    {
      id: `tx_rec_8_${userId}`,
      userId,
      type: 'expense',
      amount: 7115,
      currency: 'GTQ',
      accountId: `acc_bank_${userId}`,
      categoryId: `cat_home_${userId}`,
      subcategoryId: `sub_rent_${userId}`,
      date: '2026-09-28',
      time: '09:00 AM',
      note: 'Renta & Mantenimiento Edificio',
      createdAt: '2026-09-28T09:00:00.000Z',
      updatedAt: '2026-09-28T09:00:00.000Z',
    },
  ];

  const syncedTransactions = syncTransactionsWithPeriods(rawTransactions, periods);

  const budgets: Budget[] = [
    {
      id: `bdg_super_${userId}`,
      userId,
      periodId: p2Id,
      categoryId: `cat_food_${userId}`,
      subcategoryId: `sub_super_${userId}`,
      targetAmount: 2000,
      currency: 'GTQ',
      alertThreshold80: true,
      alertThreshold100: true,
      distributeBySubperiod: true,
      createdAt: '2027-01-27T08:00:00.000Z',
      updatedAt: now,
    },
    {
      id: `bdg_gas_${userId}`,
      userId,
      periodId: p2Id,
      categoryId: `cat_trans_${userId}`,
      subcategoryId: `sub_fuel_${userId}`,
      targetAmount: 1000,
      currency: 'GTQ',
      alertThreshold80: true,
      alertThreshold100: true,
      distributeBySubperiod: true,
      createdAt: '2027-01-27T08:00:00.000Z',
      updatedAt: now,
    },
  ];

  return {
    profile,
    settings: {
      userId,
      currency: 'GTQ',
      currencySymbolPosition: 'prefix',
      decimalPlaces: 2,
      themeMode: 'dark',
      hideBalances: false,
    },
    accounts,
    categories,
    periods,
    activePeriodId: p2Id,
    transactions: syncedTransactions,
    budgets,
  };
}
