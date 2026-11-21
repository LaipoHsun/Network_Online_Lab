<script lang="ts">
  // 深淺主題切換（設定 <html data-theme>）；預設跟隨系統。
  import { onMount } from 'svelte';
  import { load, save } from '../../lib/ui/storage';
  type Mode = 'system' | 'light' | 'dark';
  let mode = $state<Mode>('system');
  const LABEL: Record<Mode, string> = { system: '跟隨系統', light: '淺色', dark: '深色' };
  function apply(m: Mode) {
    mode = m;
    if (m === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', m);
    save('theme', m);
  }
  onMount(() => apply(load<Mode>('theme', 'system')));
</script>

<div class="theme" role="radiogroup" aria-label="主題">
  {#each ['system', 'light', 'dark'] as const as m}
    <button type="button" role="radio" aria-checked={mode === m} onclick={() => apply(m)}>{LABEL[m]}</button>
  {/each}
</div>

<style>
  .theme { display: inline-flex; gap: 2px; }
  button { font: inherit; font-size: 13px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 2px 10px; min-height: 30px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
</style>
