<script lang="ts">
  import { importBackup } from '../backup';
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
  let restoring = $state(false);

  async function onRestore(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    restoring = true;
    try {
      await importBackup(file);
      await store.reload();
      toast.show('Sauvegarde restaurée');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Import impossible', 5000);
    } finally {
      restoring = false;
    }
  }

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
  function newDraft(name = ''): Draft {
    return { key: newId(), name, type: 'monthly', amount: '', max: '', start: '' };
  }

  /** Noms courants, pour éviter l'écran vide au moment le plus difficile. */
  const SUGGESTIONS = [
    'Courses',
    'Transport',
    'Sorties',
    'Loisirs',
    'Abonnements',
    'Santé',
    'Vêtements',
    'Imprévus',
  ];

  function addSuggestion(name: string) {
    const empty = drafts.find((d) => !d.name.trim());
    if (empty) empty.name = name;
    else drafts = [...drafts, newDraft(name)];
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
    {#if step > 0}<p class="steps">Étape {step} sur 3</p>{/if}
  </header>

  {#if step === 0}
    <!-- Personne ne devine le principe devant un champ vide : on l'explique d'abord. -->
    <section class="intro">
      <p class="pitch">
        Un budget par <strong>enveloppes</strong> : tu répartis l'argent de ton mois par type de
        dépense, et l'app t'indique en permanence ce qu'il te reste dans chacune.
      </p>

      <h3>1. Tu crées tes enveloppes</h3>
      <p class="pitch small">
        Une enveloppe par type de dépense — Courses, Sorties, Transport, ce que tu veux — avec un
        plafond pour le mois que tu fixes toi-même.
      </p>

      <h3>2. Tu notes tes dépenses</h3>
      <p class="pitch small">
        À chaque achat, tu saisis le montant et l'enveloppe concernée. Ça prend trois secondes, et
        l'enveloppe se vide d'autant.
      </p>
      <p class="example">
        <strong>Sorties · plafond 100</strong><br />
        Dépense : 32 — bar<br />
        Reste : <strong>68</strong>
      </p>

      <h3>3. Le mois recommence</h3>
      <p class="pitch small">
        Le 1er, chaque enveloppe repart à son plafond. L'app fait le compte de ce que tu n'as pas
        dépensé et te propose de le mettre de côté sur ton épargne. C'est toi qui fais le virement :
        l'app ne touche jamais à ton argent, elle reflète ce que tu fais.
      </p>

      <h3>Les cagnottes</h3>
      <p class="pitch small">
        Pour une dépense qui revient rarement mais coûte cher — vacances, matériel, achats groupés —
        une cagnotte accumule un montant chaque mois au lieu de repartir à zéro. Tu vois ce que tu as
        de côté et quand tu pourras acheter.
      </p>

      <h3>Ce qu'il te faut pour commencer</h3>
      <p class="pitch small">
        Les soldes de ton compte courant et de ton compte épargne, et le montant de tes revenus
        mensuels. Compte 5 minutes ; tout reste modifiable ensuite.
      </p>
      <p class="pitch small warn">
        ⚠️ Tes données restent sur ce téléphone, et nulle part ailleurs : aucun compte, aucun serveur,
        personne d'autre n'y a accès. En échange, rien n'est récupérable si tu supprimes l'app.
        Exporte une sauvegarde de temps en temps depuis les réglages.
      </p>
      <button class="next" onclick={() => (step = 1)}>Commencer</button>
      <label class="restore">
        {restoring ? 'Restauration…' : 'J’ai déjà une sauvegarde'}
        <input type="file" accept="application/json,.json" onchange={onRestore} />
      </label>
    </section>
  {:else if step === 1}
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
    <div class="nav">
      <button class="link" onclick={() => (step = 0)}>Retour</button>
      <button class="next" disabled={currentCents === null || savingsCents === null} onclick={() => (step = 2)}>
        Continuer
      </button>
    </div>
  {:else if step === 2}
    <h2>Tes revenus du mois</h2>
    <p class="hint">
      Tout ce qui arrive sur ton compte chaque mois : salaire, aide, bourse… Ils seront préremplis
      chaque mois et tu les confirmeras d'une touche.
    </p>
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
      <button class="link" onclick={() => (step = 1)}>Retour</button>
      <button class="next" disabled={incomeLines.length === 0 || fixedCents === null} onclick={() => (step = 3)}>
        Continuer
      </button>
    </div>
  {:else}
    <h2>Tes enveloppes</h2>
    <p class="hint">
      Commence par 4 ou 5, tu en ajouteras d'autres plus tard.
      <strong>Mensuelle</strong> : repart à son plafond chaque mois, l'argent reste sur le courant.
      <strong>Cagnotte</strong> : accumule pour un achat futur, l'argent va sur l'épargne.
    </p>

    <div class="suggestions">
      {#each SUGGESTIONS.filter((s) => !drafts.some((d) => d.name === s)) as suggestion (suggestion)}
        <button onclick={() => addSuggestion(suggestion)}>+ {suggestion}</button>
      {/each}
    </div>

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
      <button class="link" onclick={() => (step = 2)}>Retour</button>
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

  .intro {
    padding-top: 12px;
  }

  .pitch {
    margin: 0 0 16px;
    font-size: 17px;
    line-height: 1.5;
  }

  .pitch.small {
    font-size: 14px;
    color: var(--muted);
  }

  .pitch.warn {
    color: var(--warn);
  }

  .intro h3 {
    margin: 22px 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  .example {
    margin: 14px 0 0;
    padding: 14px 16px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 15px;
    line-height: 1.6;
  }

  .pitch strong {
    color: var(--text);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .suggestions button {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 14px;
  }

  .restore {
    display: block;
    margin: 18px 0 40px;
    text-align: center;
    font-size: 14px;
    color: var(--muted);
    text-decoration: underline;
    cursor: pointer;
  }

  .restore input {
    display: none;
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
