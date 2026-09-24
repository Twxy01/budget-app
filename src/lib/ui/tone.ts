import type { Cents } from '../domain/types';

/** Couleur de la jauge d'une enveloppe mensuelle : orange sous 25 % du plafond, rouge en dépassement. */
export function monthlyTone(remainingCents: Cents, budgetCents: Cents): 'ok' | 'warn' | 'danger' {
  if (remainingCents < 0) return 'danger';
  if (budgetCents > 0 && remainingCents / budgetCents < 0.25) return 'warn';
  return 'ok';
}

export function ratio(part: Cents, total: Cents | null): number {
  return total ? part / total : 0;
}
