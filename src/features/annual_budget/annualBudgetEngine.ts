import { Budget, Category, FinancialPeriod, Transaction } from '../../core/types/models';

export type TimeHorizon = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface CategoryProjectionConfig {
  categoryId: string;
  monthlyAmount: number; // Monto proyectado base mensual
  monthlyOverrides?: Partial<Record<number, number>>; // 0 = Ene, 11 = Dic
}

export interface AnnualProjectionsPlan {
  year: number;
  projections: Record<string, CategoryProjectionConfig>; // key = categoryId
}

export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export interface CellValue {
  projected: number;
  actual: number;
  difference: number; // para ingresos: actual - projected; para egresos: projected - actual
  hasDirectBudget?: boolean; // true si viene directamente de un Budget de período
  periodId?: string;
}

export interface HorizonColumnDef {
  id: string;
  title: string;
  shortTitle: string;
  subtitle?: string;
  monthIndices: number[]; // índices de meses 0 a 11
  matchedPeriods?: FinancialPeriod[];
}

export interface CategorySummaryRow {
  category: Category;
  cells: Record<string, CellValue>; // key = columnId (e.g. 'm_0', 'q1', 's1', 'annual')
  annualProjected: number;
  annualActual: number;
  annualDifference: number;
}

export interface TotalsRow {
  cells: Record<string, CellValue>;
  annualProjected: number;
  annualActual: number;
  annualDifference: number;
}

export interface AnnualMatrixResult {
  year: number;
  horizon: TimeHorizon;
  columns: HorizonColumnDef[];
  incomeRows: CategorySummaryRow[];
  expenseRows: CategorySummaryRow[];
  totalIncome: TotalsRow;
  totalExpense: TotalsRow;
  netDifference: TotalsRow; // Ingresos - Egresos
}

/**
 * Busca si existe un FinancialPeriod configurado por el usuario que corresponda a este mes y año.
 * Respeta el rango de fechas startDate y endDate del período configurado.
 */
export function findPeriodForMonth(
  periods: FinancialPeriod[],
  year: number,
  monthIndex: number
): FinancialPeriod | undefined {
  // 1. Coincidencia explícita por mes asignado en el dropdown y año correspondiente
  const byExplicitMonth = periods.find(
    (p) =>
      p.monthIndex === monthIndex &&
      (p.startDate.startsWith(String(year)) || p.endDate.startsWith(String(year)))
  );
  if (byExplicitMonth) return byExplicitMonth;

  const monthStr = String(monthIndex + 1).padStart(2, '0');
  const monthPrefix = `${year}-${monthStr}`;
  const monthMidDate = `${year}-${monthStr}-15`;

  // 2. Período cuya fecha de inicio comience exactamente en este año y mes
  const exactStart = periods.find((p) => p.startDate && p.startDate.startsWith(monthPrefix));
  if (exactStart) return exactStart;

  // 3. Período cuyo rango de fechas configuradas (startDate <= 15 del mes <= endDate) abarque este mes
  const overlapping = periods.find(
    (p) => p.startDate && p.endDate && p.startDate <= monthMidDate && monthMidDate <= p.endDate
  );
  if (overlapping) return overlapping;

  // 4. Período por nombre coincidente (ej. "Octubre 2026" o "Octubre")
  const mName = MONTH_NAMES_ES[monthIndex].toLowerCase();
  const byName = periods.find((p) => {
    const pName = (p.name || '').toLowerCase();
    const matchesMonth = pName.includes(mName);
    const matchesYear = pName.includes(String(year)) || (p.startDate && p.startDate.startsWith(String(year)));
    return matchesMonth && matchesYear;
  });
  if (byName) return byName;

  return undefined;
}

/**
 * Obtiene las definiciones de columnas según el horizonte temporal,
 * vinculando los FinancialPeriods configurados y sus fechas reales.
 */
