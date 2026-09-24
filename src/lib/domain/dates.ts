import type { DateKey, MonthKey } from './types';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date du jour en heure locale (et non UTC, sinon une dépense à 23h tomberait le lendemain). */
export function todayKey(now: Date = new Date()): DateKey {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Liste des mois de `from` à `to`, bornes incluses. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  return months;
}

/** Dernier jour du mois : '2026-02' → '2026-02-28'. */
export function lastDayOf(month: MonthKey): DateKey {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
}

/** 'Aujourd'hui', 'Hier' ou 'lun. 21 sept.' */
export function dayLabel(date: DateKey, today: DateKey): string {
  if (date === today) return "Aujourd'hui";
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const yesterday = new Date(day);
  yesterday.setDate(d + 1);
  if (todayKey(yesterday) === today) return 'Hier';
  return day.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** 'Septembre 2026' */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
