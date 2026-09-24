import Dexie, { type Table } from 'dexie';
import type {
  AccountMove,
  BudgetData,
  Envelope,
  EnvelopeBudget,
  Expense,
  IncomeEntry,
  IncomeTemplate,
  MonthClose,
  Settings,
} from './domain/types';

type SettingsRow = Settings & { key: 'main' };

/** Base locale (IndexedDB) : les données ne quittent jamais le téléphone. */
class BudgetDB extends Dexie {
  envelopes!: Table<Envelope, string>;
  budgets!: Table<EnvelopeBudget, number>;
  expenses!: Table<Expense, string>;
  incomeTemplates!: Table<IncomeTemplate, string>;
  incomes!: Table<IncomeEntry, string>;
  closes!: Table<MonthClose, string>;
  moves!: Table<AccountMove, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('budget-app');
    this.version(1).stores({
      envelopes: 'id, order',
      budgets: '++id, envelopeId, fromMonth',
      expenses: 'id, envelopeId, date',
      incomeTemplates: 'id, order',
      incomes: 'id, month',
      closes: 'month',
      moves: 'id, date',
      settings: 'key',
    });
  }
}

export const db = new BudgetDB();

/** Charge tout pour le moteur de calcul. Renvoie null avant le premier lancement. */
export async function loadBudgetData(): Promise<BudgetData | null> {
  const row = await db.settings.get('main');
  if (!row) return null;
  const { key: _key, ...settings } = row;
  const [incomeTemplates, envelopes, budgets, expenses, incomes, closes, moves] = await Promise.all([
    db.incomeTemplates.toArray(),
    db.envelopes.toArray(),
    db.budgets.toArray(),
    db.expenses.toArray(),
    db.incomes.toArray(),
    db.closes.toArray(),
    db.moves.toArray(),
  ]);
  return { settings, incomeTemplates, envelopes, budgets, expenses, incomes, closes, moves };
}

/**
 * Demande au navigateur de ne pas effacer les données en cas de manque d'espace.
 * Sur iPhone, l'app installée sur l'écran d'accueil est déjà protégée ; ailleurs, c'est un filet.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
