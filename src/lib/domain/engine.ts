/**
 * Moteur de calcul — fonctions pures, sans accès à la base.
 * Les règles sont celles du cahier des charges (docs/cahier-des-charges.md, §6).
 *
 * Conventions importantes :
 * - Le mois de départ (celui du premier lancement) n'a ni revenus ni ordre permanent :
 *   les soldes de départ saisis ce jour-là en tiennent déjà compte.
 * - Les soldes de comptes et de cagnottes ne comptent que ce qui est daté à partir du jour
 *   de départ. Une dépense antérieure saisie après coup compte dans son enveloppe, pas dans les soldes.
 * - L'ordre permanent (épargne fixe + contributions des cagnottes) est considéré comme fait
 *   chaque mois. Le retrait pour une dépense de cagnotte aussi : elle réduit donc l'épargne,
 *   pas le courant.
 */
import { addMonths, monthOf, monthRange } from './dates';
import type {
  BudgetData,
  Cents,
  DateKey,
  Envelope,
  EnvelopeBudget,
  MonthClose,
  MonthKey,
} from './types';

const sum = (values: Cents[]) => values.reduce((a, b) => a + b, 0);

/** Dernière version dont `fromMonth` est ≤ `month`. */
export function versionAt<T extends { fromMonth: MonthKey }>(items: T[], month: MonthKey): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (item.fromMonth <= month && (!best || item.fromMonth > best.fromMonth)) best = item;
  }
  return best;
}

export function startMonth(data: BudgetData): MonthKey {
  return monthOf(data.settings.startDate);
}

export function budgetAt(data: BudgetData, envelopeId: string, month: MonthKey): EnvelopeBudget | null {
  return versionAt(
    data.budgets.filter((b) => b.envelopeId === envelopeId),
    month,
  );
}

/** Une enveloppe existe pour un mois si elle a un montant défini et n'est pas encore archivée. */
export function isActive(data: BudgetData, envelope: Envelope, month: MonthKey): boolean {
  if (envelope.archivedFrom !== null && month >= envelope.archivedFrom) return false;
  return budgetAt(data, envelope.id, month) !== null;
}

function activeEnvelopes(data: BudgetData, month: MonthKey, type: Envelope['type']): Envelope[] {
  return data.envelopes
    .filter((e) => e.type === type && isActive(data, e, month))
    .sort((a, b) => a.order - b.order);
}

export function fixedSavingsAt(data: BudgetData, month: MonthKey): Cents {
  return versionAt(data.settings.fixedSavings, month)?.amountCents ?? 0;
}

function countsInBalances(data: BudgetData, date: DateKey): boolean {
  return date >= data.settings.startDate;
}

// ─── Enveloppes mensuelles ───────────────────────────────────────────────────

export interface MonthlyEnvelopeState {
  envelope: Envelope;
  budgetCents: Cents;
  spentCents: Cents;
  /** Peut être négatif (dépassement). */
  remainingCents: Cents;
}

export function monthlyEnvelopeState(data: BudgetData, envelope: Envelope, month: MonthKey): MonthlyEnvelopeState {
  const budgetCents = budgetAt(data, envelope.id, month)?.amountCents ?? 0;
  const spentCents = sum(
    data.expenses
      .filter((x) => x.envelopeId === envelope.id && monthOf(x.date) === month)
      .map((x) => x.amountCents),
  );
  return { envelope, budgetCents, spentCents, remainingCents: budgetCents - spentCents };
}

// ─── Cagnottes ───────────────────────────────────────────────────────────────

export interface PotMonth {
  month: MonthKey;
  contributionCents: Cents;
  /** Surplus au-delà du maximum, devenu de l'épargne ce mois-ci. */
  overflowCents: Cents;
  /** Solde après contribution et plafonnement, avant les dépenses du mois. */
  startCents: Cents;
  spentCents: Cents;
  /** Peut être négatif si l'achat arrive avant d'avoir assez mis de côté. */
  endCents: Cents;
  maxCents: Cents | null;
}

