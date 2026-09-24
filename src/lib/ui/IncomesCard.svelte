<script lang="ts">
  import { monthLabel } from '../domain/dates';
  import { formatCents, formatCHF, parseAmount } from '../domain/money';
  import { store } from '../store.svelte';
  import { toast } from '../toast.svelte';

  let { month }: { month: string } = $props();

  const templates = $derived(
    [...store.data!.incomeTemplates].sort((a, b) => a.order - b.order),
  );

  // Montants préremplis, modifiables si le mois est différent de d'habitude.
  let edits = $state<Record<string, string>>({});
  const raw = (id: string, amountCents: number) => edits[id] ?? formatCents(amountCents).replace(/'/g, '');

  const lines = $derived(
    templates.map((t) => ({ template: t, cents: parseAmount(raw(t.id, t.amountCents)) })),
  );
  const totalCents = $derived(lines.reduce((sum, l) => sum + (l.cents ?? 0), 0));
  const valid = $derived(lines.every((l) => l.cents !== null) && totalCents > 0);

  let busy = $state(false);

  async function confirm() {
    if (!valid || busy) return;
    busy = true;
    await store.confirmIncomes(
      month,
      lines.map((l) => ({ name: l.template.name, amountCents: l.cents! })),
    );
    toast.show(`Revenus confirmés · ${formatCHF(totalCents)}`);
  }
</script>

<section class="card">
  <h2>Revenus de {monthLabel(month).toLowerCase()}</h2>

  {#if templates.length === 0}
    <p class="hint">Aucun revenu enregistré. Tu pourras les ajouter dans les réglages.</p>
  {:else}
    <ul>
      {#each templates as template (template.id)}
        <li>
          <span class="name">{template.name}</span>
          <input
            class="num"
            type="text"
            inputmode="decimal"
            aria-label={template.name}
            value={raw(template.id, template.amountCents)}
            oninput={(e) => (edits[template.id] = e.currentTarget.value)}
          />
        </li>
      {/each}
    </ul>
    <button class="confirm" disabled={!valid || busy} onclick={confirm}>
      Confirmer {formatCHF(totalCents)}
    </button>
    <p class="hint">Reçus sur ton compte courant. À confirmer une fois par mois.</p>
  {/if}
</section>

<style>
  .card {
    padding: 16px;
    margin-bottom: 12px;
  }

  h2 {
    margin: 0 0 10px;
    font-size: 16px;
  }

  ul {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .name {
    color: var(--muted);
  }

  input {
    width: 110px;
    padding: 8px 10px;
    border: 0;
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 16px;
    text-align: right;
  }

  .confirm {
    width: 100%;
    height: 48px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 16px;
    font-weight: 600;
  }

  .hint {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }
</style>
