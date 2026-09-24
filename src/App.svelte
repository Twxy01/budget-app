<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from './lib/router.svelte';
  import EnvelopeDetail from './lib/screens/EnvelopeDetail.svelte';
  import Home from './lib/screens/Home.svelte';
  import Onboarding from './lib/screens/Onboarding.svelte';
  import Savings from './lib/screens/Savings.svelte';
  import Settings from './lib/screens/Settings.svelte';
  import { store } from './lib/store.svelte';
  import EnvelopeSheet, { type EnvelopeRequest } from './lib/ui/EnvelopeSheet.svelte';
  import ExpenseSheet, { type SheetRequest } from './lib/ui/ExpenseSheet.svelte';
  import MoveSheet from './lib/ui/MoveSheet.svelte';
  import Toast from './lib/ui/Toast.svelte';

  let sheet = $state<SheetRequest | null>(null);
  let move = $state<'deposit' | 'withdrawal' | null>(null);
  let envelopeSheet = $state<EnvelopeRequest | null>(null);

  onMount(() => {
    store.init();
  });

  // Outils de démonstration : l'import dynamique garde ce code hors de la version publiée.
  const dev = import.meta.env.DEV
    ? {
        async load() {
          await (await import('./lib/demo')).seedDemo();
          await store.reload();
        },
        async reset() {
          await (await import('./lib/demo')).resetAll();
          await store.reload();
        },
      }
    : undefined;
</script>

{#if !store.loaded}
  <!-- chargement : quelques millisecondes -->
{:else if !store.data}
  <Onboarding />
  {#if dev}
    <button class="demo" onclick={dev.load}>Charger des données de démo (dev)</button>
  {/if}
{:else}
  {#if router.route.name === 'settings'}
    <Settings onedit={(envelope) => (envelopeSheet = { envelope })} />
  {:else if router.route.name === 'savings'}
    <Savings onmove={(type) => (move = type)} />
  {:else if router.route.name === 'envelope'}
    {@const id = router.route.id}
    <EnvelopeDetail {id} onedit={(expense) => (sheet = { expense })} />
    <button class="fab" aria-label="Ajouter une dépense" onclick={() => (sheet = { envelopeId: id })}>+</button>
  {:else}
    <Home dev={dev && { reset: dev.reset }} />
    <button class="fab" aria-label="Ajouter une dépense" onclick={() => (sheet = {})}>+</button>
  {/if}

  {#if sheet}
    {#key sheet}
      <ExpenseSheet request={sheet} onclose={() => (sheet = null)} />
    {/key}
  {/if}

  {#if move}
    {#key move}
      <MoveSheet type={move} onclose={() => (move = null)} />
    {/key}
  {/if}

  {#if envelopeSheet}
    {#key envelopeSheet}
      <EnvelopeSheet request={envelopeSheet} onclose={() => (envelopeSheet = null)} />
    {/key}
  {/if}
{/if}

<Toast />

<style>
  .demo {
    display: block;
    margin: 0 auto 40px;
    font-size: 13px;
    color: var(--muted);
    text-decoration: underline;
  }
</style>
