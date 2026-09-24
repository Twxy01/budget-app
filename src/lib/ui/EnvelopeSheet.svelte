<script lang="ts" module>
  import type { Envelope } from '../domain/types';

  export type EnvelopeRequest = { envelope?: Envelope };
</script>

<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { budgetAt, standingOrderPlan } from '../domain/engine';
  import { formatCents, formatShort, parseAmount } from '../domain/money';
  import { store } from '../store.svelte';
  import { toast } from '../toast.svelte';

  let { request, onclose }: { request: EnvelopeRequest; onclose: () => void } = $props();

  const editing = untrack(() => request.envelope);
  const budget = editing ? budgetAt(store.data!, editing.id, store.currentMonth) : null;
  const plain = (cents: number) => formatCents(cents).replace(/'/g, '');

  let name = $state(editing?.name ?? '');
  let type = $state<Envelope['type']>(editing?.type ?? 'monthly');
  let memo = $state(editing?.memo ?? '');
  let amountRaw = $state(budget ? plain(budget.amountCents) : '');
  let maxRaw = $state(budget?.maxCents != null ? plain(budget.maxCents) : '');
  let startRaw = $state(editing ? plain(editing.startBalanceCents) : '');
  let confirmDelete = $state(false);
  let busy = $state(false);

  const amountCents = $derived(parseAmount(amountRaw));
  const maxCents = $derived(maxRaw.trim() === '' ? null : parseAmount(maxRaw));
  const startCents = $derived(startRaw.trim() === '' ? 0 : parseAmount(startRaw));
  const canSave = $derived(
    name.trim().length > 0 &&
      amountCents !== null &&
      (maxRaw.trim() === '' || maxCents !== null) &&
      startCents !== null &&
      !busy,
  );

  async function save() {
    if (!canSave || amountCents === null) return;
    busy = true;
    await store.saveEnvelope({
      id: editing?.id,
      name: name.trim(),
      type,
      memo: memo.trim(),
      amountCents,
      maxCents: type === 'pot' ? maxCents : null,
      startBalanceCents: type === 'pot' ? (startCents ?? 0) : 0,
    });
    // Une cagnotte est alimentée par l'ordre permanent : son montant change ce qu'il faut virer.
    if (type === 'pot') {
      const total = standingOrderPlan(store.data!, store.currentMonth).totalCents;
      toast.show(`Pense à modifier ton ordre permanent : ${formatShort(total)} CHF par mois.`, 6000);
    } else {
      toast.show(editing ? 'Enveloppe modifiée' : 'Enveloppe créée');
    }
    onclose();
  }

  async function remove() {
    if (!editing) return;
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }
    busy = true;
    const result = await store.removeEnvelope(editing.id);
    toast.show(result === 'deleted' ? 'Enveloppe supprimée' : 'Enveloppe archivée : son historique est conservé');
    onclose();
  }

  onMount(() => {
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = '');
  });
</script>

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={onclose} role="presentation"></div>

<div class="sheet" role="dialog" aria-modal="true" transition:fly={{ y: 400, duration: 220 }}>
  <div class="grip"></div>
  <div class="head">
    <button class="link" onclick={onclose}>Annuler</button>
    <span class="title">{editing ? 'Modifier' : 'Nouvelle enveloppe'}</span>
    <span></span>
  </div>

  <label class="field">
    Nom
    <input type="text" maxlength="24" bind:value={name} placeholder="Social" />
  </label>

  <div class="field">
    Type
    <div class="types">
      <button class:selected={type === 'monthly'} onclick={() => (type = 'monthly')}>Mensuelle</button>
      <button class:selected={type === 'pot'} onclick={() => (type = 'pot')}>Cagnotte</button>
    </div>
  </div>

  <p class="hint">
    {type === 'monthly'
      ? 'Repart à son plafond chaque mois. L’argent reste sur le compte courant.'
      : 'Accumule son montant chaque mois. L’argent va sur le compte épargne via l’ordre permanent.'}
  </p>

  <label class="field">
    {type === 'monthly' ? 'Plafond par mois' : 'Montant par mois'}
    <input type="text" inputmode="decimal" bind:value={amountRaw} placeholder="100" />
  </label>

  {#if type === 'pot'}
    <label class="field">
      Maximum (optionnel)
      <input type="text" inputmode="decimal" bind:value={maxRaw} placeholder="470" />
    </label>
    {#if !editing}
      <label class="field">
        Déjà de côté
        <input type="text" inputmode="decimal" bind:value={startRaw} placeholder="0" />
      </label>
    {/if}
  {/if}

  <label class="field">
    Mémo (optionnel)
    <input type="text" maxlength="60" bind:value={memo} placeholder="Avec les potes" />
  </label>

  <div class="actions">
    {#if editing}
      <button class="delete" class:armed={confirmDelete} disabled={busy} onclick={remove}>
        {confirmDelete ? 'Confirmer' : 'Supprimer'}
      </button>
    {/if}
    <button class="save" disabled={!canSave} onclick={save}>Enregistrer</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 20;
  }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 560px;
    max-height: 100dvh;
    overflow-y: auto;
    margin: 0 auto;
    padding: 8px 16px calc(env(safe-area-inset-bottom) + 16px);
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    z-index: 21;
  }

  .grip {
    width: 36px;
    height: 5px;
    margin: 0 auto 4px;
    border-radius: 3px;
    background: var(--line);
  }

  .head {
    display: flex;
    align-items: center;
    min-height: 40px;
    margin-bottom: 8px;
  }

  .head > * {
    flex: 1;
  }

  .title {
    text-align: center;
    font-weight: 600;
  }

  .link {
    text-align: left;
    color: var(--accent);
    padding: 8px 0;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 15px;
    color: var(--muted);
  }

  .field input {
    width: 55%;
    padding: 10px 12px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 16px;
    text-align: right;
  }

  .types {
    display: flex;
    gap: 6px;
  }

  .types button {
    padding: 9px 14px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 15px;
  }

  .types button.selected {
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .hint {
    margin: 0 0 14px;
    font-size: 13px;
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .save,
  .delete {
    height: 54px;
    border-radius: 14px;
    font-size: 17px;
    font-weight: 600;
  }

  .save {
    flex: 1;
    background: var(--accent);
    color: var(--accent-text);
  }

  .delete {
    padding: 0 18px;
    color: var(--danger);
    background: var(--surface-2);
  }

  .delete.armed {
    background: var(--danger);
    color: #fff;
  }
</style>