export function getHorizonColumnDefs(
  year: number,
  horizon: TimeHorizon,
  periods: FinancialPeriod[] = []
): HorizonColumnDef[] {
  if (horizon === 'monthly') {
    return MONTH_NAMES_ES.map((name, idx) => {
      const matched = findPeriodForMonth(periods, year, idx);
      let subtitle: string | undefined = undefined;

      if (matched && matched.startDate && matched.endDate) {
        const startShort = matched.startDate.slice(5); // MM-DD
        const endShort = matched.endDate.slice(5);     // MM-DD
        subtitle = `${startShort} al ${endShort}`;
      }

      return {
        id: `m_${idx}`,
        title: name,
        shortTitle: MONTH_SHORT_ES[idx],
        subtitle,
        monthIndices: [idx],
        matchedPeriods: matched ? [matched] : [],
      };
    });
  }

  if (horizon === 'quarterly') {
    const qDefs = [
      { id: 'q1', title: '1er Trimestre (T1)', shortTitle: 'T1', subtitle: 'Ene - Mar', monthIndices: [0, 1, 2] },
      { id: 'q2', title: '2do Trimestre (T2)', shortTitle: 'T2', subtitle: 'Abr - Jun', monthIndices: [3, 4, 5] },
      { id: 'q3', title: '3er Trimestre (T3)', shortTitle: 'T3', subtitle: 'Jul - Sep', monthIndices: [6, 7, 8] },
      { id: 'q4', title: '4to Trimestre (T4)', shortTitle: 'T4', subtitle: 'Oct - Dic', monthIndices: [9, 10, 11] },
    ];

    return qDefs.map((q) => {
      const qPeriods = q.monthIndices
        .map((mIdx) => findPeriodForMonth(periods, year, mIdx))
        .filter((p): p is FinancialPeriod => Boolean(p));

      return {
        ...q,
        matchedPeriods: qPeriods,
      };
    });
  }

  if (horizon === 'semiannual') {
    const sDefs = [
      { id: 's1', title: '1er Semestre (S1)', shortTitle: 'S1', subtitle: 'Ene - Jun', monthIndices: [0, 1, 2, 3, 4, 5] },
      { id: 's2', title: '2do Semestre (S2)', shortTitle: 'S2', subtitle: 'Jul - Dic', monthIndices: [6, 7, 8, 9, 10, 11] },
    ];

    return sDefs.map((s) => {
      const sPeriods = s.monthIndices
        .map((mIdx) => findPeriodForMonth(periods, year, mIdx))
        .filter((p): p is FinancialPeriod => Boolean(p));

      return {
        ...s,
        matchedPeriods: sPeriods,
      };
    });
  }

  // Anual
  const allYearPeriods = periods.filter((p) => p.startDate && p.startDate.startsWith(String(year)));
  return [
    {
      id: 'annual_full',
      title: `Año ${year}`,
      shortTitle: `${year}`,
      subtitle: '12 meses consolidados',
      monthIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      matchedPeriods: allYearPeriods,
    },
  ];
}

/**
 * Genera el plan de proyecciones predeterminado a partir de las categorías y presupuestos.
 */
export function getDefaultProjectionsPlan(
  categories: Category[],
  year: number
): AnnualProjectionsPlan {
  const projections: Record<string, CategoryProjectionConfig> = {};

  categories.forEach((cat) => {
    let defaultAmount = 0;
    const overrides: Partial<Record<number, number>> = {};

    if (cat.type === 'income') {
      if (cat.name.toLowerCase().includes('salario') || cat.name.toLowerCase().includes('sueldo')) {
        defaultAmount = 10300;
        overrides[6] = 20600;  // Julio (Sueldo + Bono 14)
        overrides[11] = 20600; // Diciembre (Sueldo + Aguinaldo)
      } else if (cat.name.toLowerCase().includes('bono') || cat.name.toLowerCase().includes('extra')) {
        defaultAmount = 0;
      }
    } else {
      if (cat.name.toLowerCase().includes('alimen')) defaultAmount = 4100;
      else if (cat.name.toLowerCase().includes('servici')) defaultAmount = 770;
      else if (cat.name.toLowerCase().includes('transp')) defaultAmount = 250;
      else if (cat.name.toLowerCase().includes('viviend')) defaultAmount = 1850;
      else if (cat.name.toLowerCase().includes('educac')) defaultAmount = 1200;
      else defaultAmount = 0;
    }

    projections[cat.id] = {
      categoryId: cat.id,
      monthlyAmount: defaultAmount,
      monthlyOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    };
  });

  return {
    year,
    projections,
  };
}

/**
 * Calcula la matriz completa conectando directamente:
 * 1. Los presupuestos reales (budgets) configurados en cada período financiero.
 * 2. Las fechas reales (startDate a endDate) de cada período para agrupar transacciones.
 * 3. Proyecciones base cuando aún no exista un presupuesto manual para un período futuro.
 */
