import { describe, expect, it } from 'vitest';
import {
  accountsView,
  monthView,
  pendingCloses,
  potForecast,
  potLedger,
  potStateAt,
  proposalAt,
  savingsHistory,
  standingOrderAt,
  standingOrderPlan,
  unassignedAt,
} from './engine';
import type { BudgetData, Envelope, EnvelopeBudget, Expense } from './types';

// Jeu de données inspiré du budget réel (montants en centimes).
const START = '2026-09-21';

function envelope(id: string, type: Envelope['type'], order: number, startBalanceCents = 0): Envelope {
  return { id, name: id, type, memo: '', order, archivedFrom: null, startBalanceCents };
}

function budget(envelopeId: string, amountCents: number, maxCents: number | null = null, fromMonth = '2026-09'): EnvelopeBudget {
  return { envelopeId, fromMonth, amountCents, maxCents };
}

let seq = 0;
function expense(envelopeId: string, amountCents: number, date: string): Expense {
  return { id: `x${++seq}`, envelopeId, amountCents, note: '', date, createdAt: 0 };
}

function makeData(overrides: Partial<BudgetData> = {}): BudgetData {
  return {
    settings: {
      startDate: START,
      startCurrentCents: 100000,
      startSavingsCents: 200000,
      fixedSavings: [{ fromMonth: '2026-09', amountCents: 30000 }],
    },
    incomeTemplates: [],
    envelopes: [
      envelope('parachute', 'monthly', 1),
      envelope('social', 'monthly', 2),
      envelope('copine', 'monthly', 3),
      envelope('conso', 'monthly', 4),
      envelope('essence', 'monthly', 5),
      envelope('quotidien', 'monthly', 6),
      envelope('repas', 'pot', 7),
      envelope('plaisirs', 'pot', 8),
    ],
    budgets: [
      budget('parachute', 50000),
      budget('social', 10000),
      budget('copine', 10000),
      budget('conso', 10000),
      budget('essence', 10000),
      budget('quotidien', 13500),
      budget('repas', 14000, 47000),
      budget('plaisirs', 10800, 50000),
    ],
    expenses: [],
    incomes: [],
    closes: [],
    moves: [],
    ...overrides,
  };
}

const octIncomes = [
  { id: 'i1', month: '2026-10', name: 'Salaire', amountCents: 91845 },
  { id: 'i2', month: '2026-10', name: 'Aide parentale', amountCents: 66500 },
];

describe('enveloppes mensuelles', () => {
  it('plafond − dépenses = reste (exemple Social du cahier des charges)', () => {
    const data = makeData({ expenses: [expense('social', 3200, '2026-10-03')] });
    const social = monthView(data, '2026-10').monthly.find((m) => m.envelope.id === 'social')!;
    expect(social).toMatchObject({ budgetCents: 10000, spentCents: 3200, remainingCents: 6800 });
  });

  it('un dépassement donne un reste négatif, déduit du disponible', () => {
    const data = makeData({ expenses: [expense('copine', 11200, '2026-10-10')] });
    const view = monthView(data, '2026-10');
    expect(view.monthly.find((m) => m.envelope.id === 'copine')!.remainingCents).toBe(-1200);
    // 500 + 100 + 100 + 100 + 100 + 135 = 1'035 − 112 de dépenses
    expect(view.availableCents).toBe(103500 - 11200);
  });

  it("changer un plafond ne modifie pas les mois passés", () => {
    const data = makeData();
    data.budgets.push(budget('social', 15000, null, '2026-11'));
    const social = (m: string) => monthView(data, m).monthly.find((s) => s.envelope.id === 'social')!.budgetCents;
    expect(social('2026-10')).toBe(10000);
    expect(social('2026-11')).toBe(15000);
    expect(social('2027-03')).toBe(15000);
  });

  it('une enveloppe archivée disparaît à partir de son mois d’archivage', () => {
    const data = makeData();
    data.envelopes.find((e) => e.id === 'conso')!.archivedFrom = '2026-11';
    const ids = (m: string) => monthView(data, m).monthly.map((s) => s.envelope.id);
    expect(ids('2026-10')).toContain('conso');
    expect(ids('2026-11')).not.toContain('conso');
  });
});

