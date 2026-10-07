export type TemplateRecurrence = 'weekly' | 'biweekly' | 'monthly';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function monthDate(baseDate: string, monthOffset: number): string {
  const [year, month, day] = baseDate.split('-').map(Number);
  const targetMonth = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** Returns the first scheduled date strictly after `afterDate`, anchored to the original start date. */
export function getNextTemplateOccurrence(
  startDate: string,
  frequency: TemplateRecurrence,
  afterDate: string
): string {
  const base = dateOnly(startDate);
  const after = dateOnly(afterDate);
  if (after < base) return base;

  if (frequency === 'monthly') {
    const [baseYear, baseMonth] = base.split('-').map(Number);
    const [afterYear, afterMonth] = after.split('-').map(Number);
    let offset = Math.max(0, (afterYear - baseYear) * 12 + afterMonth - baseMonth);
    while (monthDate(base, offset) <= after) offset += 1;
    return monthDate(base, offset);
  }

  const intervalDays = frequency === 'weekly' ? 7 : 15;
  const elapsed = Math.floor((Date.parse(`${after}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / DAY_MS);
  const cycles = Math.floor(elapsed / intervalDays) + 1;
  return new Date(Date.parse(`${base}T00:00:00Z`) + cycles * intervalDays * DAY_MS).toISOString().slice(0, 10);
}
