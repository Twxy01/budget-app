<script lang="ts" module>
  import type { Expense } from '../domain/types';

  /** Nouvelle dépense (éventuellement avec une enveloppe présélectionnée) ou modification. */
  export type SheetRequest = { envelopeId?: string; expense?: Expense };
</script>

<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { dayLabel, lastDayOf, monthOf } from '../domain/dates';
  import { isActive } from '../domain/engine';
  import { formatCents, formatCHF, parseAmount } from '../domain/money';
  import { store } from '../store.svelte';
  import { toast } from '../toast.svelte';
  import AmountDisplay from './AmountDisplay.svelte';
  import Keypad from './Keypad.svelte';
  import { keyFromEvent, pressKey } from './amountInput';

  let { request, onclose }: { request: SheetRequest; onclose: () => void } = $props();

  // Valeurs initiales figées à l'ouverture : la feuille est recréée à chaque demande.
  const { expense: editing, envelopeId: preselected } = untrack(() => request);
  const data = store.data!;
  const defaultDate = store.month === store.currentMonth ? store.today : lastDayOf(store.month);

  let raw = $state(editing ? formatCents(editing.amountCents).replace(/'/g, '') : '');
  let envelopeId = $state<string | null>(editing?.envelopeId ?? preselected ?? null);
  let note = $state(editing?.note ?? '');
  let date = $state(editing?.date ?? defaultDate);
  let confirmDelete = $state(false);
  let busy = $state(false);

  const amountCents = $derived(parseAmount(raw));
  // La note est obligatoire : sans elle, l'historique devient illisible au bout de quelques mois.
  const canSave = $derived(!!amountCents && !!envelopeId && note.trim().length > 0 && !busy);

  // Enveloppes existantes à la date choisie : mensuelles d'abord, puis cagnottes.
  const envelopes = $derived(
    data.envelopes
      .filter((e) => e.id === envelopeId || isActive(data, e, monthOf(date)))
      .sort((a, b) => (a.type === b.type ? a.order - b.order : a.type === 'monthly' ? -1 : 1)),
  );

  function onkeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'Escape') return onclose();
    if (event.key === 'Enter') return void save();
    const key = keyFromEvent(event.key);
    if (key) raw = pressKey(raw, key);
  }

  async function save() {
    if (!canSave || !amountCents || !envelopeId) return;
    busy = true;
    const input = { envelopeId, amountCents, note: note.trim(), date };
    if (editing) await store.updateExpense(editing.id, input);
    else await store.addExpense(input);

    const envelope = data.envelopes.find((e) => e.id === envelopeId)!;
    if (!editing && envelope.type === 'pot') {
      toast.show(`Pense à virer ${formatCHF(amountCents)} de l'épargne vers le courant.`, 6000);
    } else {
      toast.show(editing ? 'Dépense modifiée' : `${formatCHF(amountCents)} · ${envelope.name}`);
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
    await store.deleteExpense(editing.id);
    toast.show('Dépense supprimée');
    onclose();
  }

  onMount(() => {
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = '');
  });
</script>

<svelte:window {onkeydown} />

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={onclose} role="presentation"></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={editing ? 'Modifier la dépense' : 'Nouvelle dépense'} transition:fly={{ y: 400, duration: 220 }}>
  <div class="grip"></div>

  <div class="head">
    <button class="link" onclick={onclose}>Annuler</button>
    <span class="title">{editing ? 'Modifier' : 'Nouvelle dépense'}</span>
    <span class="spacer"></span>
  </div>

  <AmountDisplay value={raw} />

  <div class="chips" role="radiogroup" aria-label="Enveloppe">
    {#each envelopes as envelope (envelope.id)}
      <button
        class="chip"
        class:pot={envelope.type === 'pot'}
        class:selected={envelope.id === envelopeId}
        role="radio"
        aria-checked={envelope.id === envelopeId}
        onclick={() => (envelopeId = envelope.id)}
      >
        {envelope.name}
      </button>
    {/each}
  </div>

  <div class="meta">
    <input class="note" type="text" placeholder="C'était quoi ?" maxlength="60" bind:value={note} enterkeyhint="done" required />
    <label class="date">
      {dayLabel(date, store.today)}
      <input type="date" max={store.today} bind:value={date} aria-label="Date" onchange={() => (date ||= defaultDate)} />
    </label>
  </div>

  <Keypad bind:value={raw} />

  <div class="actions">
    {#if editing}
      <button class="delete" class:armed={confirmDelete} disabled={busy} onclick={remove}>
        {confirmDelete ? 'Confirmer' : 'Supprimer'}
      </button>
    {/if}
    <button class="save" disabled={!canSave} onclick={save}>
      {editing ? 'Enregistrer' : 'Ajouter'}
    </button>
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .chip {
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 15px;
    border: 1.5px solid transparent;
  }

  .chip.pot {
    border-style: dashed;
    border-color: var(--pot);
  }

  .chip.selected {
    background: var(--accent);
    color: var(--accent-text);
    border-color: var(--accent);
    font-weight: 600;
  }

  .meta {
    display: flex;
    gap: 8px;
    margin: 14px 0 10px;
  }

  .note {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 16px; /* 16px minimum : sinon Safari zoome sur le champ */
  }

  .date {
    position: relative;
    display: grid;
    place-items: center;
    padding: 0 14px;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 15px;
    white-space: nowrap;
  }

  /* Le vrai sélecteur de date, invisible, posé sur l'étiquette. */
  .date input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    font-size: 16px;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
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
