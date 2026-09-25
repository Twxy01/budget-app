<script lang="ts">
  import { allocation } from '../domain/engine';
  import { formatShort } from '../domain/money';
  import { store } from '../store.svelte';

  let { month }: { month: string } = $props();

  const plan = $derived(allocation(store.data!, month));
  const over = $derived(plan.unassignedCents < 0);
  /** Quand le budget dépasse les revenus, la barre représente le budget, pas les revenus. */
  const total = $derived(
    over ? plan.monthlyCents + plan.potsCents + plan.fixedSavingsCents : Math.max(plan.incomeCents, 1),
  );

  const parts = $derived([
    { key: 'monthly', label: 'Enveloppes du mois', cents: plan.monthlyCents },
    { key: 'pots', label: 'Cagnottes', cents: plan.potsCents },
    { key: 'fixed', label: 'Épargne fixe', cents: plan.fixedSavingsCents },
    { key: 'rest', label: over ? 'Dépassement' : 'Non attribué', cents: Math.abs(plan.unassignedCents) },
  ].filter((p) => p.cents > 0));
</script>

<div class="viz">
  <div class="bar">
    {#each parts as part (part.key)}
      <div
        class="seg {part.key}"
        class:over={part.key === 'rest' && over}
        style:flex-grow={part.cents / total}
        title="{part.label} · {formatShort(part.cents)} CHF"
      ></div>
    {/each}
  </div>

  <ul class="legend">
    {#each parts as part (part.key)}
      <li>
        <span class="chip {part.key}" class:over={part.key === 'rest' && over}></span>
        <span class="label">{part.label}</span>
        <span class="num value" class:negative={part.key === 'rest' && over}>
          {over && part.key === 'rest' ? '−' : ''}{formatShort(part.cents)}
        </span>
      </li>
    {/each}
    <li class="total">
      <span class="chip empty"></span>
      <span class="label">Revenus du mois</span>
      <span class="num value">{formatShort(plan.incomeCents)}</span>
    </li>
  </ul>

  {#if over}
    <p class="note negative">Ton budget dépasse tes revenus de {formatShort(-plan.unassignedCents)} CHF.</p>
  {:else if plan.unassignedCents > 0}
    <p class="note">
      {formatShort(plan.unassignedCents)} CHF ne sont dans aucune enveloppe. Ils resteront sur ton compte courant
      et te seront proposés au bilan de fin de mois.
    </p>
  {/if}
</div>

<style>
  /* Palette vérifiée (bandes de luminosité, contraste et daltonisme), clair et sombre. */
  .viz {
    --monthly: #0f7a4e;
    --pots: #3d5f9e;
    --fixed: #a8620f;
    padding: 16px;
  }

  @media (prefers-color-scheme: dark) {
    .viz {
      --monthly: #3fa876;
      --pots: #6f93d8;
      --fixed: #b87d1c;
    }
  }

  .bar {
    display: flex;
    gap: 2px;
    height: 14px;
    margin-bottom: 14px;
  }

  .seg {
    flex-basis: 0;
    min-width: 4px;
    border-radius: 4px;
  }

  .monthly {
    background: var(--monthly);
  }

  .pots {
    background: var(--pots);
  }

  .fixed {
    background: var(--fixed);
  }

  .rest {
    background: var(--track);
    border: 1px dashed var(--line);
  }

  .rest.over {
    background: var(--danger);
    border: 0;
  }

  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 14px;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }

  .chip {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  .chip.empty {
    background: none;
  }

  .label {
    flex: 1;
    color: var(--muted);
  }

  .value {
    font-weight: 600;
  }

  .total {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }

  .note {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
