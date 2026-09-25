<script lang="ts">
  import { exportBackup, importBackup } from '../backup';
  import { monthLabel } from '../domain/dates';
  import Allocation from '../ui/Allocation.svelte';
  import { accountsView, budgetAt, standingOrderPlan } from '../domain/engine';
  import { formatCents, formatShort, parseAmount } from '../domain/money';
  import type { Envelope } from '../domain/types';
  import { router } from '../router.svelte';
  import { store } from '../store.svelte';
  import { toast } from '../toast.svelte';

  let { onedit }: { onedit: (envelope?: Envelope) => void } = $props();

  const data = $derived(store.data!);
  const accounts = $derived(accountsView(data, store.today));
  const plan = $derived(standingOrderPlan(data, store.currentMonth));
  const plain = (cents: number) => formatCents(cents).replace(/'/g, '');

  const envelopes = $derived(
    data.envelopes.filter((e) => e.archivedFrom === null).sort((a, b) => a.order - b.order),
  );
  const archived = $derived(data.envelopes.filter((e) => e.archivedFrom !== null));
  const templates = $derived([...data.incomeTemplates].sort((a, b) => a.order - b.order));

  const amountOf = (id: string) => budgetAt(data, id, store.currentMonth)?.amountCents ?? 0;

  // ── Enveloppes archivées ─────────────────────────────────────────────────
  let confirmPurge = $state<string | null>(null);

  async function purge(id: string) {
    if (confirmPurge !== id) {
      confirmPurge = id;
      return;
    }
    const count = data.expenses.filter((x) => x.envelopeId === id).length;
    await store.purgeEnvelope(id);
    confirmPurge = null;
    toast.show(count > 0 ? `Enveloppe et ${count} dépense(s) supprimées` : 'Enveloppe supprimée');
  }

  // ── Épargne fixe ─────────────────────────────────────────────────────────
  let fixedRaw = $state<string | null>(null);
  const fixedValue = $derived(fixedRaw ?? plain(plan.fixedSavingsCents));

  async function saveFixed() {
    const cents = parseAmount(fixedValue);
    if (cents === null) return toast.show('Montant invalide');
    await store.setFixedSavings(cents);
    fixedRaw = null;
    toast.show(
      `Pense à modifier ton ordre permanent : ${formatShort(standingOrderPlan(store.data!, store.currentMonth).totalCents)} CHF par mois.`,
      6000,
    );
  }

  // ── Revenus ──────────────────────────────────────────────────────────────
  let incomeEdits = $state<Record<string, { name: string; amount: string }>>({});
  let newIncome = $state({ name: '', amount: '' });

  async function saveIncome(id: string, name: string, amount: string) {
    const cents = parseAmount(amount);
    if (!name.trim() || cents === null) return toast.show('Revenu invalide');
    await store.saveIncomeTemplate({ id, name: name.trim(), amountCents: cents });
    delete incomeEdits[id];
    toast.show('Revenu enregistré');
  }

  async function addIncome() {
    const cents = parseAmount(newIncome.amount);
    if (!newIncome.name.trim() || cents === null) return toast.show('Revenu invalide');
    await store.saveIncomeTemplate({ name: newIncome.name.trim(), amountCents: cents });
    newIncome = { name: '', amount: '' };
  }

  // ── Vérifier mon solde ───────────────────────────────────────────────────
  let checkCurrent = $state('');
  let checkSavings = $state('');
  const gaps = $derived({
    current: parseAmount(checkCurrent) === null ? null : parseAmount(checkCurrent)! - accounts.currentCents,
    savings: parseAmount(checkSavings) === null ? null : parseAmount(checkSavings)! - accounts.savingsAccountCents,
  });

  async function applyGap(account: 'current' | 'savings') {
    const gap = gaps[account];
    if (!gap) return;
    await store.addMove({
      date: store.today,
      type: 'adjustment',
      account,
      amountCents: gap,
      note: 'Correction après vérification',
    });
    if (account === 'current') checkCurrent = '';
    else checkSavings = '';
    toast.show('Solde corrigé');
  }

  // ── Données ──────────────────────────────────────────────────────────────
  let importing = $state(false);

  async function onImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importing = true;
    try {
      await importBackup(file);
      await store.reload();
      toast.show('Sauvegarde restaurée');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Import impossible', 5000);
    } finally {
      importing = false;
    }
  }
