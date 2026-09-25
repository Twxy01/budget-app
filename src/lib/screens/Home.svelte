<script lang="ts">
  import { monthLabel } from '../domain/dates';
  import { accountsView, monthView, pendingCloses, standingOrderPlan } from '../domain/engine';
  import { formatShort } from '../domain/money';
  import { router } from '../router.svelte';
  import { store } from '../store.svelte';
  import BilanCard from '../ui/BilanCard.svelte';
  import Gauge from '../ui/Gauge.svelte';
  import IncomesCard from '../ui/IncomesCard.svelte';
  import { monthlyTone, ratio } from '../ui/tone';

  let { dev }: { dev?: { reset: () => void } } = $props();

  const data = $derived(store.data!);
  const view = $derived(monthView(data, store.month));
  const accounts = $derived(accountsView(data, store.today));
  const order = $derived(standingOrderPlan(data, store.currentMonth));
  const isCurrent = $derived(store.month === store.currentMonth);

  // Bilan du mois le plus ancien non clôturé, que l'on peut repousser à plus tard.
  let dismissed = $state<string | null>(null);
  const pendingMonth = $derived(
    isCurrent ? (pendingCloses(data, store.today).find((m) => m !== dismissed) ?? null) : null,
  );
</script>

<div class="screen">
  <header class="topbar">
    <span class="icon-btn" aria-hidden="true"></span>
    <button class="icon-btn" aria-label="Mois précédent" disabled={!store.canGoPrev} onclick={() => store.shiftMonth(-1)}>‹</button>
    <h1 class="month">{monthLabel(store.month)}</h1>
    <button class="icon-btn" aria-label="Mois suivant" disabled={!store.canGoNext} onclick={() => store.shiftMonth(1)}>›</button>
    <button class="icon-btn gear" aria-label="Réglages" onclick={() => router.openSettings()}>⚙</button>
  </header>

  {#if isCurrent && view.incomesPending}
    <IncomesCard month={store.month} />
  {/if}

  {#if pendingMonth}
    <BilanCard month={pendingMonth} ondismiss={() => (dismissed = pendingMonth)} />
  {/if}

  <section class="hero">
    <p class="label">{isCurrent ? 'Disponible ce mois' : 'Reste du mois'}</p>
    <p class="big num" class:negative={view.availableCents < 0}>
      {formatShort(view.availableCents)}<span class="unit">CHF</span>
    </p>
    {#if isCurrent}
      <button class="accounts num" onclick={() => router.openSavings()}>
        Courant {formatShort(accounts.currentCents)} · Épargne {formatShort(accounts.freeSavingsCents)} ›
      </button>
      <p class="accounts num">
        Ordre permanent {formatShort(order.totalCents)} par mois
      </p>
    {/if}
  </section>

  <ul class="list card">
    {#each view.monthly as row (row.envelope.id)}
      <li>
        <button class="row" onclick={() => router.openEnvelope(row.envelope.id)}>
          <span class="line">
            <span class="name">{row.envelope.name}</span>
            <span class="num">
              <strong class:negative={row.remainingCents < 0}>{formatShort(row.remainingCents)}</strong>
              <span class="of">/ {formatShort(row.budgetCents)}</span>
            </span>
          </span>
          <Gauge ratio={ratio(row.remainingCents, row.budgetCents)} tone={monthlyTone(row.remainingCents, row.budgetCents)} />
        </button>
      </li>
    {/each}
  </ul>

  {#if view.pots.length}
    <h2 class="section-title">Cagnottes · {formatShort(accounts.reservedCents)} sur le compte épargne</h2>
    <ul class="list card">
      {#each view.pots as { envelope, state } (envelope.id)}
        <li>
          <button class="row" onclick={() => router.openEnvelope(envelope.id)}>
            <span class="line">
              <span class="name">{envelope.name}</span>
              <span class="num">
                <strong class:negative={state.endCents < 0}>{formatShort(state.endCents)}</strong>
                {#if state.maxCents !== null}<span class="of">/ {formatShort(state.maxCents)}</span>{/if}
              </span>
            </span>
            {#if state.maxCents !== null}
              <Gauge ratio={ratio(state.endCents, state.maxCents)} tone={state.endCents < 0 ? 'danger' : 'pot'} />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if dev}
    <button class="dev" onclick={dev.reset}>Réinitialiser la démo (dev)</button>
  {/if}
</div>

<style>
  .gear {
    font-size: 19px;
    color: var(--muted);
  }

  .month {
    flex: 1;
    margin: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
  }

  .hero {
    padding: 20px 4px 24px;
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

  .accounts {
    display: block;
    width: 100%;
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }

  button.accounts:active {
    color: var(--text);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }

  .list li + li {
    border-top: 1px solid var(--line);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 14px 16px;
    text-align: left;
  }

  .row:active {
    background: var(--surface-2);
  }

  .list li:first-child .row {
    border-radius: var(--radius) var(--radius) 0 0;
  }

  .list li:last-child .row {
    border-radius: 0 0 var(--radius) var(--radius);
  }

  .line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .name {
    font-weight: 500;
  }

  strong {
    font-size: 17px;
  }

  .of {
    margin-left: 2px;
    font-size: 13px;
    color: var(--muted);
  }

  .dev {
    display: block;
    margin: 32px auto 0;
    font-size: 13px;
    color: var(--muted);
    text-decoration: underline;
  }
</style>