export function calculateCategoryMatrix(
  categories: Category[],
  transactions: Transaction[],
  periods: FinancialPeriod[],
  budgets: Budget[],
  plan: AnnualProjectionsPlan,
  year: number,
  horizon: TimeHorizon
): AnnualMatrixResult {
  const columns = getHorizonColumnDefs(year, horizon, periods);

  const incomeCategories = categories.filter((c) => c.type === 'income' && c.isActive);
  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.isActive);

  // Helper para calcular valores de una categoría en las columnas
  const computeCatCells = (cat: Category, type: 'income' | 'expense'): CategorySummaryRow => {
    const projConfig = plan.projections[cat.id];
    const cells: Record<string, CellValue> = {};
    let annualProjected = 0;
    let annualActual = 0;

    columns.forEach((col) => {
      let colProjected = 0;
      let colActual = 0;
      let hasDirectBudget = false;
      let matchedPeriodId: string | undefined = undefined;

      col.monthIndices.forEach((mIdx) => {
        const monthStr = String(mIdx + 1).padStart(2, '0');
        const monthPrefix = `${year}-${monthStr}`;

        // Buscar si existe un período financiero para este mes
        const matchingPeriod = findPeriodForMonth(periods, year, mIdx);

        // 1. PROYECCIÓN / PRESUPUESTO PARA EL MES mIdx:
        // Prioridad 1: Si hay un Budget real configurado para este período y categoría
        let mProj = 0;
        let isDirect = false;

        if (matchingPeriod) {
          matchedPeriodId = matchingPeriod.id;
          const directBudget = budgets.find(
            (b) => b.periodId === matchingPeriod.id && b.categoryId === cat.id
          );
          if (directBudget && directBudget.targetAmount > 0) {
            mProj = directBudget.targetAmount;
            isDirect = true;
            hasDirectBudget = true;
          }
        }

        // Prioridad 2: Si no hay Budget manual en el período, usar la proyección del plan anual
        if (!isDirect && projConfig) {
          mProj = projConfig.monthlyOverrides?.[mIdx] !== undefined
            ? projConfig.monthlyOverrides[mIdx]!
            : projConfig.monthlyAmount;
        }

        colProjected += mProj;

        // 2. EJECUCIÓN REAL PARA EL MES mIdx:
        // Respeta el rango de fechas real (startDate <= date <= endDate) del período si existe
        let monthActual = 0;

        if (matchingPeriod && matchingPeriod.startDate && matchingPeriod.endDate) {
          monthActual = transactions
            .filter((t) => {
              if (t.type !== type || t.categoryId !== cat.id) return false;
              // Coincidencia por ID de período o por inclusión en fechas del período
              const matchesPeriodId = t.periodId && t.periodId === matchingPeriod.id;
              const matchesDateRange =
                matchingPeriod.startDate <= t.date && t.date <= matchingPeriod.endDate;
              return matchesPeriodId || matchesDateRange;
            })
            .reduce((sum, t) => sum + t.amount, 0);
        } else {
          // Si no hay período configurado para este mes, usar fechas del mes calendario
          monthActual = transactions
            .filter((t) => t.date.startsWith(monthPrefix) && t.type === type && t.categoryId === cat.id)
            .reduce((sum, t) => sum + t.amount, 0);
        }

        colActual += monthActual;
      });

      colProjected = Math.round(colProjected * 100) / 100;
      colActual = Math.round(colActual * 100) / 100;
      const difference = type === 'income'
        ? Math.round((colActual - colProjected) * 100) / 100
        : Math.round((colProjected - colActual) * 100) / 100;

      cells[col.id] = {
        projected: colProjected,
        actual: colActual,
        difference,
        hasDirectBudget,
        periodId: matchedPeriodId,
      };

      annualProjected += colProjected;
      annualActual += colActual;
    });

    annualProjected = Math.round(annualProjected * 100) / 100;
    annualActual = Math.round(annualActual * 100) / 100;
    const annualDifference = type === 'income'
      ? Math.round((annualActual - annualProjected) * 100) / 100
      : Math.round((annualProjected - annualActual) * 100) / 100;

    return {
      category: cat,
      cells,
      annualProjected,
      annualActual,
      annualDifference,
    };
  };

  const incomeRows = incomeCategories.map((c) => computeCatCells(c, 'income'));
  const expenseRows = expenseCategories.map((c) => computeCatCells(c, 'expense'));

  // Totales de Ingresos
  const totalIncomeCells: Record<string, CellValue> = {};
  let totalIncomeAnnualProj = 0;
  let totalIncomeAnnualAct = 0;

  columns.forEach((col) => {
    const proj = incomeRows.reduce((sum, r) => sum + r.cells[col.id].projected, 0);
    const act = incomeRows.reduce((sum, r) => sum + r.cells[col.id].actual, 0);
    totalIncomeCells[col.id] = {
      projected: Math.round(proj * 100) / 100,
      actual: Math.round(act * 100) / 100,
      difference: Math.round((act - proj) * 100) / 100,
    };
    totalIncomeAnnualProj += proj;
    totalIncomeAnnualAct += act;
  });

  const totalIncome: TotalsRow = {
    cells: totalIncomeCells,
    annualProjected: Math.round(totalIncomeAnnualProj * 100) / 100,
    annualActual: Math.round(totalIncomeAnnualAct * 100) / 100,
    annualDifference: Math.round((totalIncomeAnnualAct - totalIncomeAnnualProj) * 100) / 100,
  };

  // Totales de Egresos
  const totalExpenseCells: Record<string, CellValue> = {};
  let totalExpenseAnnualProj = 0;
  let totalExpenseAnnualAct = 0;

  columns.forEach((col) => {
    const proj = expenseRows.reduce((sum, r) => sum + r.cells[col.id].projected, 0);
    const act = expenseRows.reduce((sum, r) => sum + r.cells[col.id].actual, 0);
    totalExpenseCells[col.id] = {
      projected: Math.round(proj * 100) / 100,
      actual: Math.round(act * 100) / 100,
      difference: Math.round((proj - act) * 100) / 100,
    };
    totalExpenseAnnualProj += proj;
    totalExpenseAnnualAct += act;
  });

  const totalExpense: TotalsRow = {
    cells: totalExpenseCells,
    annualProjected: Math.round(totalExpenseAnnualProj * 100) / 100,
    annualActual: Math.round(totalExpenseAnnualAct * 100) / 100,
    annualDifference: Math.round((totalExpenseAnnualProj - totalExpenseAnnualAct) * 100) / 100,
  };

  // Fila de Diferencia Neta (Ingresos - Egresos)
  const netDifferenceCells: Record<string, CellValue> = {};
  columns.forEach((col) => {
    const projNet = totalIncomeCells[col.id].projected - totalExpenseCells[col.id].projected;
    const actNet = totalIncomeCells[col.id].actual - totalExpenseCells[col.id].actual;
    netDifferenceCells[col.id] = {
      projected: Math.round(projNet * 100) / 100,
      actual: Math.round(actNet * 100) / 100,
      difference: Math.round((actNet - projNet) * 100) / 100,
    };
  });

  const netAnnualProj = totalIncome.annualProjected - totalExpense.annualProjected;
  const netAnnualAct = totalIncome.annualActual - totalExpense.annualActual;

  const netDifference: TotalsRow = {
    cells: netDifferenceCells,
    annualProjected: Math.round(netAnnualProj * 100) / 100,
    annualActual: Math.round(netAnnualAct * 100) / 100,
    annualDifference: Math.round((netAnnualAct - netAnnualProj) * 100) / 100,
  };

  return {
    year,
    horizon,
    columns,
    incomeRows,
    expenseRows,
    totalIncome,
    totalExpense,
    netDifference,
  };
}

