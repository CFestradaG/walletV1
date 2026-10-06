import { FinancialPeriod, Subperiod, SubdivisionMode, Transaction } from '../../core/types/models';
import { addDaysISO, diffDaysInclusive, parseISODate, toISODate } from '../../core/utils/formatters';

export interface PeriodValidationResult {
  valid: boolean;
  error?: string;
  conflictingPeriod?: FinancialPeriod;
  overlapDays?: number;
  suggestedStartDate?: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODateString(dateStr: string): boolean {
  if (!dateStr || !ISO_DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function validateFinancialPeriod(
  candidate: {
    name: string;
    referenceMonth?: number;
    startDate: string;
    endDate: string;
    subdivisionMode: SubdivisionMode;
    monthIndex?: number;
  },
  existingPeriods: FinancialPeriod[],
  editingPeriodId?: string
): PeriodValidationResult {
  const trimmedName = (candidate.name || '').trim();
  if (!trimmedName) {
    return {
      valid: false,
      error: 'El nombre del período financiero es obligatorio.',
    };
  }

  if (!isValidISODateString(candidate.startDate) || !isValidISODateString(candidate.endDate)) {
    return {
      valid: false,
      error: 'Las fechas ingresadas no tienen un formato válido.',
    };
  }

  if (candidate.endDate < candidate.startDate) {
    return {
      valid: false,
      error: 'La fecha final no puede ser anterior a la fecha inicial.',
    };
  }

  const totalDays = diffDaysInclusive(candidate.startDate, candidate.endDate);
  if (totalDays <= 0) {
    return {
      valid: false,
      error: 'El período financiero no puede estar vacío.',
    };
  }

  for (const existing of existingPeriods) {
    if (editingPeriodId && existing.id === editingPeriodId) {
      continue;
    }

    if (candidate.startDate <= existing.endDate && candidate.endDate >= existing.startDate) {
      const overlapStart = candidate.startDate > existing.startDate ? candidate.startDate : existing.startDate;
      const overlapEnd = candidate.endDate < existing.endDate ? candidate.endDate : existing.endDate;
      const overlapDays = diffDaysInclusive(overlapStart, overlapEnd);
      const suggestedStartDate = addDaysISO(existing.endDate, 1);

      return {
        valid: false,
        error: 'Las fechas seleccionadas se superponen con otro período financiero.',
        conflictingPeriod: existing,
        overlapDays,
        suggestedStartDate,
      };
    }
  }

  return { valid: true };
}

export function generateSubperiods(
  p1: string,
  p2: string,
  p3: string,
  p4?: SubdivisionMode
): Subperiod[] {
  let periodId = 'temp';
  let startDate = p1;
  let endDate = p2;
  let mode: SubdivisionMode = p3 as SubdivisionMode;
  if (p4 !== undefined) {
    periodId = p1;
    startDate = p2;
    endDate = p3;
    mode = p4;
  }
  if (mode === 'none') {
    return [];
  }
  if (!isValidISODateString(startDate) || !isValidISODateString(endDate) || endDate < startDate) {
    return [];
  }

  const totalDays = diffDaysInclusive(startDate, endDate);
  const subperiods: Subperiod[] = [];

  if (mode === 'weekly') {
    let currentStart = startDate;
    let index = 1;
    while (currentStart <= endDate) {
      const candidateEnd = addDaysISO(currentStart, 6);
      const currentEnd = candidateEnd <= endDate ? candidateEnd : endDate;
      const daysCount = diffDaysInclusive(currentStart, currentEnd);

      subperiods.push({
        id: `${periodId}_sub_w${index}`,
        periodId,
        index,
        label: `S${index}`,
        name: `Semana ${index}`,
        startDate: currentStart,
        endDate: currentEnd,
        daysCount,
      });

      currentStart = addDaysISO(currentEnd, 1);
      index++;
    }
    return subperiods;
  }

  if (mode === 'biweekly') {
    if (totalDays <= 15) {
      return [
        {
          id: `${periodId}_sub_q1`,
          periodId,
          index: 1,
          label: 'Q1',
          name: 'Quincena 1',
          startDate,
          endDate,
          daysCount: totalDays,
        },
      ];
    }

    if (totalDays <= 35) {
      const firstHalfDays = totalDays >= 28 ? 15 : Math.max(1, Math.floor(totalDays / 2));
      const q1End = addDaysISO(startDate, firstHalfDays - 1);
      const q2Start = addDaysISO(q1End, 1);

      return [
        {
          id: `${periodId}_sub_q1`,
          periodId,
          index: 1,
          label: 'Q1',
          name: 'Quincena 1',
          startDate,
          endDate: q1End,
          daysCount: diffDaysInclusive(startDate, q1End),
        },
        {
          id: `${periodId}_sub_q2`,
          periodId,
          index: 2,
          label: 'Q2',
          name: 'Quincena 2',
          startDate: q2Start,
          endDate,
          daysCount: diffDaysInclusive(q2Start, endDate),
        },
      ];
    }

    let currentStart = startDate;
    let index = 1;
    while (currentStart <= endDate) {
      const candidateEnd = addDaysISO(currentStart, 14);
      const remainingAfter = diffDaysInclusive(candidateEnd, endDate) - 1;
      const currentEnd = candidateEnd >= endDate || remainingAfter <= 3 ? endDate : candidateEnd;
      const daysCount = diffDaysInclusive(currentStart, currentEnd);

      subperiods.push({
        id: `${periodId}_sub_q${index}`,
        periodId,
        index,
        label: `Q${index}`,
        name: `Quincena ${index}`,
        startDate: currentStart,
        endDate: currentEnd,
        daysCount,
      });

      currentStart = addDaysISO(currentEnd, 1);
      index++;
    }
    return subperiods;
  }

  if (totalDays <= 35) {
    return [
      {
        id: `${periodId}_sub_m1`,
        periodId,
        index: 1,
        label: 'M1',
        name: 'Ciclo Mensual',
        startDate,
        endDate,
        daysCount: totalDays,
      },
    ];
  }

  let currentStart = startDate;
  let index = 1;
  while (currentStart <= endDate) {
    const dt = parseISODate(currentStart);
    dt.setMonth(dt.getMonth() + 1);
    dt.setDate(dt.getDate() - 1);
    const candidateEnd = toISODate(dt);
    const currentEnd = candidateEnd <= endDate ? candidateEnd : endDate;
    const daysCount = diffDaysInclusive(currentStart, currentEnd);

    subperiods.push({
      id: `${periodId}_sub_m${index}`,
      periodId,
      index,
      label: `M${index}`,
      name: `Mes ${index}`,
      startDate: currentStart,
      endDate: currentEnd,
      daysCount,
    });

    currentStart = addDaysISO(currentEnd, 1);
    index++;
  }

  return subperiods;
}

export function verifySubdivisionIntegrity(period: FinancialPeriod): {
  isValid: boolean;
  totalDays: number;
  coveredDays: number;
  hasGaps: boolean;
  hasOverlaps: boolean;
  startsAtPeriodStart: boolean;
  endsAtPeriodEnd: boolean;
} {
  const subs = period.subperiods;
  const totalDays = diffDaysInclusive(period.startDate, period.endDate);

  if (!subs || subs.length === 0) {
    return {
      isValid: false,
      totalDays,
      coveredDays: 0,
      hasGaps: true,
      hasOverlaps: false,
      startsAtPeriodStart: false,
      endsAtPeriodEnd: false,
    };
  }

  const startsAtPeriodStart = subs[0].startDate === period.startDate;
  const endsAtPeriodEnd = subs[subs.length - 1].endDate === period.endDate;
  let hasGaps = false;
  let hasOverlaps = false;
  let coveredDays = 0;

  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    if (s.endDate < s.startDate || s.startDate < period.startDate || s.endDate > period.endDate) {
      return {
        isValid: false,
        totalDays,
        coveredDays,
        hasGaps: true,
        hasOverlaps: true,
        startsAtPeriodStart,
        endsAtPeriodEnd,
      };
    }
    coveredDays += diffDaysInclusive(s.startDate, s.endDate);

    if (i > 0) {
      const prev = subs[i - 1];
      const expectedNextStart = addDaysISO(prev.endDate, 1);
      if (s.startDate > expectedNextStart) {
        hasGaps = true;
      } else if (s.startDate < expectedNextStart) {
        hasOverlaps = true;
      }
    }
  }

  const isValid =
    startsAtPeriodStart &&
    endsAtPeriodEnd &&
    !hasGaps &&
    !hasOverlaps &&
    coveredDays === totalDays;

  return {
    isValid,
    totalDays,
    coveredDays,
    hasGaps,
    hasOverlaps,
    startsAtPeriodStart,
    endsAtPeriodEnd,
  };
}

export function resolveTransactionPeriod(
  txDate: string,
  periods: FinancialPeriod[]
): { period?: FinancialPeriod; subperiod?: Subperiod } {
  for (const period of periods) {
    if (txDate >= period.startDate && txDate <= period.endDate) {
      const subperiod = period.subperiods.find(
        (sub) => txDate >= sub.startDate && txDate <= sub.endDate
      );
      return { period, subperiod };
    }
  }
  return {};
}

export function syncTransactionsWithPeriods(
  transactions: Transaction[],
  periods: FinancialPeriod[]
): Transaction[] {
  return transactions.map((tx) => {
    const resolved = resolveTransactionPeriod(tx.date, periods);
    return {
      ...tx,
      periodId: resolved.period?.id,
      subperiodId: resolved.subperiod?.id,
    };
  });
}
