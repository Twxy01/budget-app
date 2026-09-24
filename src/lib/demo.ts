/**
 * Données de démonstration, utilisées uniquement en développement tant que l'écran
 * de premier lancement (étape 4) n'existe pas.
 *
 * Ce fichier n'est jamais inclus dans la version publiée : il est chargé par import
 * dynamique derrière `import.meta.env.DEV`. Les soldes de comptes restent fictifs.
 */
import { db } from './db';
import { addMonths, monthOf, todayKey } from './domain/dates';
import type { Envelope, EnvelopeBudget, Expense } from './domain/types';
import { newId } from './store.svelte';

export async function seedDemo() {
  const today = todayKey();
  const month = monthOf(today);
  const previous = addMonths(month, -1);
  // Premier lancement fictif le mois dernier, pour pouvoir tester les flèches ‹ ›.
  const startDate = `${previous}-15`;

  const defs: [string, Envelope['type'], number, number | null, string][] = [
    ['Parachute', 'monthly', 50000, null, 'Sauts, licence, frais sur place'],
    ['Social', 'monthly', 10000, null, 'Avec les potes : soirées, bar, restos'],
    ['Copine', 'monthly', 10000, null, 'Avec elle : restos, sorties, attentions'],
    ['Conso', 'monthly', 10000, null, 'Conso'],
    ['Essence', 'monthly', 10000, null, 'Essence et parking'],
    ['Quotidien', 'monthly', 13500, null, 'Snacks, repas du mardi, station-service'],
    ['Repas', 'pot', 14000, 47000, 'Achat groupé des repas'],
    ['Plaisirs', 'pot', 10800, 50000, 'Gros achats et gros cadeaux'],
  ];

  const envelopes: Envelope[] = defs.map(([name, type, , , memo], order) => ({
    id: newId(),
    name,
    type,
    memo,
    order,
    archivedFrom: null,
    startBalanceCents: 0,
  }));
  const budgets: EnvelopeBudget[] = defs.map(([, , amountCents, maxCents], i) => ({
    envelopeId: envelopes[i].id,
    fromMonth: previous,
    amountCents,
    maxCents,
  }));

  const byName = (name: string) => envelopes.find((e) => e.name === name)!.id;
  const day = (m: string, d: number) => {
    const date = `${m}-${String(d).padStart(2, '0')}`;
    return date > today ? today : date;
  };
  const x = (name: string, amountCents: number, date: string, note: string): Expense => ({
    id: newId(),
    envelopeId: byName(name),
    amountCents,
    note,
    date,
    createdAt: Date.now(),
  });
  const expenses: Expense[] = [
    x('Social', 1000, day(previous, 17), 'Coop Pronto soirée'),
    x('Quotidien', 800, day(previous, 18), 'Goûter'),
    x('Parachute', 26000, day(previous, 20), 'Sauts'),
    x('Copine', 11500, `${previous}-27`, 'Resto'),
    x('Essence', 1500, day(month, 2), 'Essence + parking'),
    x('Social', 3200, day(month, 3), 'Soirée'),
    x('Quotidien', 800, day(month, 4), 'Petit-déj'),
    x('Quotidien', 1450, day(month, 5), 'Repas mardi'),
    x('Copine', 5400, day(month, 6), 'Resto midi'),
  ];

  await db.transaction('rw', db.tables, async () => {
    await db.settings.put({
      key: 'main',
      startDate,
      startCurrentCents: 120000,
      startSavingsCents: 250000,
      fixedSavings: [{ fromMonth: previous, amountCents: 30000 }],
    });
    await db.envelopes.bulkAdd(envelopes);
    await db.budgets.bulkAdd(budgets);
    await db.expenses.bulkAdd(expenses);
    await db.incomeTemplates.bulkAdd([
      { id: newId(), name: 'Salaire', amountCents: 91845, order: 0 },
      { id: newId(), name: 'Aide parentale', amountCents: 66500, order: 1 },
    ]);
    // Aucun revenu confirmé : la carte « Revenus du mois » s'affiche au lancement.
  });
}

export async function resetAll() {
  await Promise.all(db.tables.map((t) => t.clear()));
}
