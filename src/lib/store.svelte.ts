import { db, loadBudgetData, requestPersistentStorage } from './db';
import { addMonths, monthOf, todayKey } from './domain/dates';
import { startMonth } from './domain/engine';
import type { AccountMove, BudgetData, Envelope, Expense, MonthKey, Settings } from './domain/types';

/** Identifiant unique, y compris hors HTTPS (test sur le téléphone via le réseau local). */
export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export type ExpenseInput = Pick<Expense, 'envelopeId' | 'amountCents' | 'note' | 'date'>;

/**
 * État global de l'app. Les données sont rechargées depuis la base après chaque écriture :
 * le volume est minuscule et ça garantit que l'écran reflète exactement ce qui est enregistré.
 */
class Store {
  data = $state.raw<BudgetData | null>(null);
  loaded = $state(false);
  today = $state(todayKey());
  /** Mois affiché (flèches ‹ ›). */
  month = $state<MonthKey>(monthOf(todayKey()));

  get currentMonth(): MonthKey {
    return monthOf(this.today);
  }

  get canGoPrev(): boolean {
    return !!this.data && this.month > startMonth(this.data);
  }

  get canGoNext(): boolean {
    return this.month < this.currentMonth;
  }

  async init() {
    await this.reload();
    requestPersistentStorage();
    // L'app peut rester ouverte en arrière-plan plusieurs jours : on rafraîchit la date au retour.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const today = todayKey();
      if (today !== this.today) {
        if (this.month === this.currentMonth) this.month = monthOf(today);
        this.today = today;
      }
    });
  }

  async reload() {
    this.data = await loadBudgetData();
    this.loaded = true;
  }

  shiftMonth(delta: number) {
    const target = addMonths(this.month, delta);
    if (this.data && target >= startMonth(this.data) && target <= this.currentMonth) this.month = target;
  }

  async addExpense(input: ExpenseInput) {
    await db.expenses.add({ ...input, id: newId(), createdAt: Date.now() });
    await this.reload();
  }

  async updateExpense(id: string, input: ExpenseInput) {
    await db.expenses.update(id, { ...input });
    await this.reload();
  }

  async deleteExpense(id: string) {
    await db.expenses.delete(id);
    await this.reload();
  }

  /** Revenus du mois : confirmés en une touche, montants modifiables avant validation. */
  async confirmIncomes(month: MonthKey, items: { name: string; amountCents: number }[]) {
    await db.transaction('rw', db.incomes, async () => {
      const previous = await db.incomes.where('month').equals(month).toArray();
      await db.incomes.bulkDelete(previous.map((i) => i.id));
      await db.incomes.bulkAdd(items.map((item) => ({ ...item, id: newId(), month })));
    });
    await this.reload();
  }

  /** Bilan de fin de mois : montant réellement viré vers l'épargne, ou « pas ce mois ». */
  async closeMonth(month: MonthKey, proposedCents: number, savedCents: number) {
    await db.closes.put({
      month,
      status: savedCents > 0 ? 'confirmed' : 'skipped',
      proposedCents,
      savedCents,
      date: this.today,
    });
    await this.reload();
  }

  /**
   * Crée ou met à jour une enveloppe. Le montant et le maximum sont versionnés :
   * ils s'appliquent au mois en cours et aux suivants, les mois passés gardent les anciens.
   */
  async saveEnvelope(input: {
    id?: string;
    name: string;
    type: Envelope['type'];
    memo: string;
    amountCents: number;
    maxCents: number | null;
    startBalanceCents?: number;
  }) {
    const month = this.currentMonth;
    await db.transaction('rw', [db.envelopes, db.budgets], async () => {
      let id = input.id;
      if (id) {
        await db.envelopes.update(id, { name: input.name, type: input.type, memo: input.memo });
      } else {
        const count = await db.envelopes.count();
        id = newId();
        await db.envelopes.add({
          id,
          name: input.name,
          type: input.type,
          memo: input.memo,
          order: count,
          archivedFrom: null,
          startBalanceCents: input.startBalanceCents ?? 0,
        });
      }
      const existing = await db.budgets.where('envelopeId').equals(id).toArray();
      const current = existing.find((b) => b.fromMonth === month);
      const values = { amountCents: input.amountCents, maxCents: input.maxCents };
      if (current?.id) await db.budgets.update(current.id, values);
      else await db.budgets.add({ envelopeId: id, fromMonth: month, ...values });
    });
    await this.reload();
  }

  /** Supprime l'enveloppe si elle n'a aucune dépense, sinon l'archive pour garder l'historique. */
  async removeEnvelope(id: string): Promise<'deleted' | 'archived'> {
    const used = await db.expenses.where('envelopeId').equals(id).count();
    if (used === 0) {
      await db.transaction('rw', [db.envelopes, db.budgets], async () => {
        await db.envelopes.delete(id);
        const budgets = await db.budgets.where('envelopeId').equals(id).toArray();
        await db.budgets.bulkDelete(budgets.map((b) => b.id!));
      });
    } else {
      await db.envelopes.update(id, { archivedFrom: this.currentMonth });
    }
    await this.reload();
    return used === 0 ? 'deleted' : 'archived';
  }

  /** Remet une enveloppe archivée en service, à partir du mois en cours. */
  async restoreEnvelope(id: string) {
    await db.envelopes.update(id, { archivedFrom: null });
    await this.reload();
  }

  async reorderEnvelope(id: string, delta: number) {
    const list = [...(this.data?.envelopes ?? [])].sort((a, b) => a.order - b.order);
    const from = list.findIndex((e) => e.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await db.transaction('rw', db.envelopes, async () => {
      for (const [order, envelope] of list.entries()) await db.envelopes.update(envelope.id, { order });
    });
    await this.reload();
  }

  async saveIncomeTemplate(input: { id?: string; name: string; amountCents: number }) {
    if (input.id) await db.incomeTemplates.update(input.id, { name: input.name, amountCents: input.amountCents });
    else {
      const order = await db.incomeTemplates.count();
      await db.incomeTemplates.add({ id: newId(), name: input.name, amountCents: input.amountCents, order });
    }
    await this.reload();
  }

  async deleteIncomeTemplate(id: string) {
    await db.incomeTemplates.delete(id);
    await this.reload();
  }

  /** Épargne fixe : versionnée elle aussi, comme les montants d'enveloppes. */
  async setFixedSavings(amountCents: number) {
    const settings = this.data!.settings;
    const month = this.currentMonth;
    const fixedSavings = settings.fixedSavings.filter((v) => v.fromMonth !== month);
    fixedSavings.push({ fromMonth: month, amountCents });
    fixedSavings.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
    await db.settings.put({ key: 'main', ...settings, fixedSavings });
    await this.reload();
  }

  async saveSettings(patch: Partial<Settings>) {
    await db.settings.put({ key: 'main', ...this.data!.settings, ...patch });
    await this.reload();
  }

  async addMove(move: Omit<AccountMove, 'id'>) {
    await db.moves.add({ ...move, id: newId() });
    await this.reload();
  }

  async deleteMove(id: string) {
    await db.moves.delete(id);
    await this.reload();
  }
}

export const store = new Store();