describe('cagnottes', () => {
  it('se remplit jusqu’au maximum, le surplus devient de l’épargne (exemple Repas 192 / 470)', () => {
    const data = makeData({
      budgets: [budget('repas', 19200, 47000)],
      envelopes: [envelope('repas', 'pot', 1)],
      expenses: [expense('repas', 47000, '2026-12-15')],
    });
    const rows = potLedger(data, data.envelopes[0], '2026-12');
    expect(rows.map((r) => [r.month, r.contributionCents, r.overflowCents, r.startCents, r.endCents])).toEqual([
      ['2026-09', 0, 0, 0, 0], // mois de départ : pas de contribution
      ['2026-10', 19200, 0, 19200, 19200],
      ['2026-11', 19200, 0, 38400, 38400],
      ['2026-12', 19200, 10600, 47000, 0], // 576 → plafonné à 470, 106 d'épargne, puis achat de 470
    ]);
  });

  it('peut passer en négatif si l’achat arrive trop tôt', () => {
    const data = makeData({ expenses: [expense('repas', 47000, '2026-10-02')] });
    const repas = monthView(data, '2026-10').pots.find((p) => p.envelope.id === 'repas')!;
    expect(repas.state.endCents).toBe(14000 - 47000);
  });

  it('annonce quand le prochain achat sera possible', () => {
    const data = makeData();
    const repas = data.envelopes.find((e) => e.id === 'repas')!;
    // Octobre : 140 sur 470, il manque 330 → 3 mois de plus (janvier).
    expect(potForecast(potStateAt(data, repas, '2026-10')!, 14000)).toEqual({
      readyMonth: '2027-01',
      monthsNeeded: 3,
    });
    // Une fois le maximum atteint, c'est possible tout de suite.
    expect(potForecast(potStateAt(data, repas, '2027-01')!, 14000)).toEqual({
      readyMonth: '2027-01',
      monthsNeeded: 0,
    });
  });

  it('démarre avec le solde saisi au premier lancement', () => {
    const data = makeData();
    data.envelopes.find((e) => e.id === 'plaisirs')!.startBalanceCents = 20000;
    const plaisirs = monthView(data, '2026-10').pots.find((p) => p.envelope.id === 'plaisirs')!;
    expect(plaisirs.state.endCents).toBe(20000 + 10800);
  });
});

describe('ordre permanent', () => {
  it('additionne l’épargne fixe et les contributions des cagnottes', () => {
    const plan = standingOrderPlan(makeData(), '2026-10');
    expect(plan.fixedSavingsCents).toBe(30000);
    expect(plan.lines).toEqual([
      { name: 'repas', amountCents: 14000 },
      { name: 'plaisirs', amountCents: 10800 },
    ]);
    expect(plan.totalCents).toBe(54800);
  });

  it('vaut aussi pour le mois de départ, où rien n’a encore été viré', () => {
    const data = makeData();
    expect(standingOrderPlan(data, '2026-09').totalCents).toBe(54800);
    expect(standingOrderAt(data, '2026-09')).toBe(0);
  });
});

describe('bilan de fin de mois', () => {
  it('non attribué = revenus − plafonds − ordre permanent (0.45 CHF avec le budget réel)', () => {
    const data = makeData({ incomes: octIncomes });
    // 1'583.45 − 1'035 (mensuelles) − 300 (épargne fixe) − 140 − 108 (cagnottes)
    expect(unassignedAt(data, '2026-10')).toBe(45);
  });

  it('non attribué vaut 0 le mois de départ et tant que les revenus ne sont pas confirmés', () => {
    const data = makeData();
    expect(unassignedAt(data, '2026-09')).toBe(0);
    expect(unassignedAt(data, '2026-10')).toBe(0);
    expect(monthView(data, '2026-10').incomesPending).toBe(true);
    expect(monthView(data, '2026-09').incomesPending).toBe(false);
  });

  it('propose les restes des mensuelles + le non attribué', () => {
    const data = makeData({
      incomes: octIncomes,
      expenses: [expense('parachute', 30000, '2026-10-04'), expense('social', 4000, '2026-10-08')],
    });
    // restes : 1'035 − 300 − 40 = 695, + 0.45 non attribué
    expect(proposalAt(data, '2026-10')).toBe(69545);
  });

  it('ne propose jamais un montant négatif', () => {
    const data = makeData({ expenses: [expense('parachute', 200000, '2026-10-04')] });
    expect(proposalAt(data, '2026-10')).toBe(0);
  });

  it('liste les bilans en attente, du plus ancien au plus récent', () => {
    const data = makeData();
    expect(pendingCloses(data, '2026-09-30')).toEqual([]);
    expect(pendingCloses(data, '2026-12-02')).toEqual(['2026-10', '2026-11']);
    data.closes.push({ month: '2026-10', status: 'skipped', proposedCents: 0, savedCents: 0, date: '2026-11-01' });
    expect(pendingCloses(data, '2026-12-02')).toEqual(['2026-11']);
  });

  it('ne propose jamais de bilan pour le mois de départ, qui est incomplet', () => {
    // Démarrage le 21 septembre : septembre n'a ni revenus confirmés ni ordre permanent.
    expect(pendingCloses(makeData(), '2026-10-01')).toEqual([]);
  });

  it('signale un écart si un mois déjà clôturé est corrigé', () => {
    const data = makeData({ incomes: octIncomes });
    const proposed = proposalAt(data, '2026-10');
    data.closes.push({ month: '2026-10', status: 'confirmed', proposedCents: proposed, savedCents: proposed, date: '2026-11-01' });
    expect(monthView(data, '2026-10').closeDriftCents).toBe(0);

    data.expenses.push(expense('social', 2500, '2026-10-20')); // dépense oubliée ajoutée après coup
    expect(monthView(data, '2026-10').closeDriftCents).toBe(-2500);
  });
});

