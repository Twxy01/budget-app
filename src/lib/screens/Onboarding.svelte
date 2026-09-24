<script lang="ts">
  import { db } from '../db';
  import { todayKey } from '../domain/dates';
  import { formatShort, parseAmount } from '../domain/money';
  import type { Envelope } from '../domain/types';
  import { newId, store } from '../store.svelte';
  import { toast } from '../toast.svelte';

  type Draft = {
    key: string;
    name: string;
    type: Envelope['type'];
    amount: string;
    max: string;
    start: string;
  };

  let step = $state(0);
  let busy = $state(false);

  // Étape 1 : soldes
  let currentRaw = $state('');
  let savingsRaw = $state('');
  const currentCents = $derived(parseAmount(currentRaw));
  const savingsCents = $derived(parseAmount(savingsRaw));

  // Étape 2 : revenus
  let incomes = $state([{ key: newId(), name: '', amount: '' }]);
  let fixedRaw = $state('');
  const fixedCents = $derived(fixedRaw.trim() === '' ? 0 : parseAmount(fixedRaw));
  const incomeLines = $derived(
    incomes
      .filter((i) => i.name.trim() && parseAmount(i.amount) !== null)
      .map((i) => ({ name: i.name.trim(), amountCents: parseAmount(i.amount)! })),
  );

  // Étape 3 : enveloppes
  let drafts = $state<Draft[]>([newDraft()]);
  function newDraft(): Draft {
    return { key: newId(), name: '', type: 'monthly', amount: '', max: '', start: '' };
  }
  const envelopeLines = $derived(
    drafts
      .filter((d) => d.name.trim() && parseAmount(d.amount) !== null)
      .map((d) => ({
        name: d.name.trim(),
        type: d.type,
        amountCents: parseAmount(d.amount)!,
        maxCents: d.type === 'pot' && d.max.trim() !== '' ? parseAmount(d.max) : null,
        startBalanceCents: d.type === 'pot' ? (parseAmount(d.start) ?? 0) : 0,
      })),
  );

  const monthlyTotal = $derived(
    envelopeLines.filter((e) => e.type === 'monthly').reduce((s, e) => s + e.amountCents, 0),
  );
  const standingTotal = $derived(
    (fixedCents ?? 0) + envelopeLines.filter((e) => e.type === 'pot').reduce((s, e) => s + e.amountCents, 0),
  );
  const incomeTotal = $derived(incomeLines.reduce((s, i) => s + i.amountCents, 0));
  const unassigned = $derived(incomeTotal - monthlyTotal - standingTotal);

  async function finish() {
    if (busy || currentCents === null || savingsCents === null || envelopeLines.length === 0) return;
    busy = true;
    const startDate = todayKey();
    const month = startDate.slice(0, 7);
    await db.transaction('rw', db.tables, async () => {
      await db.settings.put({
        key: 'main',
        startDate,
        startCurrentCents: currentCents,
        startSavingsCents: savingsCents,
        fixedSavings: [{ fromMonth: month, amountCents: fixedCents ?? 0 }],
      });
      await db.incomeTemplates.bulkAdd(
        incomeLines.map((line, order) => ({ id: newId(), name: line.name, amountCents: line.amountCents, order })),
      );
      for (const [order, line] of envelopeLines.entries()) {
        const id = newId();
        await db.envelopes.add({
          id,
          name: line.name,
          type: line.type,
          memo: '',
          order,
          archivedFrom: null,
          startBalanceCents: line.startBalanceCents,
        });
        await db.budgets.add({
          envelopeId: id,
          fromMonth: month,
          amountCents: line.amountCents,
          maxCents: line.maxCents,
        });
      }
    });
    await store.reload();
    toast.show('Tout est prêt !');
  }
</script>

