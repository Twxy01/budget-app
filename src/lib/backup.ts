/**
 * Sauvegarde : un fichier JSON que tu ranges où tu veux (Fichiers, iCloud Drive, mail…).
 * C'est la seule copie de tes données hors du téléphone, et elle ne part nulle part toute seule.
 */
import { db } from './db';
import { todayKey } from './domain/dates';
import type { BudgetData } from './domain/types';

const FORMAT = 'budget-app';
const VERSION = 1;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  data: BudgetData;
}

async function collect(): Promise<BudgetData | null> {
  const row = await db.settings.get('main');
  if (!row) return null;
  const { key: _key, ...settings } = row;
  return {
    settings,
    incomeTemplates: await db.incomeTemplates.toArray(),
    envelopes: await db.envelopes.toArray(),
    budgets: await db.budgets.toArray(),
    expenses: await db.expenses.toArray(),
    incomes: await db.incomes.toArray(),
    closes: await db.closes.toArray(),
    moves: await db.moves.toArray(),
  };
}

/** Télécharge le fichier de sauvegarde. */
export async function exportBackup(): Promise<string | null> {
  const data = await collect();
  if (!data) return null;
  const file: BackupFile = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data };
  const name = `budget-${todayKey()}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

function check(file: unknown): asserts file is BackupFile {
  const candidate = file as Partial<BackupFile>;
  if (candidate?.format !== FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde de l'app.");
  if (candidate.version !== VERSION) throw new Error('Cette sauvegarde vient d’une autre version de l’app.');
  const data = candidate.data as Partial<BudgetData> | undefined;
  if (!data?.settings?.startDate) throw new Error('Sauvegarde incomplète : réglages manquants.');
  for (const key of ['envelopes', 'budgets', 'expenses', 'incomes', 'closes', 'moves', 'incomeTemplates'] as const) {
    if (!Array.isArray(data[key])) throw new Error(`Sauvegarde incomplète : ${key} manquant.`);
  }
}

/** Remplace **toutes** les données actuelles par celles du fichier. */
export async function importBackup(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text());
  check(parsed);
  const { settings, incomeTemplates, envelopes, budgets, expenses, incomes, closes, moves } = parsed.data;
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.put({ key: 'main', ...settings });
    await db.incomeTemplates.bulkAdd(incomeTemplates);
    await db.envelopes.bulkAdd(envelopes);
    await db.budgets.bulkAdd(budgets.map(({ id: _id, ...rest }) => rest));
    await db.expenses.bulkAdd(expenses);
    await db.incomes.bulkAdd(incomes);
    await db.closes.bulkAdd(closes);
    await db.moves.bulkAdd(moves);
  });
}