describe('historique de l’épargne', () => {
  it('rassemble ordre permanent, bilans, achats de cagnotte et mouvements manuels', () => {
    const data = makeData({
      expenses: [expense('repas', 47000, '2026-10-10')],
      closes: [{ month: '2026-09', status: 'confirmed', proposedCents: 5000, savedCents: 5000, date: '2026-10-01' }],
      moves: [
        { id: 'm1', date: '2026-10-13', type: 'deposit', account: 'savings', amountCents: 91845, note: '13e salaire' },
        { id: 'm2', date: '2026-10-12', type: 'withdrawal', account: 'savings', amountCents: 10000, note: 'imprévu' },
        { id: 'm3', date: '2026-10-14', type: 'adjustment', account: 'current', amountCents: -500, note: '' },
      ],
    });

    const history = savingsHistory(data, '2026-10-20');
    // Le plus récent d'abord ; l'ajustement du compte courant n'y figure pas.
    expect(history.map((e) => [e.date, e.kind, e.amountCents])).toEqual([
      ['2026-10-13', 'deposit', 91845],
      ['2026-10-12', 'withdrawal', -10000],
      ['2026-10-10', 'pot', -47000],
      ['2026-10-01', 'standing', 54800],
      ['2026-10-01', 'close', 5000],
    ]);
  });

  it('ignore un bilan « pas ce mois »', () => {
    const data = makeData({
      closes: [{ month: '2026-09', status: 'skipped', proposedCents: 5000, savedCents: 0, date: '2026-10-01' }],
    });
    expect(savingsHistory(data, '2026-10-05').filter((e) => e.kind === 'close')).toEqual([]);
  });
});

describe('soldes des comptes', () => {
  it('suit tous les mouvements du courant et de l’épargne', () => {
    const data = makeData({
      incomes: octIncomes,
      expenses: [
        expense('social', 2000, '2026-09-10'), // avant le premier lancement : ignorée dans les soldes
        expense('social', 3200, '2026-09-25'),
        expense('social', 1000, '2026-10-05'),
        expense('repas', 5000, '2026-10-10'), // cagnotte : payée par l'épargne
      ],
      closes: [{ month: '2026-09', status: 'confirmed', proposedCents: 5000, savedCents: 5000, date: '2026-10-01' }],
      moves: [
        { id: 'm1', date: '2026-10-12', type: 'withdrawal', account: 'savings', amountCents: 10000, note: '' },
        { id: 'm2', date: '2026-10-13', type: 'deposit', account: 'savings', amountCents: 91845, note: '13e' },
        { id: 'm3', date: '2026-10-14', type: 'adjustment', account: 'current', amountCents: -500, note: '' },
      ],
    });

    const accounts = accountsView(data, '2026-10-15');
    // Ordre permanent d'octobre : 300 + 140 + 108 = 548
    // Courant : 1'000 + 1'583.45 − 42 − 548 − 50 + 100 − 5
    expect(accounts.currentCents).toBe(203845);
    // Épargne : 2'000 + 548 + 50 + 918.45 − 100 − 50
    expect(accounts.savingsAccountCents).toBe(336645);
    // Réservé : Repas 140 − 50 = 90, Plaisirs 108
    expect(accounts.reservedCents).toBe(19800);
    expect(accounts.freeSavingsCents).toBe(336645 - 19800);
  });

  it('le mois de départ, seuls les mouvements après le premier lancement comptent', () => {
    const data = makeData({ expenses: [expense('quotidien', 800, '2026-09-22')] });
    expect(accountsView(data, '2026-09-30')).toEqual({
      currentCents: 100000 - 800,
      savingsAccountCents: 200000,
      reservedCents: 0,
      freeSavingsCents: 200000,
    });
  });

  it('une cagnotte archivée libère son solde vers l’épargne', () => {
    const data = makeData();
    expect(accountsView(data, '2026-10-15').reservedCents).toBe(24800);
    data.envelopes.find((e) => e.id === 'plaisirs')!.archivedFrom = '2026-10';
    const accounts = accountsView(data, '2026-10-15');
    expect(accounts.reservedCents).toBe(14000);
    expect(accounts.freeSavingsCents).toBe(accounts.savingsAccountCents - 14000);
  });
});
