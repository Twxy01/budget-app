<script lang="ts">
  import { KEYS, pressKey } from './amountInput';

  let { value = $bindable() }: { value: string } = $props();
</script>

<div class="keypad">
  {#each KEYS as key (key)}
    <button
      class="key"
      class:erase={key === '⌫'}
      aria-label={key === '⌫' ? 'Effacer' : key}
      onclick={() => (value = pressKey(value, key))}
    >
      {key}
    </button>
  {/each}
</div>

<style>
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .key {
    height: 52px;
    border-radius: 12px;
    font-size: 24px;
    font-variant-numeric: tabular-nums;
  }

  .key:active {
    background: var(--surface-2);
  }

  .erase {
    font-size: 20px;
  }
</style>