</script>

<div class="screen">
  <header class="topbar">
    <button class="icon-btn" aria-label="Retour" onclick={() => router.back()}>‹</button>
    <h1 class="title">Réglages</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>

  <h2 class="section-title">Répartition du mois</h2>
  <div class="card">
    <Allocation month={store.currentMonth} />
  </div>

  <h2 class="section-title">Enveloppes</h2>
  <ul class="list card">
    {#each envelopes as envelope, i (envelope.id)}
      <li>
        <button class="row" onclick={() => onedit(envelope)}>
          <span class="what">
            <span>{envelope.name}</span>
            <span class="detail">
              {envelope.type === 'monthly' ? 'mensuelle' : 'cagnotte'} · {formatShort(amountOf(envelope.id))} par mois
            </span>
          </span>
        </button>
        <span class="order">
          <button aria-label="Monter" disabled={i === 0} onclick={() => store.reorderEnvelope(envelope.id, -1)}>↑</button>
          <button aria-label="Descendre" disabled={i === envelopes.length - 1} onclick={() => store.reorderEnvelope(envelope.id, 1)}>↓</button>
        </span>
      </li>
    {/each}
  </ul>
  <button class="add" onclick={() => onedit()}>+ Nouvelle enveloppe</button>
  {#if archived.length}
    <h2 class="section-title">Archivées</h2>
    <ul class="list card">
      {#each archived as envelope (envelope.id)}
        <li>
          <button class="row" onclick={() => router.openEnvelope(envelope.id)}>
            <span class="what">
              <span>{envelope.name}</span>
              <span class="detail">
                {envelope.type === 'monthly' ? 'mensuelle' : 'cagnotte'} · archivée depuis {monthLabel(envelope.archivedFrom!).toLowerCase()}
              </span>
            </span>
          </button>
          <button class="restore" onclick={() => store.restoreEnvelope(envelope.id)}>Restaurer</button>
          <button class="purge" class:armed={confirmPurge === envelope.id} onclick={() => purge(envelope.id)}>
            {confirmPurge === envelope.id ? 'Confirmer' : 'Supprimer'}
          </button>
        </li>
      {/each}
    </ul>
    <p class="hint">
      Supprimer efface aussi les dépenses de l'enveloppe : les totaux des mois concernés changeront.
    </p>
  {/if}

  <h2 class="section-title">Revenus mensuels</h2>
  <ul class="list card">
    {#each templates as template (template.id)}
      {@const edit = incomeEdits[template.id] ?? { name: template.name, amount: plain(template.amountCents) }}
      <li class="edit">
        <input
          type="text"
          aria-label="Nom du revenu"
          value={edit.name}
          oninput={(e) => (incomeEdits[template.id] = { ...edit, name: e.currentTarget.value })}
          onchange={() => saveIncome(template.id, edit.name, edit.amount)}
        />
        <input
          class="num amount"
          type="text"
          inputmode="decimal"
          aria-label="Montant"
          value={edit.amount}
          oninput={(e) => (incomeEdits[template.id] = { ...edit, amount: e.currentTarget.value })}
          onchange={() => saveIncome(template.id, edit.name, edit.amount)}
        />
        <button class="remove" aria-label="Supprimer" onclick={() => store.deleteIncomeTemplate(template.id)}>×</button>
      </li>
    {/each}
    <li class="edit">
      <input type="text" placeholder="Nouveau revenu" bind:value={newIncome.name} />
      <input class="num amount" type="text" inputmode="decimal" placeholder="0" bind:value={newIncome.amount} />
      <button class="remove" aria-label="Ajouter" onclick={addIncome}>+</button>
    </li>
  </ul>

  <h2 class="section-title">Ordre permanent · {formatShort(plan.totalCents)} par mois</h2>
  <ul class="list card">
    <li class="edit">
      <span>Épargne fixe</span>
      <input
        class="num amount"
        type="text"
        inputmode="decimal"
        aria-label="Épargne fixe"
        value={fixedValue}
        oninput={(e) => (fixedRaw = e.currentTarget.value)}
        onchange={saveFixed}
      />
    </li>
    {#each plan.lines as line (line.name)}
      <li><span>{line.name}</span><span class="num">{formatShort(line.amountCents)}</span></li>
    {/each}
    <li class="total"><span>À virer chaque mois</span><span class="num">{formatShort(plan.totalCents)}</span></li>
  </ul>

  <h2 class="section-title">Vérifier mon solde</h2>
  <ul class="list card">
    <li class="edit">
      <span class="what"><span>Compte courant</span><span class="detail num">l'app calcule {formatShort(accounts.currentCents)}</span></span>
      <input class="num amount" type="text" inputmode="decimal" placeholder="solde réel" aria-label="Solde réel du compte courant" bind:value={checkCurrent} />
    </li>
    {#if gaps.current !== null}
      <li class="gap">
        {#if gaps.current === 0}
          <span class="ok">✓ Tout correspond</span>
        {:else}
          <span class:negative={gaps.current < 0}>Écart de {formatShort(gaps.current)} CHF — une dépense oubliée ?</span>
          <button onclick={() => applyGap('current')}>Corriger</button>
        {/if}
      </li>
    {/if}
    <li class="edit">
      <span class="what"><span>Compte épargne</span><span class="detail num">l'app calcule {formatShort(accounts.savingsAccountCents)}</span></span>
      <input class="num amount" type="text" inputmode="decimal" placeholder="solde réel" aria-label="Solde réel du compte épargne" bind:value={checkSavings} />
    </li>
    {#if gaps.savings !== null}
      <li class="gap">
        {#if gaps.savings === 0}
          <span class="ok">✓ Tout correspond</span>
        {:else}
          <span class:negative={gaps.savings < 0}>Écart de {formatShort(gaps.savings)} CHF</span>
          <button onclick={() => applyGap('savings')}>Corriger</button>
        {/if}
      </li>
    {/if}
  </ul>

  <h2 class="section-title">Sauvegarde</h2>
  <div class="card data">
    <p class="hint left">
      Tes données sont uniquement sur ce téléphone. Exporte-les de temps en temps et range le fichier
      dans Fichiers, iCloud Drive ou par mail.
    </p>
    <div class="buttons">
      <button onclick={async () => toast.show((await exportBackup()) ? 'Sauvegarde exportée' : 'Rien à exporter')}>
        Exporter
      </button>
      <label class="import">
        {importing ? 'Import…' : 'Importer'}
        <input type="file" accept="application/json,.json" onchange={onImport} />
      </label>
    </div>
    <p class="hint left warn">L'import remplace toutes les données actuelles.</p>
  </div>
</div>

<style>
  .title {
    flex: 1;
    margin: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }

  .list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 16px;
  }

  .list li + li {
    border-top: 1px solid var(--line);
  }

  .row {
    flex: 1;
    text-align: left;
    padding: 4px 0;
  }

  .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .detail {
    font-size: 13px;
    color: var(--muted);
  }

  .order {
    display: flex;
    gap: 2px;
  }

  .order button {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    color: var(--muted);
  }

  .order button:active {
    background: var(--surface-2);
  }

  .edit input {
    min-width: 0;
    flex: 1;
    padding: 8px 10px;
    border: 0;
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 16px;
  }

  .edit .amount {
    flex: 0 0 110px;
    text-align: right;
  }

  .restore,
  .purge {
    padding: 8px 10px;
    font-weight: 600;
    font-size: 14px;
  }

  .restore {
    color: var(--accent);
  }

  .purge {
    color: var(--danger);
  }

  .purge.armed {
    border-radius: 10px;
    background: var(--danger);
    color: #fff;
  }

  .remove {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--muted);
    font-size: 20px;
  }

  .total {
    font-weight: 600;
  }

  .gap {
    font-size: 14px;
  }

  .gap button {
    color: var(--accent);
    font-weight: 600;
    padding: 4px 8px;
  }

  .ok {
    color: var(--ok);
  }

  .add {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 12px;
    border-radius: 14px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-weight: 600;
    color: var(--accent);
  }

  .data {
    padding: 16px;
  }

  .buttons {
    display: flex;
    gap: 8px;
    margin: 12px 0 4px;
  }

  .buttons button,
  .import {
    flex: 1;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: var(--surface-2);
    font-weight: 600;
    cursor: pointer;
  }

  .import input {
    display: none;
  }

  .hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }

  .hint.left {
    text-align: left;
    margin: 0;
  }

  .warn {
    color: var(--warn);
  }
</style>