<div class="screen">
  <header class="head">
    <h1>Budget</h1>
    <p class="steps">Étape {step + 1} sur 3</p>
  </header>

  {#if step === 0}
    <h2>Tes comptes aujourd'hui</h2>
    <p class="hint">
      Entre les soldes affichés par ta banque en ce moment. L'app part de ces chiffres et suit ensuite
      tout ce que tu notes.
    </p>
    <label class="field">
      Compte courant
      <input type="text" inputmode="decimal" placeholder="0" bind:value={currentRaw} />
    </label>
    <label class="field">
      Compte épargne
      <input type="text" inputmode="decimal" placeholder="0" bind:value={savingsRaw} />
    </label>
    <button class="next" disabled={currentCents === null || savingsCents === null} onclick={() => (step = 1)}>
      Continuer
    </button>
  {:else if step === 1}
    <h2>Tes revenus du mois</h2>
    <p class="hint">Ils seront préremplis chaque mois, et tu les confirmeras d'une touche.</p>
    {#each incomes as income (income.key)}
      <div class="row">
        <input type="text" placeholder="Salaire" bind:value={income.name} />
        <input class="num amount" type="text" inputmode="decimal" placeholder="0" bind:value={income.amount} />
      </div>
    {/each}
    <button class="link" onclick={() => (incomes = [...incomes, { key: newId(), name: '', amount: '' }])}>
      + Ajouter un revenu
    </button>

    <h2>Épargne fixe</h2>
    <p class="hint">Le montant que tu vires chaque mois sur ton épargne, avant toute dépense. 0 si tu préfères sans.</p>
    <label class="field">
      Par mois
      <input type="text" inputmode="decimal" placeholder="0" bind:value={fixedRaw} />
    </label>

    <div class="nav">
      <button class="link" onclick={() => (step = 0)}>Retour</button>
      <button class="next" disabled={incomeLines.length === 0 || fixedCents === null} onclick={() => (step = 2)}>
        Continuer
      </button>
    </div>
  {:else}
    <h2>Tes enveloppes</h2>
    <p class="hint">
      <strong>Mensuelle</strong> : repart à zéro chaque mois, l'argent reste sur le courant.
      <strong>Cagnotte</strong> : accumule pour un achat futur, l'argent va sur l'épargne.
    </p>

    {#each drafts as draft (draft.key)}
      <div class="draft">
        <div class="row">
          <input type="text" placeholder="Nom" bind:value={draft.name} />
          <input class="num amount" type="text" inputmode="decimal" placeholder="0" bind:value={draft.amount} />
        </div>
        <div class="row types">
          <button class:selected={draft.type === 'monthly'} onclick={() => (draft.type = 'monthly')}>Mensuelle</button>
          <button class:selected={draft.type === 'pot'} onclick={() => (draft.type = 'pot')}>Cagnotte</button>
          {#if draft.type === 'pot'}
            <input class="num small" type="text" inputmode="decimal" placeholder="max" bind:value={draft.max} />
            <input class="num small" type="text" inputmode="decimal" placeholder="déjà de côté" bind:value={draft.start} />
          {/if}
          <button class="remove" aria-label="Retirer" onclick={() => (drafts = drafts.filter((d) => d.key !== draft.key))}>×</button>
        </div>
      </div>
    {/each}
    <button class="link" onclick={() => (drafts = [...drafts, newDraft()])}>+ Ajouter une enveloppe</button>

    <div class="summary card">
      <p><span>Revenus</span><span class="num">{formatShort(incomeTotal)}</span></p>
      <p><span>Enveloppes mensuelles</span><span class="num">−{formatShort(monthlyTotal)}</span></p>
      <p><span>Ordre permanent</span><span class="num">−{formatShort(standingTotal)}</span></p>
      <p class="total"><span>Non attribué</span><span class="num" class:negative={unassigned < 0}>{formatShort(unassigned)}</span></p>
    </div>

    <div class="nav">
      <button class="link" onclick={() => (step = 1)}>Retour</button>
      <button class="next" disabled={envelopeLines.length === 0 || busy} onclick={finish}>C'est parti</button>
    </div>
  {/if}
</div>

<style>
  .head {
    padding: 24px 0 8px;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 28px;
  }

  .steps {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 14px;
  }

  h2 {
    margin: 24px 0 6px;
    font-size: 17px;
  }

  .hint {
    margin: 0 0 14px;
    font-size: 14px;
    color: var(--muted);
  }

  .field,
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 15px;
    color: var(--muted);
  }

  input {
    min-width: 0;
    flex: 1;
    padding: 12px;
    border: 0;
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 16px;
  }

  .field input,
  .amount {
    flex: 0 0 130px;
    text-align: right;
  }

  .small {
    flex: 0 0 96px;
    padding: 9px 10px;
    text-align: right;
  }

  .draft {
    margin-bottom: 14px;
  }

  .types button {
    padding: 9px 12px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 14px;
  }

  .types button.selected {
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .remove {
    margin-left: auto;
    width: 32px;
    height: 32px;
    color: var(--muted);
    font-size: 20px;
  }

  .link {
    padding: 8px 0;
    color: var(--accent);
    font-weight: 600;
  }

  .summary {
    padding: 14px 16px;
    margin: 20px 0;
    font-size: 14px;
  }

  .summary p {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
    color: var(--muted);
  }

  .summary .total {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    color: var(--text);
    font-weight: 600;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0 40px;
  }

  .next {
    flex: 1;
    height: 54px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 17px;
    font-weight: 600;
  }
</style>
