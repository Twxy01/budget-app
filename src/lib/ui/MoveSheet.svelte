<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { formatCHF, parseAmount } from '../domain/money';
  import { store } from '../store.svelte';
  import { toast } from '../toast.svelte';
  import AmountDisplay from './AmountDisplay.svelte';
  import Keypad from './Keypad.svelte';
  import { keyFromEvent, pressKey } from './amountInput';

  let { type, onclose }: { type: 'deposit' | 'withdrawal'; onclose: () => void } = $props();

  let raw = $state('');
  let note = $state('');
  let busy = $state(false);
  /** D'où vient l'argent ajouté : de mon compte courant, ou de l'extérieur. */
  let from = $state<'current' | 'outside'>('current');

  const amountCents = $derived(parseAmount(raw));
  const canSave = $derived(!!amountCents && !busy);
  const isDeposit = $derived(type === 'deposit');
  const moveType = $derived(
    type === 'withdrawal' ? 'withdrawal' : from === 'current' ? 'transfer' : 'deposit',
  );

  function onkeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'Escape') return onclose();
    if (event.key === 'Enter') return void save();
    const key = keyFromEvent(event.key);
    if (key) raw = pressKey(raw, key);
  }

  async function save() {
    if (!canSave || !amountCents) return;
    busy = true;
    await store.addMove({
      date: store.today,
      type: moveType,
      account: 'savings',
      amountCents,
      note: note.trim(),
    });
    toast.show(
      isDeposit
        ? `${formatCHF(amountCents)} ajoutés à l'épargne`
        : `${formatCHF(amountCents)} retirés de l'épargne`,
    );
    onclose();
  }

  onMount(() => {
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = '');
  });
</script>

<svelte:window {onkeydown} />

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={onclose} role="presentation"></div>

<div class="sheet" role="dialog" aria-modal="true" transition:fly={{ y: 400, duration: 220 }}>
  <div class="grip"></div>

  <div class="head">
    <button class="link" onclick={onclose}>Annuler</button>
    <span class="title">{isDeposit ? 'Ajout à l’épargne' : 'Retrait d’épargne'}</span>
    <span></span>
  </div>

  {#if isDeposit}
    <div class="from">
      <button class:selected={from === 'current'} onclick={() => (from = 'current')}>De mon courant</button>
      <button class:selected={from === 'outside'} onclick={() => (from = 'outside')}>De l'extérieur</button>
    </div>
    <p class="hint">
      {from === 'current'
        ? 'Virement de ton compte courant vers ton épargne : arrondis de carte, coup de pouce du mois…'
        : 'Argent arrivé directement sur l’épargne, sans passer par le courant : 13e salaire, cadeau…'}
    </p>
  {:else}
    <p class="hint">Argent que tu as repris sur ton compte épargne et qui revient sur ton compte courant.</p>
  {/if}

  <AmountDisplay value={raw} />

  <input class="note" type="text" placeholder="Note (optionnel)" maxlength="60" bind:value={note} enterkeyhint="done" />

  <Keypad bind:value={raw} />

  <button class="save" disabled={!canSave} onclick={save}>
    {isDeposit ? 'J’ai ajouté ce montant' : 'J’ai retiré ce montant'}
  </button>
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

  .from {
    display: flex;
    gap: 6px;
    justify-content: center;
    margin-top: 8px;
  }

  .from button {
    padding: 9px 14px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 15px;
  }

  .from button.selected {
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }

  .note {
    width: 100%;
    padding: 10px 12px;
    margin-bottom: 10px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 16px;
  }

  .save {
    width: 100%;
    height: 54px;
    margin-top: 10px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 17px;
    font-weight: 600;
  }
</style>