/** Historique d'une cagnotte, du mois de départ jusqu'à `upTo` inclus. */
export function potLedger(data: BudgetData, envelope: Envelope, upTo: MonthKey): PotMonth[] {
  const first = startMonth(data);
  const rows: PotMonth[] = [];
  let balance = envelope.startBalanceCents;

  for (const month of monthRange(first, upTo)) {
    const active = isActive(data, envelope, month);
    const budget = active ? budgetAt(data, envelope.id, month) : null;
    const contributionCents = budget && month > first ? budget.amountCents : 0;
    balance += contributionCents;

    const maxCents = budget?.maxCents ?? null;
    let overflowCents = 0;
    if (maxCents !== null && balance > maxCents) {
      overflowCents = balance - maxCents;
      balance = maxCents;
    }

    const spentCents = sum(
      data.expenses
        .filter(
          (x) => x.envelopeId === envelope.id && monthOf(x.date) === month && countsInBalances(data, x.date),
        )
        .map((x) => x.amountCents),
    );
    rows.push({
      month,
      contributionCents,
      overflowCents,
      startCents: balance,
      spentCents,
      endCents: balance - spentCents,
      maxCents,
    });
    balance -= spentCents;
  }
  return rows;
}

/**
 * Quand la cagnotte aura de nouveau de quoi payer un achat complet (son maximum).
 * `readyMonth` vaut le mois en cours si c'est déjà bon, null si la cagnotte n'a pas
 * de maximum ou ne reçoit plus rien.
 */
export function potForecast(
  state: PotMonth,
  contributionCents: Cents,
): { readyMonth: MonthKey | null; monthsNeeded: number } {
  if (state.maxCents === null) return { readyMonth: null, monthsNeeded: 0 };
  if (state.endCents >= state.maxCents) return { readyMonth: state.month, monthsNeeded: 0 };
  if (contributionCents <= 0) return { readyMonth: null, monthsNeeded: 0 };
  const monthsNeeded = Math.ceil((state.maxCents - state.endCents) / contributionCents);
  return { readyMonth: addMonths(state.month, monthsNeeded), monthsNeeded };
}

export function potStateAt(data: BudgetData, envelope: Envelope, month: MonthKey): PotMonth | null {
  if (month < startMonth(data)) return null;
  return potLedger(data, envelope, month).at(-1) ?? null;
}

// ─── Mois ────────────────────────────────────────────────────────────────────

/** Total viré par l'ordre permanent ce mois-là (rien le mois de départ). */
export function standingOrderAt(data: BudgetData, month: MonthKey): Cents {
  if (month <= startMonth(data)) return 0;
  const contributions = activeEnvelopes(data, month, 'pot').map(
    (e) => budgetAt(data, e.id, month)!.amountCents,
  );
  return fixedSavingsAt(data, month) + sum(contributions);
}

export interface StandingOrderPlan {
  /** Part d'épargne « pour l'avenir », qui n'est réservée à aucune cagnotte. */
  fixedSavingsCents: Cents;
  /** Une ligne par cagnotte alimentée. */
  lines: { name: string; amountCents: Cents }[];
  totalCents: Cents;
}

/**
 * Montant à virer chaque mois du courant vers l'épargne : c'est ce qu'il faut
 * régler à la banque. À la différence de `standingOrderAt`, ce plan est informatif
 * et vaut aussi pour le mois de départ.
 */
export function standingOrderPlan(data: BudgetData, month: MonthKey): StandingOrderPlan {
  const fixedSavingsCents = fixedSavingsAt(data, month);
  const lines = activeEnvelopes(data, month, 'pot').map((e) => ({
    name: e.name,
    amountCents: budgetAt(data, e.id, month)!.amountCents,
  }));
  return {
    fixedSavingsCents,
    lines,
    totalCents: fixedSavingsCents + sum(lines.map((l) => l.amountCents)),
  };
}

export function incomesAt(data: BudgetData, month: MonthKey): Cents {
  return sum(data.incomes.filter((i) => i.month === month).map((i) => i.amountCents));
}

/** Les revenus du mois doivent être confirmés (sauf le mois de départ). */
export function incomesPending(data: BudgetData, month: MonthKey): boolean {
  return month > startMonth(data) && !data.incomes.some((i) => i.month === month);
}

/** Revenus confirmés du mois, ou à défaut ceux prévus par le modèle mensuel. */
export function plannedIncomeAt(data: BudgetData, month: MonthKey): Cents {
  if (data.incomes.some((i) => i.month === month)) return incomesAt(data, month);
  return sum(data.incomeTemplates.map((t) => t.amountCents));
}

export interface Allocation {
  incomeCents: Cents;
  /** Somme des plafonds des enveloppes mensuelles. */
  monthlyCents: Cents;
  /** Somme des contributions aux cagnottes. */
  potsCents: Cents;
  fixedSavingsCents: Cents;
  /** Ce qui n'est attribué nulle part ; négatif si le budget dépasse les revenus. */
  unassignedCents: Cents;
}