/**
 * Persistencia local del plan de proyecciones por usuario
 */
export function loadProjectionsPlan(
  userId: string,
  categories: Category[],
  year: number
): AnnualProjectionsPlan {
  const key = `wallet_category_projections_${userId}_${year}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as AnnualProjectionsPlan;
      if (parsed && parsed.projections) {
        categories.forEach((cat) => {
          if (!parsed.projections[cat.id]) {
            parsed.projections[cat.id] = {
              categoryId: cat.id,
              monthlyAmount: cat.type === 'income' && cat.name.toLowerCase().includes('salario') ? 10300 : 0,
            };
          }
        });
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return getDefaultProjectionsPlan(categories, year);
}

export function loadSavedProjectionsPlan(userId: string, year: number): AnnualProjectionsPlan | null {
  const key = `wallet_category_projections_${userId}_${year}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnnualProjectionsPlan;
    return parsed?.year === year && parsed.projections ? parsed : null;
  } catch {
    return null;
  }
}

export function loadAllSavedProjectionsPlans(userId: string): AnnualProjectionsPlan[] {
  const prefix = `wallet_category_projections_${userId}_`;
  const plans: AnnualProjectionsPlan[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const year = Number(key.slice(prefix.length));
      const plan = loadSavedProjectionsPlan(userId, year);
      if (plan) plans.push(plan);
    }
  } catch {
    return plans;
  }
  return plans;
}

