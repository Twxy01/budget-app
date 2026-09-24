<script lang="ts">
  import { dayLabel, monthLabel, monthOf } from '../domain/dates';
  import { accountsView, potStateAt, savingsHistory, standingOrderPlan } from '../domain/engine';
  import { formatShort } from '../domain/money';
  import { router } from '../router.svelte';
  import { store } from '../store.svelte';

  let { onmove }: { onmove: (type: 'deposit' | 'withdrawal') => void } = $props();

  const data = $derived(store.data!);
  const accounts = $derived(accountsView(data, store.today));
  const plan = $derived(standingOrderPlan(data, store.currentMonth));
  const history = $derived(savingsHistory(data, store.today));

  const pots = $derived(
    data.envelopes
      .filter((e) => e.type === 'pot' && e.archivedFrom === null)
      .sort((a, b) => a.order - b.order)
      .map((envelope) => ({ envelope, state: potStateAt(data, envelope, store.currentMonth) })),
  );
</script>

<div class="screen">
  <header class="topbar">
    <button class="icon-btn" aria-label="Retour" onclick={() => router.back()}>‹</button>
    <h1 class="title">Épargne</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>

  <section class="hero">
    <p class="label">Argent au chaud</p>
    <p class="big num" class:negative={accounts.freeSavingsCents < 0}>
      {formatShort(accounts.freeSavingsCents)}<span class="unit">CHF</span>
    </p>
    <p class="sub">Ce que tu gardes, cagnottes déduites.</p>
  </section>

  <div class="actions">
    <button onclick={() => onmove('deposit')}>Ajout</button>
    <button onclick={() => onmove('withdrawal')}>Retrait</button>
  </div>

  <h2 class="section-title">Compte épargne</h2>
  <ul class="list card">
    <li><span>Argent au chaud</span><span class="num">{formatShort(accounts.freeSavingsCents)}</span></li>
    {#each pots as { envelope, state } (envelope.id)}
      <li class="pot"><span>{envelope.name}</span><span class="num">{formatShort(state?.endCents ?? 0)}</span></li>
    {/each}
    <li class="total"><span>Total du compte</span><span class="num">{formatShort(accounts.savingsAccountCents)}</span></li>
  </ul>

  <h2 class="section-title">Ordre permanent · {formatShort(plan.totalCents)} par mois</h2>
  <ul class="list card">
    {#if plan.fixedSavingsCents !== 0}
      <li><span>Épargne fixe</span><span class="num">{formatShort(plan.fixedSavingsCents)}</span></li>
    {/if}
    {#each plan.lines as line (line.name)}
      <li><span>{line.name}</span><span class="num">{formatShort(line.amountCents)}</span></li>
    {/each}
    <li class="total"><span>À virer chaque mois</span><span class="num">{formatShort(plan.totalCents)}</span></li>
  </ul>

  <h2 class="section-title">Mouvements</h2>
  {#if history.length}
    <ul class="list card">
      {#each history as entry, i (entry.date + entry.kind + entry.label + i)}
        <li class="move">
          <span class="what">
            <span>{entry.label}</span>
            <span class="detail">
              {entry.kind === 'close' ? monthLabel(entry.detail).toLowerCase() : entry.detail || dayLabel(entry.date, store.today)}
              {#if entry.detail && entry.kind !== 'close'} · {dayLabel(entry.date, store.today)}{/if}
              {#if entry.kind === 'standing'} · {monthLabel(monthOf(entry.date)).toLowerCase()}{/if}
            </span>
          </span>
          <span class="num" class:negative={entry.amountCents < 0}>
            {entry.amountCents > 0 ? '+' : '−'}{formatShort(Math.abs(entry.amountCents))}
          </span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">Aucun mouvement pour l'instant.</p>
  {/if}
</div>

<style>
  .title {
    flex: 1;
    margin: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
  }

  .hero {
    padding: 20px 4px 16px;
    text-align: center;
  }

  .label {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
  }

  .big {
    margin: 2px 0 6px;
    font-size: 56px;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }

  .unit {
    margin-left: 8px;
    font-size: 20px;
    font-weight: 500;
    color: var(--muted);
    letter-spacing: 0;
  }

  .sub {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions button {
    flex: 1;
    height: 48px;
    border-radius: 14px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-weight: 600;
  }

  .actions button:active {
    background: var(--surface-2);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }

  .list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 16px;
  }

  .list li + li {
    border-top: 1px solid var(--line);
  }

  .pot span:first-child::before {
    content: '↳ ';
    color: var(--pot);
  }

  .total {
    font-weight: 600;
  }

  .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .detail {
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .move .num {
    font-weight: 600;
    white-space: nowrap;
  }

  .empty {
    margin: 16px 0;
    text-align: center;
    color: var(--muted);
  }
</style>