/** Répartition des revenus du mois, pour la vue d'ensemble. */
export function allocation(data: BudgetData, month: MonthKey): Allocation {
  const incomeCents = plannedIncomeAt(data, month);
  const monthlyCents = sum(
    activeEnvelopes(data, month, 'monthly').map((e) => budgetAt(data, e.id, month)!.amountCents),
  );
  const potsCents = sum(
    activeEnvelopes(data, month, 'pot').map((e) => budgetAt(data, e.id, month)!.amountCents),
  );
  const fixedSavingsCents = fixedSavingsAt(data, month);
  return {
    incomeCents,
    monthlyCents,
    potsCents,
    fixedSavingsCents,
    unassignedCents: incomeCents - monthlyCents - potsCents - fixedSavingsCents,
  };
}

/**
 * Argent qui n'est dans aucune enveloppe : revenus − plafonds − ordre permanent.
 * Vaut 0 tant que les revenus du mois ne sont pas confirmés.
 */
export function unassignedAt(data: BudgetData, month: MonthKey): Cents {
  if (month <= startMonth(data) || incomesPending(data, month)) return 0;
  const ceilings = activeEnvelopes(data, month, 'monthly').map(
    (e) => budgetAt(data, e.id, month)!.amountCents,
  );
  return incomesAt(data, month) - sum(ceilings) - standingOrderAt(data, month);
}

/** Montant proposé au bilan : restes des mensuelles (dépassements déduits) + non attribué, jamais négatif. */
export function proposalAt(data: BudgetData, month: MonthKey): Cents {
  const remaining = activeEnvelopes(data, month, 'monthly').map(
    (e) => monthlyEnvelopeState(data, e, month).remainingCents,
  );
  return Math.max(0, sum(remaining) + unassignedAt(data, month));
}

export function closeAt(data: BudgetData, month: MonthKey): MonthClose | null {
  return data.closes.find((c) => c.month === month) ?? null;
}

/**
 * Mois terminés dont le bilan n'a pas encore été fait, du plus ancien au plus récent.
 * Le mois de départ est exclu : il est incomplet (ni revenus confirmés, ni ordre permanent),
 * donc ses « restes » ne correspondent à aucun argent réellement disponible.
 */
export function pendingCloses(data: BudgetData, today: DateKey): MonthKey[] {
  const lastFinished = addMonths(monthOf(today), -1);
  const firstClosable = addMonths(startMonth(data), 1);
  if (lastFinished < firstClosable) return [];
  return monthRange(firstClosable, lastFinished).filter((m) => !closeAt(data, m));
}

export interface MonthView {
  month: MonthKey;
  monthly: MonthlyEnvelopeState[];
  pots: { envelope: Envelope; state: PotMonth }[];
  /** Grand chiffre de l'accueil : somme des restes des mensuelles. */
  availableCents: Cents;
  unassignedCents: Cents;
  proposalCents: Cents;
  close: MonthClose | null;
  /** Différence entre le bilan recalculé et celui confirmé (après correction d'un mois passé). */
  closeDriftCents: Cents;
  incomesPending: boolean;
}

export function monthView(data: BudgetData, month: MonthKey): MonthView {
  const monthly = activeEnvelopes(data, month, 'monthly').map((e) => monthlyEnvelopeState(data, e, month));
  const pots = activeEnvelopes(data, month, 'pot').flatMap((envelope) => {
    const state = potStateAt(data, envelope, month);
    return state ? [{ envelope, state }] : [];
  });
  const proposalCents = proposalAt(data, month);
  const close = closeAt(data, month);
  return {
    month,
    monthly,
    pots,
    availableCents: sum(monthly.map((m) => m.remainingCents)),
    unassignedCents: unassignedAt(data, month),
    proposalCents,
    close,
    closeDriftCents: close?.status === 'confirmed' ? proposalCents - close.proposedCents : 0,
    incomesPending: incomesPending(data, month),
  };
}

// ─── Comptes ─────────────────────────────────────────────────────────────────

export type SavingsEntryKind =
  | 'standing'
  | 'close'
  | 'deposit'
  | 'transfer'
  | 'withdrawal'
  | 'adjustment'
  | 'pot';

export interface SavingsEntry {
  date: DateKey;
  kind: SavingsEntryKind;
  label: string;
  detail: string;
  /** Signé : positif si l'épargne monte. */
  amountCents: Cents;
}

const MOVE_LABELS = {
  deposit: 'Ajout à l’épargne',
  transfer: 'Virement vers l’épargne',
  withdrawal: 'Retrait',
  adjustment: 'Ajustement',
} as const;

