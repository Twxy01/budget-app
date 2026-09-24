/** Montant en centimes (entier) — jamais de nombres à virgule pour l'argent. */
export type Cents = number;
/** Mois au format 'YYYY-MM'. */
export type MonthKey = string;
/** Jour au format 'YYYY-MM-DD'. */
export type DateKey = string;

/** 'monthly' = enveloppe mensuelle (compte courant), 'pot' = cagnotte (compte épargne). */
export type EnvelopeType = 'monthly' | 'pot';

export interface Envelope {
  id: string;
  name: string;
  type: EnvelopeType;
  /** Courte description affichée sous le nom (« avec les potes : soirées… »). */
  memo: string;
  order: number;
  /** Premier mois où l'enveloppe n'apparaît plus, null si elle est active. */
  archivedFrom: MonthKey | null;
  /** Cagnotte uniquement : solde saisi au premier lancement. */
  startBalanceCents: Cents;
}

/**
 * Plafond (mensuelle) ou contribution mensuelle (cagnotte), valable à partir de `fromMonth`.
 * Modifier un montant crée une nouvelle version : les mois passés gardent l'ancienne.
 */
export interface EnvelopeBudget {
  id?: number;
  envelopeId: string;
  fromMonth: MonthKey;
  amountCents: Cents;
  /** Cagnotte uniquement : maximum au-delà duquel le surplus devient de l'épargne. */
  maxCents: Cents | null;
}

export interface Expense {
  id: string;
  envelopeId: string;
  amountCents: Cents;
  note: string;
  date: DateKey;
  createdAt: number;
}

/** Revenu prérempli chaque mois (salaire, aide parentale…). */
export interface IncomeTemplate {
  id: string;
  name: string;
  amountCents: Cents;
  order: number;
}

/** Revenu confirmé pour un mois donné. */
export interface IncomeEntry {
  id: string;
  month: MonthKey;
  name: string;
  amountCents: Cents;
}

/** Bilan de fin de mois : ce que j'ai confirmé avoir mis de côté. */
export interface MonthClose {
  month: MonthKey;
  status: 'confirmed' | 'skipped';
  /** Montant proposé au moment de la confirmation (sert à détecter un écart après correction). */
  proposedCents: Cents;
  /** Montant réellement viré vers l'épargne (0 si « Pas ce mois »). */
  savedCents: Cents;
  date: DateKey;
}

export type Account = 'current' | 'savings';

/**
 * - deposit : ajout à l'épargne venant de l'extérieur (13e salaire…) — épargne +
 * - withdrawal : retrait d'épargne vers le courant — épargne −, courant +
 * - adjustment : correction après « Vérifier mon solde » — montant signé sur `account`
 */
export interface AccountMove {
  id: string;
  date: DateKey;
  type: 'deposit' | 'withdrawal' | 'adjustment';
  account: Account;
  amountCents: Cents;
  note: string;
}

export interface VersionedAmount {
  fromMonth: MonthKey;
  amountCents: Cents;
}

export interface Settings {
  /** Jour du premier lancement : les soldes de départ sont ceux de ce jour-là. */
  startDate: DateKey;
  startCurrentCents: Cents;
  startSavingsCents: Cents;
  /** Épargne fixe incluse dans l'ordre permanent. */
  fixedSavings: VersionedAmount[];
}

/** Tout ce dont le moteur de calcul a besoin. */
export interface BudgetData {
  settings: Settings;
  incomeTemplates: IncomeTemplate[];
  envelopes: Envelope[];
  budgets: EnvelopeBudget[];
  expenses: Expense[];
  incomes: IncomeEntry[];
  closes: MonthClose[];
  moves: AccountMove[];
}
