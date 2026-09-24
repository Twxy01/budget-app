<script lang="ts">
  import { monthLabel } from '../domain/dates';
  import { monthView } from '../domain/engine';
  import { formatCents, formatCHF, formatShort, parseAmount } from '../domain/money';
  import { store } from '../store.svelte';
  import { toast } from '../toast.svelte';

  let { month, ondismiss }: { month: string; ondismiss: () => void } = $props();

  const view = $derived(monthView(store.data!, month));
  const proposedCents = $derived(view.proposalCents);

  let edited = $state<string | null>(null);
  const raw = $derived(edited ?? formatCents(proposedCents).replace(/'/g, ''));
  const savedCents = $derived(parseAmount(raw));
  let busy = $state(false);

  async function confirm() {
    if (savedCents === null || busy) return;
    busy = true;
    await store.closeMonth(month, proposedCents, savedCents);
    toast.show(`${formatCHF(savedCents)} ajoutés à ton épargne`);
  }

  async function skip() {
    if (busy) return;
    busy = true;
    await store.closeMonth(month, proposedCents, 0);
    toast.show('Bilan ignoré');
  }
</script>

<section class="card">
  <h2>Bilan de {monthLabel(month).toLowerCase()}</h2>

  <p class="lead">
    Tu n'as pas dépensé <strong class="num">{formatShort(proposedCents)} CHF</strong>.
    Vire ce montant sur ton compte épargne, puis confirme ci-dessous.
  </p>

  <ul>
    {#each view.monthly.filter((m) => m.remainingCents !== 0) as row (row.envelope.id)}
      <li>
        <span class="name">{row.envelope.name}</span>
        <span class="num" class:negative={row.remainingCents < 0}>{formatShort(row.remainingCents)}</span>
      </li>
    {/each}
    {#if view.unassignedCents !== 0}
      <li>
        <span class="name">Non attribué</span>
        <span class="num" class:negative={view.unassignedCents < 0}>{formatShort(view.unassignedCents)}</span>
      </li>
    {/if}
  </ul>

  <label class="amount">
    Montant mis de côté
    <input
      class="num"
      type="text"
      inputmode="decimal"
      value={raw}
      oninput={(e) => (edited = e.currentTarget.value)}
    />
  </label>

  <button class="confirm" disabled={savedCents === null || busy} onclick={confirm}>
    J'ai mis {savedCents === null ? '—' : formatCHF(savedCents)} de côté
  </button>

  <div class="secondary">
    <button onclick={skip} disabled={busy}>Ignorer</button>
    <button onclick={ondismiss} disabled={busy}>Plus tard</button>
  </div>
</section>

<style>
  .card {
    padding: 16px;
    margin-bottom: 12px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }

  .lead {
    margin: 0 0 12px;
    font-size: 15px;
    color: var(--muted);
  }

  .lead strong {
    color: var(--text);
  }

  ul {
    list-style: none;
    margin: 0 0 14px;
    padding: 0;
    font-size: 14px;
  }

  li {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
  }

  .name {
    color: var(--muted);
  }

  .amount {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 14px;
    color: var(--muted);
  }

  .amount input {
    width: 120px;
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

  .secondary {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 12px;
    font-size: 14px;
    color: var(--muted);
  }

  .secondary button {
    padding: 6px;
    text-decoration: underline;
  }
</style>
