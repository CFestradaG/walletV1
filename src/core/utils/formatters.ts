const MONTHS_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const MONTHS_FULL_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export function formatGTQ(
  amount: number,
  options?: {
    showSign?: boolean;
    useCode?: boolean;
    compact?: boolean;
    hide?: boolean;
    decimals?: number;
  }
): string {
  if (options?.hide) {
    return options?.useCode ? 'GTQ ••••••••' : 'Q ••••••';
  }
  const decimals = options?.decimals ?? 2;
  const absVal = Math.abs(amount);
  const sign = amount < 0 ? '-' : options?.showSign && amount > 0 ? '+' : '';
  const prefix = options?.useCode ? 'GTQ ' : 'Q ';

  if (options?.compact && absVal >= 1000) {
    const kVal = (absVal / 1000).toFixed(1);
    return `${sign}${options?.useCode ? 'GTQ ' : 'Q'}${kVal}k`;
  }

  const formattedNum = absVal.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${sign}${prefix}${formattedNum}`;
}

export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(dateStr: string, days: number): string {
  const dt = parseISODate(dateStr);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

export function diffDaysInclusive(startStr: string, endStr: string): number {
  const start = parseISODate(startStr);
  const end = parseISODate(endStr);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function formatDateShortES(dateStr: string, includeYear = false): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthName = MONTHS_SHORT_ES[(m || 1) - 1] || '';
  return includeYear ? `${String(d).padStart(2, '0')} ${monthName} ${y}` : `${String(d).padStart(2, '0')} ${monthName}`;
}

export function formatDateSlash(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateLongES(dateStr: string): string {
  if (!dateStr) return '';
  const dt = parseISODate(dateStr);
  const dayName = DAYS_ES[dt.getDay()];
  const d = dt.getDate();
  const monthName = MONTHS_FULL_ES[dt.getMonth()];
  return `${dayName}, ${d} de ${monthName}`;
}

export function formatPeriodRangeES(startDate: string, endDate: string, includeYear = false): string {
  return `${formatDateShortES(startDate, includeYear)} → ${formatDateShortES(endDate, includeYear)}`;
}

export function evaluateCalculatorExpression(expr: string): number | null {
  try {
    const cleaned = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/[^0-9+\-*/.() ]/g, '')
      .trim();

    if (!cleaned) return 0;

    let openCount = 0;
    for (const ch of cleaned) {
      if (ch === '(') openCount++;
      if (ch === ')') openCount = Math.max(0, openCount - 1);
    }
    const balanced = cleaned + ')'.repeat(openCount);

    const fn = new Function(`"use strict"; return (${balanced});`);
    const result = Number(fn());
    if (Number.isNaN(result) || !Number.isFinite(result)) {
      return null;
    }
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export const formatShortDateES = formatDateShortES;

export function evaluateArithmetic(expr: string): number {
  const res = evaluateCalculatorExpression(expr);
  if (res !== null && !isNaN(res)) {
    return res;
  }
  const fallback = parseFloat(expr);
  return isNaN(fallback) ? 0 : fallback;
}
