<script lang="ts">
  let { value }: { value: string } = $props();
</script>

<p class="amount num" class:placeholder={!value}>
  {value || '0'}<span class="currency">CHF</span>
</p>

<style>
  .amount {
    margin: 4px 0 12px;
    text-align: center;
    font-size: 48px;
    font-weight: 600;
    line-height: 1.1;
  }

  .placeholder {
    color: var(--muted);
  }

  .currency {
    margin-left: 8px;
    font-size: 18px;
    font-weight: 500;
    color: var(--muted);
  }
</style>