/**
 * Mouvements du compte épargne, du plus récent au plus ancien.
 * L'ordre permanent est daté du 1er du mois, puisqu'il est considéré comme exécuté.
 */
export function savingsHistory(data: BudgetData, today: DateKey): SavingsEntry[] {
  const first = startMonth(data);
  const current = monthOf(today);
  const entries: SavingsEntry[] = [];

  for (const month of current > first ? monthRange(addMonths(first, 1), current) : []) {
    const plan = standingOrderPlan(data, month);
    if (plan.totalCents !== 0) {
      entries.push({
        date: `${month}-01`,
        kind: 'standing',
        label: 'Ordre permanent',
        detail: [
          plan.fixedSavingsCents ? 'épargne' : null,
          ...plan.lines.map((l) => l.name.toLowerCase()),
        ]
          .filter(Boolean)
          .join(' · '),
        amountCents: plan.totalCents,
      });
    }
  }

  for (const close of data.closes) {
    if (close.status !== 'confirmed' || close.savedCents === 0) continue;
    entries.push({
      date: close.date,
      kind: 'close',
      label: 'Bilan du mois',
      detail: close.month,
      amountCents: close.savedCents,
    });
  }

  const potNames = new Map(data.envelopes.filter((e) => e.type === 'pot').map((e) => [e.id, e.name]));
  for (const expense of data.expenses) {
    const name = potNames.get(expense.envelopeId);
    if (!name || !countsInBalances(data, expense.date)) continue;
    entries.push({
      date: expense.date,
      kind: 'pot',
      label: name,
      detail: expense.note,
      amountCents: -expense.amountCents,
    });
  }

  for (const move of data.moves) {
    if (!countsInBalances(data, move.date)) continue;
    if (move.type === 'adjustment' && move.account !== 'savings') continue;
    const signed =
      move.type === 'withdrawal' ? -move.amountCents : move.amountCents;
    entries.push({
      date: move.date,
      kind: move.type,
      label: MOVE_LABELS[move.type],
      detail: move.note,
      amountCents: signed,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.amountCents - a.amountCents);
}

export interface AccountsView {
  currentCents: Cents;
  /** Total du compte épargne (épargne + réservé). */
  savingsAccountCents: Cents;
  /** Somme des soldes des cagnottes actives. */
  reservedCents: Cents;
  /** Épargne « à garder » = compte épargne − réservé. */
  freeSavingsCents: Cents;
}

/** Soldes calculés au jour `today`. */
export function accountsView(data: BudgetData, today: DateKey): AccountsView {
  const { settings } = data;
  const first = startMonth(data);
  const current = monthOf(today);
  const months = current > first ? monthRange(addMonths(first, 1), current) : [];
  const potIds = new Set(data.envelopes.filter((e) => e.type === 'pot').map((e) => e.id));

  const counted = data.expenses.filter((x) => countsInBalances(data, x.date));
  const monthlySpent = sum(counted.filter((x) => !potIds.has(x.envelopeId)).map((x) => x.amountCents));
  const potSpent = sum(counted.filter((x) => potIds.has(x.envelopeId)).map((x) => x.amountCents));

  const incomes = sum(months.map((m) => incomesAt(data, m)));
  const standingOrders = sum(months.map((m) => standingOrderAt(data, m)));
  const saved = sum(data.closes.filter((c) => c.status === 'confirmed').map((c) => c.savedCents));

  const moves = data.moves.filter((m) => countsInBalances(data, m.date));
  const movesOf = (type: string, account?: string) =>
    sum(moves.filter((m) => m.type === type && (!account || m.account === account)).map((m) => m.amountCents));
  const withdrawals = movesOf('withdrawal');
  // Un virement sort du courant et entre sur l'épargne ; un ajout vient de l'extérieur.
  const transfers = movesOf('transfer');

  const currentCents =
    settings.startCurrentCents + incomes - monthlySpent - standingOrders - saved - transfers + withdrawals +
    movesOf('adjustment', 'current');

  const savingsAccountCents =
    settings.startSavingsCents + standingOrders + saved + transfers + movesOf('deposit') - withdrawals - potSpent +
    movesOf('adjustment', 'savings');

  const reservedCents = sum(
    activeEnvelopes(data, current, 'pot').map((e) => potStateAt(data, e, current)?.endCents ?? 0),
  );

  return {
    currentCents,
    savingsAccountCents,
    reservedCents,
    freeSavingsCents: savingsAccountCents - reservedCents,
  };
}
