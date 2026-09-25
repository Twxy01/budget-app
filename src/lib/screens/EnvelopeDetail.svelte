<script lang="ts">
  import { dayLabel, monthLabel, monthOf } from '../domain/dates';
  import { budgetAt, monthlyEnvelopeState, potForecast, potStateAt } from '../domain/engine';
  import { formatShort } from '../domain/money';
  import type { Expense } from '../domain/types';
  import { router } from '../router.svelte';
  import { store } from '../store.svelte';
  import Gauge from '../ui/Gauge.svelte';
  import { monthlyTone, ratio } from '../ui/tone';

  let { id, onedit }: { id: string; onedit: (expense: Expense) => void } = $props();

  const data = $derived(store.data!);
  const envelope = $derived(data.envelopes.find((e) => e.id === id));
  const monthly = $derived(envelope?.type === 'monthly' ? monthlyEnvelopeState(data, envelope, store.month) : null);
  const pot = $derived(envelope?.type === 'pot' ? potStateAt(data, envelope, store.month) : null);
  const contribution = $derived(envelope ? (budgetAt(data, envelope.id, store.month)?.amountCents ?? 0) : 0);

  const forecast = $derived(pot ? potForecast(pot, contribution) : null);

  const archived = $derived(envelope?.archivedFrom !== null);

  // Une cagnotte ne reçoit qu'un gros achat de temps en temps, et une enveloppe archivée
  // n'a plus de mois courant : on montre tout leur historique plutôt que le seul mois affiché.
  const showAll = $derived(!!pot || archived);
  const expenses = $derived(
    data.expenses
      .filter((x) => x.envelopeId === id && (showAll || monthOf(x.date) === store.month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
  );
</script>

<div class="screen">
  <header class="topbar">
    <button class="icon-btn" aria-label="Retour" onclick={() => router.back()}>‹</button>
    <h1 class="title">{envelope?.name ?? 'Enveloppe'}</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>

  {#if !envelope}
    <p class="empty">Cette enveloppe n'existe plus.</p>
  {:else}
    <section class="hero">
      {#if monthly}
        <p class="label">Reste · {monthLabel(store.month)}</p>
        <p class="big num" class:negative={monthly.remainingCents < 0}>
          {formatShort(monthly.remainingCents)}<span class="unit">CHF</span>
        </p>
        <Gauge ratio={ratio(monthly.remainingCents, monthly.budgetCents)} tone={monthlyTone(monthly.remainingCents, monthly.budgetCents)} />
        <p class="sub num">Dépensé {formatShort(monthly.spentCents)} sur {formatShort(monthly.budgetCents)}</p>
      {:else if pot}
        <p class="label">{pot.maxCents !== null ? 'Prochain achat' : 'Dans la cagnotte'}</p>
        <p class="big num" class:negative={pot.endCents < 0}>
          {formatShort(pot.endCents)}{#if pot.maxCents !== null}<span class="unit">/ {formatShort(pot.maxCents)}</span>{:else}<span class="unit">CHF</span>{/if}
        </p>
        {#if pot.maxCents !== null}
          <Gauge ratio={ratio(pot.endCents, pot.maxCents)} tone={pot.endCents < 0 ? 'danger' : 'pot'} />
        {/if}
        {#if forecast?.readyMonth}
          <p class="ready">
            {forecast.monthsNeeded === 0
              ? 'Tu peux racheter maintenant'
              : `Possible dès ${monthLabel(forecast.readyMonth).toLowerCase()}`}
          </p>
        {/if}
        <p class="sub num">+{formatShort(contribution)} par mois · sur le compte épargne</p>
        {#if pot.overflowCents > 0}
          <p class="sub num">{formatShort(pot.overflowCents)} au-delà du maximum sont passés en épargne ce mois-ci.</p>
        {/if}
      {/if}
      {#if envelope.memo}<p class="memo">{envelope.memo}</p>{/if}
    </section>

    {#if archived}
      <p class="archived">Enveloppe archivée depuis {monthLabel(envelope.archivedFrom!).toLowerCase()}.</p>
    {/if}

    <h2 class="section-title">{showAll ? 'Achats' : `Dépenses · ${monthLabel(store.month)}`}</h2>
    {#if expenses.length}
      <ul class="list card">
        {#each expenses as expense (expense.id)}
          <li>
            <button class="row" onclick={() => onedit(expense)}>
              <span class="what">
                <span class="note">{expense.note}</span>
                <span class="day">{dayLabel(expense.date, store.today)}</span>
              </span>
              <span class="num amount">−{formatShort(expense.amountCents)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">{showAll ? 'Aucun achat pour le moment.' : 'Aucune dépense ce mois-ci.'}</p>
    {/if}
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
    padding: 20px 4px 8px;
    text-align: center;
  }

  .hero :global(.track) {
    max-width: 280px;
    margin: 0 auto;
  }

  .label {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
  }

  .big {
    margin: 2px 0 14px;
    font-size: 52px;
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
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--muted);
  }

  .ready {
    margin: 14px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--pot);
  }

  .memo {
    margin: 12px 0 0;
    font-size: 14px;
    color: var(--muted);
    font-style: italic;
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
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    text-align: left;
  }

  .row:active {
    background: var(--surface-2);
  }

  .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .day {
    font-size: 13px;
    color: var(--muted);
  }

  .amount {
    font-weight: 600;
    white-space: nowrap;
  }

  .archived {
    margin: 4px 0 0;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
  }

  .empty {
    margin: 24px 0;
    text-align: center;
    color: var(--muted);
  }
</style>
