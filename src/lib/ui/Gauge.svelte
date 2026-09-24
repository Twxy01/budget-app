<script lang="ts">
  /** Jauge de ce qui reste : pleine au début du mois, elle se vide au fil des dépenses. */
  let { ratio, tone }: { ratio: number; tone: 'ok' | 'warn' | 'danger' | 'pot' } = $props();

  const width = $derived(tone === 'danger' ? 100 : Math.max(0, Math.min(1, ratio)) * 100);
</script>

<div class="track" role="presentation">
  <div class="fill {tone}" style:width="{width}%"></div>
</div>

<style>
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--track);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.35s ease;
  }

  .ok {
    background: var(--ok);
  }

  .warn {
    background: var(--warn);
  }

  .danger {
    background: var(--danger);
  }

  .pot {
    background: var(--pot);
  }
</style>