export function saveProjectionsPlan(userId: string, plan: AnnualProjectionsPlan): void {
  const key = `wallet_category_projections_${userId}_${plan.year}`;
  try {
    localStorage.setItem(key, JSON.stringify(plan));
  } catch (err) {
    console.warn('Error saving projections plan:', err);
  }
}

export interface CategoryAlert {
  category: Category;
  projected: number;
  actual: number;
  pct: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  difference: number;
}

export interface CumulativeYearSummary {
  year: number;
  currentMonthIndex: number;
  currentMonthName: string;
  // Totales Anuales
  projectedIncomeYear: number;
  actualIncomeYear: number;
  projectedExpenseYear: number;
  actualExpenseYear: number;
  projectedNetYear: number;
  actualNetYear: number;
  // Acumulado Año a la fecha (YTD)
  ytdProjectedIncome: number;
  ytdActualIncome: number;
  ytdProjectedExpense: number;
  ytdActualExpense: number;
  ytdProjectedNet: number;
  ytdActualNet: number;
  // Alertas de categorías en el mes actual
  currentMonthAlerts: CategoryAlert[];
}

/**
 * Calcula el resumen acumulativo del año y las alertas de presupuesto para el panel principal.
 */
export function calculateCumulativeYearSummary(
  categories: Category[],
  transactions: Transaction[],
  periods: FinancialPeriod[],
  budgets: Budget[],
  plan: AnnualProjectionsPlan,
  year: number = new Date().getFullYear(),
  currentMonthIndex: number = new Date().getMonth()
): CumulativeYearSummary {
  const matrix = calculateCategoryMatrix(
    categories,
    transactions,
    periods,
    budgets,
    plan,
    year,
    'monthly'
  );

  let ytdProjectedIncome = 0;
  let ytdActualIncome = 0;
  let ytdProjectedExpense = 0;
  let ytdActualExpense = 0;

  for (let m = 0; m <= currentMonthIndex && m < 12; m++) {
    const colId = `m_${m}`;
    ytdProjectedIncome += matrix.totalIncome.cells[colId]?.projected || 0;
    ytdActualIncome += matrix.totalIncome.cells[colId]?.actual || 0;
    ytdProjectedExpense += matrix.totalExpense.cells[colId]?.projected || 0;
    ytdActualExpense += matrix.totalExpense.cells[colId]?.actual || 0;
  }

  const currentColId = `m_${currentMonthIndex}`;
  const alerts: CategoryAlert[] = [];

  matrix.expenseRows.forEach((r) => {
    const cell = r.cells[currentColId];
    if (!cell) return;
    const proj = cell.projected;
    const act = cell.actual;
    const pct = proj > 0 ? Math.round((act / proj) * 100) : act > 0 ? 100 : 0;
    const isOver = act > proj && proj > 0;
    const isNear = pct >= 80 && pct <= 100;

    alerts.push({
      category: r.category,
      projected: proj,
      actual: act,
      pct,
      isOverBudget: isOver,
      isNearLimit: isNear,
      difference: proj - act,
    });
  });

  // Ordenar: primero las que están sobregiradas (>100%), luego cerca del límite (>=80%), luego por % descendente
  alerts.sort((a, b) => {
    if (a.isOverBudget && !b.isOverBudget) return -1;
    if (!a.isOverBudget && b.isOverBudget) return 1;
    if (a.isNearLimit && !b.isNearLimit) return -1;
    if (!a.isNearLimit && b.isNearLimit) return 1;
    return b.pct - a.pct;
  });

  return {
    year,
    currentMonthIndex,
    currentMonthName: MONTH_NAMES_ES[currentMonthIndex],
    projectedIncomeYear: matrix.totalIncome.annualProjected,
    actualIncomeYear: matrix.totalIncome.annualActual,
    projectedExpenseYear: matrix.totalExpense.annualProjected,
    actualExpenseYear: matrix.totalExpense.annualActual,
    projectedNetYear: matrix.netDifference.annualProjected,
    actualNetYear: matrix.netDifference.annualActual,
    ytdProjectedIncome: Math.round(ytdProjectedIncome * 100) / 100,
    ytdActualIncome: Math.round(ytdActualIncome * 100) / 100,
    ytdProjectedExpense: Math.round(ytdProjectedExpense * 100) / 100,
    ytdActualExpense: Math.round(ytdActualExpense * 100) / 100,
    ytdProjectedNet: Math.round((ytdProjectedIncome - ytdProjectedExpense) * 100) / 100,
    ytdActualNet: Math.round((ytdActualIncome - ytdActualExpense) * 100) / 100,
    currentMonthAlerts: alerts,
  };
}

