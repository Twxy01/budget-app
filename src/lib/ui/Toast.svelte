<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toast } from '../toast.svelte';
</script>

{#if toast.message}
  <button class="toast" transition:fly={{ y: 16, duration: 180 }} onclick={() => toast.hide()}>
    {toast.message}
  </button>
{/if}

<style>
  .toast {
    position: fixed;
    left: 16px;
    right: 96px;
    bottom: calc(env(safe-area-inset-bottom) + 32px);
    max-width: 440px;
    margin: 0 auto;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--text);
    color: var(--bg);
    font-size: 15px;
    text-align: left;
    z-index: 30;
  }
</style>
