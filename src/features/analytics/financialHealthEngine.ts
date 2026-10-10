import {
  Account,
  Category,
  FinancialPeriod,
  HealthScoreLevel,
  MonthlyExecutiveReport,
  Transaction,
  WeeklyHealthProgress,
  AnnualExecutiveSummary,
  AnnualWeekEntry,
  WeeklyAiInference,
} from '../../core/types/models';
import { MONTH_NAMES_ES } from '../annual_budget/annualBudgetEngine';

/**
 * Calculates a pure deterministic financial health diagnosis, weekly timeline, and prioritized advice.
 * Completely private and zero external cost.
 */
export function calculateFinancialHealthReport(
  userId: string,
  year: number,
  month: number, // 1 - 12
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  periods: FinancialPeriod[]
): MonthlyExecutiveReport {
  const monthName = MONTH_NAMES_ES[month - 1] || `Mes ${month}`;
  const reportId = `report_${year}_${String(month).padStart(2, '0')}`;

  // Month date range: YYYY-MM-01 to YYYY-MM-lastDay
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Filter transactions for this calendar month
  const monthTxs = transactions.filter(
    (t) => t.date >= startDateStr && t.date <= endDateStr
  );

  const totalIncome = monthTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = monthTxs
    .filter((t) => t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId)))
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpenses;
  const savingsRatePct =
    totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Portfolio balances (Liquidity and Debt)
  const liquidBalance = accounts
    .filter((a) => a.status === 'active' && a.type !== 'credit_card')
    .reduce((sum, a) => sum + (a.currentBalance ?? a.balance ?? 0), 0);

  const creditCardDebt = accounts
    .filter((a) => a.status === 'active' && a.type === 'credit_card')
    .reduce((sum, a) => sum + Math.max(0, -(a.currentBalance ?? a.balance ?? 0)), 0);

  // Liquidity months (Emergency runway)
  const avgMonthlyExpenses = Math.max(1, totalExpenses > 0 ? totalExpenses : 1000);
  const liquidityMonths = Math.round((liquidBalance / avgMonthlyExpenses) * 10) / 10;

  // Debt-to-Income (DTI)
  const debtToIncomeRatioPct =
    totalIncome > 0 ? Math.round((creditCardDebt / totalIncome) * 100) : creditCardDebt > 0 ? 100 : 0;

  // 1. Calculate 4 Weeks breakdown
  const weeks: WeeklyHealthProgress[] = [];
  const weekRanges = [
    { weekIndex: 1, startDay: 1, endDay: 7 },
    { weekIndex: 2, startDay: 8, endDay: 14 },
    { weekIndex: 3, startDay: 15, endDay: 21 },
    { weekIndex: 4, startDay: 22, endDay: lastDay },
  ];

  const expectedWeeklyBudget = totalIncome > 0 ? (totalIncome * 0.8) / 4 : avgMonthlyExpenses / 4;

  for (const range of weekRanges) {
    const wStart = `${year}-${String(month).padStart(2, '0')}-${String(range.startDay).padStart(2, '0')}`;
    const wEnd = `${year}-${String(month).padStart(2, '0')}-${String(range.endDay).padStart(2, '0')}`;

    const wTxs = monthTxs.filter((t) => t.date >= wStart && t.date <= wEnd);
    const wIncome = wTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const wExpenses = wTxs
      .filter((t) => t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId)))
      .reduce((s, t) => s + t.amount, 0);

    const wSavings = wIncome - wExpenses;
    const burnRatePct = expectedWeeklyBudget > 0 ? Math.round((wExpenses / expectedWeeklyBudget) * 100) : 0;

    let status: WeeklyHealthProgress['status'] = 'on_track';
    let highlight = 'Gasto controlado dentro del rango previsto.';

    if (burnRatePct > 130) {
      status = 'critical';
      highlight = `Ritmo de gasto elevado (+${burnRatePct - 100}% sobre lo esperado semanal).`;
    } else if (burnRatePct > 105) {
      status = 'warning';
      highlight = 'Ligera aceleración en egresos semanales.';
    } else if (wExpenses === 0 && wIncome === 0) {
      highlight = 'Sin movimientos registrados en este lapso.';
    } else if (wSavings > 0) {
      highlight = `Superávit semanal saludable (+Q${wSavings.toLocaleString()}).`;
    }

    weeks.push({
      weekIndex: range.weekIndex,
      startDate: wStart,
      endDate: wEnd,
      income: wIncome,
      expenses: wExpenses,
      netSavings: wSavings,
      burnRateVsExpectedPct: burnRatePct,
      status,
      highlight,
    });
  }

  // 2. Score Calculation (0 to 100)
  // Pillar A: Savings Rate (max 35 pts) -> >= 20% gives 35 pts
  let scoreA = 0;
  if (savingsRatePct >= 20) scoreA = 35;
  else if (savingsRatePct > 0) scoreA = Math.round((savingsRatePct / 20) * 35);
  else if (savingsRatePct >= -10) scoreA = 10;
  else scoreA = 0;

  // Pillar B: Debt to Income (max 30 pts) -> DTI <= 15% gives 30 pts, DTI > 50% gives 5 pts
  let scoreB = 0;
  if (debtToIncomeRatioPct <= 10) scoreB = 30;
  else if (debtToIncomeRatioPct <= 30) scoreB = 22;
  else if (debtToIncomeRatioPct <= 50) scoreB = 12;
  else scoreB = 5;

  // Pillar C: Liquidity Runway (max 20 pts) -> >= 3 months gives 20 pts
  let scoreC = 0;
  if (liquidityMonths >= 3) scoreC = 20;
  else if (liquidityMonths >= 1) scoreC = 14;
  else if (liquidityMonths >= 0.5) scoreC = 8;
  else scoreC = 3;

  // Pillar D: Weekly discipline (max 15 pts) -> based on weeks status
  const criticalWeeks = weeks.filter((w) => w.status === 'critical').length;
  const warningWeeks = weeks.filter((w) => w.status === 'warning').length;
  let scoreD = 15 - (criticalWeeks * 6) - (warningWeeks * 3);
  if (scoreD < 0) scoreD = 0;

  const totalScore = Math.max(5, Math.min(100, scoreA + scoreB + scoreC + scoreD));

  let level: HealthScoreLevel = 'moderate';
  let badgeLabel = 'Saludable';

  if (totalScore >= 85) {
    level = 'excellent';
    badgeLabel = 'Excelente';
  } else if (totalScore >= 70) {
    level = 'solid';
    badgeLabel = 'Sólida';
  } else if (totalScore >= 50) {
    level = 'moderate';
    badgeLabel = 'Moderada';
  } else if (totalScore >= 35) {
    level = 'alert';
    badgeLabel = 'Alerta';
  } else {
    level = 'critical';
    badgeLabel = 'Crítica';
  }

  // 3. Actionable prioritized recommendations
  const recommendations: MonthlyExecutiveReport['recommendations'] = [];

  if (creditCardDebt > 0) {
    const debtRatio = debtToIncomeRatioPct;
    if (debtRatio > 35) {
      recommendations.push({
        id: 'rec_debt_high',
        type: 'debt',
        priority: 'high',
        title: 'Priorizar liquidación de saldos en tarjetas',
        detail: `Tu nivel de endeudamiento representa el ${debtRatio}% de tus ingresos mensuales. Asigna pagos extraordinarios antes de las fechas de corte para reducir cargos por financiamiento.`,
        actionLabel: 'Ver tarjetas',
      });
    } else {
      recommendations.push({
        id: 'rec_debt_normal',
        type: 'debt',
        priority: 'medium',
        title: 'Mantener control sobre saldos revolventes',
        detail: `Tienes una deuda activa de Q${creditCardDebt.toLocaleString()}. Efectúa los pagos completos para conservar un uso menor al 30% del límite de crédito.`,
        actionLabel: 'Abonar tarjeta',
      });
    }
  }

  if (savingsRatePct < 10) {
    recommendations.push({
      id: 'rec_savings_boost',
      type: 'savings',
      priority: savingsRatePct < 0 ? 'high' : 'medium',
      title: savingsRatePct < 0 ? 'Déficit operativo en el período' : 'Margen de ahorro ajustado',
      detail:
        savingsRatePct < 0
          ? `Tus egresos superan los ingresos en Q${Math.abs(netSavings).toLocaleString()}. Revisa categorías flexibles (salidas, ocio o suscripciones) para restablecer balance.`
          : `Tu tasa de ahorro mensual es del ${savingsRatePct}%. Trata de apartar un 10-15% a cuentas de ahorro intocables al inicio del ciclo.`,
      actionLabel: 'Revisar presupuesto',
    });
  }

  if (liquidityMonths < 1.5) {
    recommendations.push({
      id: 'rec_emergency_fund',
      type: 'savings',
      priority: 'high',
      title: 'Construir colchón de liquidez para imprevistos',
      detail: `Tu saldo líquido disponible actual cubre aprox. ${liquidityMonths} meses de egresos. La meta sugerida para tranquilidad financiera es de al menos 3 a 6 meses.`,
      actionLabel: 'Ver cuentas líquidas',
    });
  }

  // Weekly burn observation
  const fastestWeek = [...weeks].sort((a, b) => b.expenses - a.expenses)[0];
  if (fastestWeek && fastestWeek.expenses > 0 && fastestWeek.burnRateVsExpectedPct > 115) {
    recommendations.push({
      id: 'rec_weekly_pace',
      type: 'behavior',
      priority: 'low',
      title: `Contención recomendada para la Semana ${fastestWeek.weekIndex}`,
      detail: `La Semana ${fastestWeek.weekIndex} concentró el mayor volumen de gasto (Q${fastestWeek.expenses.toLocaleString()}). Monitorear el ritmo semanal evita sorpresas a fin de mes.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'rec_on_track',
      type: 'behavior',
      priority: 'low',
      title: 'Excelente estabilidad y disciplina financiera',
      detail:
        'Tus ingresos cubren holgadamente tus obligaciones, el endeudamiento es bajo y la tasa de ahorro es consistente. Considera dirigir el excedente hacia metas a mediano plazo o inversión.',
      actionLabel: 'Ver metas',
    });
  }

  // Executive summary text
  const executiveSummaryText =
    `Diagnóstico de ${monthName} ${year}: Calificación de ${totalScore}/100 (${badgeLabel}). ` +
    `Ingresos totales de Q${totalIncome.toLocaleString()} frente a Q${totalExpenses.toLocaleString()} en egresos ` +
    `con un margen neto de Q${netSavings.toLocaleString()} (${savingsRatePct}% de ahorro). ` +
    `El colchón de liquidez cubre ${liquidityMonths} meses y el DTI en tarjetas se ubica en ${debtToIncomeRatioPct}%.`;

  const now = new Date().toISOString();

  return {
    id: reportId,
    userId,
    schemaVersion: 1,
    year,
    month,
    monthName,
    score: totalScore,
    level,
    badgeLabel,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRatePct,
    debtToIncomeRatioPct,
    liquidityMonths,
    weeks,
    recommendations,
    executiveSummaryText,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates the deterministic 52 calendar weeks log for the given year,
 * mapping each week to its date range, month of reference, and financial flow.
 */
export function calculate52WeeksYearLog(
  year: number,
  transactions: Transaction[]
): AnnualWeekEntry[] {
  const weeks: AnnualWeekEntry[] = [];
  const nowStr = new Date().toISOString().slice(0, 10);

  // Jan 1st of the year in UTC
  const startDateOfYear = new Date(Date.UTC(year, 0, 1));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalDays = isLeap ? 366 : 365;

  for (let w = 1; w <= 52; w++) {
    // Week start offset (0-indexed in days)
    const dayOffsetStart = (w - 1) * 7;
    // Week end offset (6 days later, or up to the last day of the year for week 52)
    const dayOffsetEnd = w === 52 ? totalDays - 1 : Math.min(totalDays - 1, dayOffsetStart + 6);

    const wStartDate = new Date(Date.UTC(year, 0, 1 + dayOffsetStart));
    const wEndDate = new Date(Date.UTC(year, 0, 1 + dayOffsetEnd));
    const wMidDate = new Date(Date.UTC(year, 0, 1 + Math.floor((dayOffsetStart + dayOffsetEnd) / 2)));

    const startStr = wStartDate.toISOString().slice(0, 10);
    const endStr = wEndDate.toISOString().slice(0, 10);

    const monthIndex = wMidDate.getUTCMonth(); // 0 to 11
    const monthName = MONTH_NAMES_ES[monthIndex] || `Mes ${monthIndex + 1}`;

    const wTxs = transactions.filter((t) => t.date >= startStr && t.date <= endStr);
    const income = wTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = wTxs
      .filter((t) => t.type === 'expense' || (t.type === 'transfer' && Boolean(t.categoryId)))
      .reduce((s, t) => s + t.amount, 0);
    const netSavings = income - expenses;

    // Weekly status
    let status: AnnualWeekEntry['status'] = 'on_track';
    let burnRatePct = 100;

    if (startStr > nowStr) {
      status = 'upcoming';
      burnRatePct = 0;
    } else {
      // Estimated baseline: 25% of monthly baseline
      if (expenses > 3500) {
        status = 'critical';
        burnRatePct = 140;
      } else if (expenses > 2500) {
        status = 'warning';
        burnRatePct = 115;
      } else {
        status = 'on_track';
        burnRatePct = expenses > 0 ? 90 : 0;
      }
    }

    weeks.push({
      weekNumber: w,
      year,
      monthIndex,
      monthName,
      startDate: startStr,
      endDate: endStr,
      income,
      expenses,
      netSavings,
      status,
      burnRateVsExpectedPct: burnRatePct,
    });
  }

  return weeks;
}

/**
 * Calculates the executive consolidated summary for the entire year
 */
export function calculateAnnualExecutiveSummary(
  reports: MonthlyExecutiveReport[],
  year: number,
  transactions?: Transaction[]
): AnnualExecutiveSummary {
  const weeks52 = transactions ? calculate52WeeksYearLog(year, transactions) : undefined;

  if (reports.length === 0) {
    return {
      year,
      scoreAvg: 0,
      level: 'moderate',
      badgeLabel: 'Sin datos',
      totalAnnualIncome: 0,
      totalAnnualExpenses: 0,
      totalAnnualSavings: 0,
      annualSavingsRatePct: 0,
      bestMonthName: 'N/A',
      toughestMonthName: 'N/A',
      strategicRecommendations: ['Registra movimientos en períodos para desbloquear el resumen anual gerencial.'],
      weeks52,
    };
  }

  const totalAnnualIncome = reports.reduce((s, r) => s + r.totalIncome, 0);
  const totalAnnualExpenses = reports.reduce((s, r) => s + r.totalExpenses, 0);
  const totalAnnualSavings = totalAnnualIncome - totalAnnualExpenses;
  const annualSavingsRatePct =
    totalAnnualIncome > 0 ? Math.round((totalAnnualSavings / totalAnnualIncome) * 100) : 0;

  const scoreAvg = Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length);

  const sortedBySavings = [...reports].sort((a, b) => b.netSavings - a.netSavings);
  const bestMonthName = sortedBySavings[0]?.monthName || 'N/A';
  const toughestMonthName = sortedBySavings[sortedBySavings.length - 1]?.monthName || 'N/A';

  let level: HealthScoreLevel = 'moderate';
  let badgeLabel = 'Sólida';
  if (scoreAvg >= 85) {
    level = 'excellent';
    badgeLabel = 'Excelente';
  } else if (scoreAvg >= 70) {
    level = 'solid';
    badgeLabel = 'Sólida';
  } else if (scoreAvg >= 50) {
    level = 'moderate';
    badgeLabel = 'Moderada';
  } else {
    level = 'alert';
    badgeLabel = 'En alerta';
  }

  const strategicRecommendations: string[] = [];
  if (annualSavingsRatePct >= 20) {
    strategicRecommendations.push('Comportamiento anual disciplinado con tasa de ahorro superior al 20%.');
    strategicRecommendations.push('Consolidar fondos de emergencia e iniciar aportaciones sistemáticas para metas de largo plazo.');
  } else if (annualSavingsRatePct >= 5) {
    strategicRecommendations.push('Superávit neto acumulado; optimizar meses con mayor volatilidad de gasto.');
    strategicRecommendations.push('Automatizar transferencias de ahorro a principios de cada período.');
  } else {
    strategicRecommendations.push('Año con presión sobre el flujo de efectivo; revisar estructura de costos fijos y tarjetas.');
  }

  return {
    year,
    scoreAvg,
    level,
    badgeLabel,
    totalAnnualIncome,
    totalAnnualExpenses,
    totalAnnualSavings,
    annualSavingsRatePct,
    bestMonthName,
    toughestMonthName,
    strategicRecommendations,
    weeks52,
  };
}

export interface CreditCardTacticalTip {
  type: 'strategy' | 'window' | 'due_reminder' | 'warning';
  title: string;
  message: string;
  badge?: string;
  recommendedCardName?: string;
  daysToPayment?: number;
}

/**
 * Generates an intelligent, subtle tactical tip for credit card usage
 * based on cutoff dates, payment due dates, and today's day of month.
 * Returns null if the user does NOT have any active credit cards.
 */
export function getCreditCardTacticalTip(
  accounts: Account[],
  currentDate: Date = new Date()
): CreditCardTacticalTip | null {
  const cards = accounts.filter(
    (a) => a.status === 'active' && a.type === 'credit_card'
  );

  if (cards.length === 0) return null;

  const today = currentDate.getDate();

  // Helper to compute grace period & days until payment if purchased today
  const getCardDetails = (card: Account) => {
    const cutoff = card.cutoffDay ?? 15;
    const paymentDue = card.paymentDueDay ?? 5;
    const debt = Math.max(0, -(card.currentBalance ?? card.balance ?? 0));
    const limit = card.creditLimit || 0;
    const utilization = limit > 0 ? Math.round((debt / limit) * 100) : 0;

    // Grace days between cutoff and payment due (typically ~20 days)
    const graceDays = paymentDue > cutoff ? paymentDue - cutoff : 30 - cutoff + paymentDue;

    let daysUntilPayment = 0;
    let isPastCutoff = false;
    let daysSinceCutoff = 0;
    let daysToCutoff = 0;

    if (today > cutoff) {
      isPastCutoff = true;
      daysSinceCutoff = today - cutoff;
      daysUntilPayment = (30 - today) + cutoff + graceDays;
    } else {
      isPastCutoff = false;
      daysToCutoff = cutoff - today;
      daysUntilPayment = (cutoff - today) + graceDays;
    }

    // Days until next payment due date:
    let daysToPayment = 0;
    if (today <= paymentDue) {
      daysToPayment = paymentDue - today;
    } else {
      daysToPayment = (30 - today) + paymentDue;
    }

    return {
      card,
      cutoff,
      paymentDue,
      debt,
      limit,
      utilization,
      isPastCutoff,
      daysSinceCutoff,
      daysToCutoff,
      daysUntilPayment,
      daysToPayment,
    };
  };

  const parsedCards = cards.map(getCardDetails);

  // Check 1: Urgent payment reminder (if any card has debt > 0 and payment is within 4 days)
  const dueUrgent = parsedCards.find((c) => c.debt > 0 && c.daysToPayment <= 4);
  if (dueUrgent) {
    const urgency = dueUrgent.daysToPayment === 0 ? 'hoy' : dueUrgent.daysToPayment === 1 ? 'mañana' : `en ${dueUrgent.daysToPayment} días`;
    return {
      type: 'due_reminder',
      title: `Pago próximo: ${dueUrgent.card.name}`,
      message: `Vence ${urgency} (día ${dueUrgent.paymentDue}). Saldo actual: Q${dueUrgent.debt.toLocaleString()}. Paga de contado para evitar cargos por financiamiento.`,
      badge: `Vence ${urgency}`,
      recommendedCardName: dueUrgent.card.name,
      daysToPayment: dueUrgent.daysToPayment,
    };
  }

  // Check 2: Multi-card strategy (2 or more cards)
  if (parsedCards.length >= 2) {
    const sortedByGrace = [...parsedCards].sort((a, b) => b.daysUntilPayment - a.daysUntilPayment);
    const bestCard = sortedByGrace[0];
    const secondCard = sortedByGrace[1];

    if (bestCard.cutoff !== secondCard.cutoff) {
      const [earlyCard, lateCard] = [...parsedCards].sort((a, b) => a.cutoff - b.cutoff);

      if (today > earlyCard.cutoff && today <= lateCard.cutoff) {
        return {
          type: 'strategy',
          title: `Estrategia: Usa ${earlyCard.card.name} ahora`,
          message: `Utiliza ${earlyCard.card.name} antes del día ${lateCard.cutoff} (cortó el ${earlyCard.cutoff}, obtienes ~${bestCard.daysUntilPayment} días de plazo al 0% de interés) y pasa a ${lateCard.card.name} después del día ${lateCard.cutoff}.`,
          badge: 'Estrategia activa',
          recommendedCardName: earlyCard.card.name,
          daysToPayment: bestCard.daysUntilPayment,
        };
      } else {
        return {
          type: 'strategy',
          title: `Estrategia de corte: ${bestCard.card.name}`,
          message: `Usa ${earlyCard.card.name} antes del día ${earlyCard.cutoff} y ${lateCard.card.name} después del día ${earlyCard.cutoff}. Hoy te conviene ${bestCard.card.name} para diferir el cobro al máximo plazo sin costo.`,
          badge: 'Uso inteligente',
          recommendedCardName: bestCard.card.name,
          daysToPayment: bestCard.daysUntilPayment,
        };
      }
    }
  }

  // Check 3: Single card (or cards with identical cutoff)
  const single = parsedCards[0];
  if (single.isPastCutoff && single.daysSinceCutoff <= 8) {
    return {
      type: 'window',
      title: `Ventana óptima: ${single.card.name}`,
      message: `Tu tarjeta recién cortó el día ${single.cutoff}. Es el momento ideal para compras mayores: tienes hasta ~${single.daysUntilPayment} días para liquidar al 0% de interés.`,
      badge: 'Ventana ideal',
      recommendedCardName: single.card.name,
      daysToPayment: single.daysUntilPayment,
    };
  }

  if (!single.isPastCutoff && single.daysToCutoff <= 3) {
    const daysText = single.daysToCutoff === 1 ? 'mañana' : `en ${single.daysToCutoff} días`;
    return {
      type: 'window',
      title: `Corte próximo en ${single.card.name}`,
      message: `Corta ${daysText} (día ${single.cutoff}). Si planeas una compra no urgente, espera al día ${single.cutoff + 1} para diferir su pago un mes completo.`,
      badge: 'Corte próximo',
      recommendedCardName: single.card.name,
    };
  }

  return {
    type: 'strategy',
    title: `Gestión de tarjeta: ${single.card.name}`,
    message: `Corte el día ${single.cutoff} y pago el día ${single.paymentDue}. Las compras después del día ${single.cutoff} entran en el siguiente ciclo (~45 días de financiamiento).`,
    badge: 'Financiamiento 0%',
    recommendedCardName: single.card.name,
    daysToPayment: single.daysUntilPayment,
  };
}

/**
 * Executes or falls back to an inferential weekly AI analysis.
 * Strictly sends anonymous aggregated metrics with zero personal identifiable information.
 */
export async function requestWeeklyAiInference(params: {
  weekData: WeeklyHealthProgress;
  monthlyContext: {
    netSavings: number;
    savingsRatePct: number;
    liquidityMonths: number;
    score: number;
    monthName: string;
  };
  cardTactics?: CreditCardTacticalTip | null;
  signal?: AbortSignal;
}): Promise<WeeklyAiInference> {
  const { weekData, monthlyContext, cardTactics, signal } = params;
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch('/api/financial-inference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        weekData: {
          weekIndex: weekData.weekIndex,
          startDate: weekData.startDate,
          endDate: weekData.endDate,
          income: weekData.income,
          expenses: weekData.expenses,
          netSavings: weekData.netSavings,
          burnRateVsExpectedPct: weekData.burnRateVsExpectedPct,
          status: weekData.status,
        },
        monthlyContext: {
          netSavings: monthlyContext.netSavings,
          savingsRatePct: monthlyContext.savingsRatePct,
          liquidityMonths: monthlyContext.liquidityMonths,
          score: monthlyContext.score,
          monthName: monthlyContext.monthName,
        },
        cardTactics: cardTactics
          ? {
              type: cardTactics.type,
            }
          : null,
      }),
      signal,
    });

    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.data) {
        return {
          weekIndex: weekData.weekIndex,
          patterns: json.data.patterns,
          actionableAdvice: json.data.actionableAdvice,
          tone: json.data.tone || 'positive',
          generatedAt: nowIso,
        };
      }
    }
  } catch (err) {
    // Graceful offline fallback
    console.warn('AI API fetch fell back to local inference heuristic:', err);
  }

  // High-fidelity local inferential fallback
  let fallbackPatterns = 'Patrón de gasto estable y consumo distribuido dentro de los límites del presupuesto.';
  let fallbackAdvice = 'Monitorea egresos flexibles y conserva el registro diario para blindar tu meta mensual.';
  let fallbackTone: WeeklyAiInference['tone'] = 'positive';

  if (weekData.burnRateVsExpectedPct > 125) {
    fallbackPatterns = `Aceleración de egresos en la Semana ${weekData.weekIndex} (+${weekData.burnRateVsExpectedPct - 100}% sobre lo esperado), concentrando mayor presión en el flujo.`;
    fallbackAdvice = 'Modera compras no planificadas durante los próximos días y posterga adquisiciones de ocio hacia el siguiente ciclo.';
    fallbackTone = 'caution';
  } else if (cardTactics?.type === 'due_reminder') {
    fallbackPatterns = `Ciclo semanal con vencimiento cercano de tarjeta (${cardTactics.title}).`;
    fallbackAdvice = `${cardTactics.message} Asegúrate de pagar de contado para blindar tu fondo de reserva.`;
    fallbackTone = 'urgent';
  } else if (weekData.netSavings > 0 && monthlyContext.savingsRatePct >= 15) {
    fallbackPatterns = `Excelente ritmo de superávit semanal con saldo favorable de Q${weekData.netSavings.toLocaleString()} y disciplina operativa constante.`;
    fallbackAdvice = 'Aprovecha este excedente para programar una transferencia directa a tu cuenta de ahorro o meta patrimonial.';
    fallbackTone = 'optimistic';
  } else if (cardTactics?.type === 'window' || cardTactics?.type === 'strategy') {
    fallbackPatterns = `Comportamiento semanal regular con oportunidad táctica identificada en tarjetas de crédito.`;
    fallbackAdvice = `${cardTactics.message}`;
    fallbackTone = 'positive';
  }

  return {
    weekIndex: weekData.weekIndex,
    patterns: fallbackPatterns,
    actionableAdvice: fallbackAdvice,
    tone: fallbackTone,
    generatedAt: nowIso,
  };
}
