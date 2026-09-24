import type { Cents } from './types';

/** 158345 → "1'583.45" (format suisse, apostrophe droite). */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const francs = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const centimes = String(abs % 100).padStart(2, '0');
  return `${sign}${francs}.${centimes}`;
}

/** Version courte pour l'affichage : 6800 → "68", 6850 → "68.50". */
export function formatShort(cents: Cents): string {
  const full = formatCents(cents);
  return cents % 100 === 0 ? full.slice(0, -3) : full;
}

/** 158345 → "1'583.45 CHF" */
export function formatCHF(cents: Cents): string {
  return `${formatCents(cents)} CHF`;
}

/**
 * Lit un montant saisi : "12", "12.5", "12,50", "1'200" → centimes.
 * Renvoie null si la saisie n'est pas un montant positif valide (max 2 décimales).
 */
export function parseAmount(input: string): Cents | null {
  const cleaned = input.trim().replace(/['’\s]/g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const francs = Number(match[1]);
  const centimes = Number((match[2] ?? '').padEnd(2, '0'));
  return francs * 100 + centimes;
}
