<script lang="ts">
  // 公式卡（docs/design.md 共用元件 5）：公式、每個符號一行說明、範圍與極端、和誰有關。
  // 滑過（或鍵盤聚焦）一個符號 → 發出 highlight 事件，視覺區高亮對應元素；
  // 即時數值由視覺區的 live 事件提供。
  import { onMount } from 'svelte';
  import { emitHighlight, onHighlight, onLive } from '../../lib/ui/bus';

  export interface SymbolRow { key: string; symbolHtml: string; meaningHtml: string }
  export interface LiveRow { key: string; labelHtml: string; digits?: number }

  interface Props {
    title?: string;
    formulaHtml: string;
    symbols: SymbolRow[];
    rangeHtml?: string;
    relatedHtml?: string;
    live?: LiveRow[];
    /** 展示用：固定的即時數值（沒有視覺區時） */
    initialValues?: Record<string, number>;
  }
  let { title = '公式卡', formulaHtml, symbols, rangeHtml, relatedHtml, live = [], initialValues = {} }: Props = $props();

  let active = $state<string | null>(null);
  let values = $state<Record<string, number>>({ ...initialValues });
  let formulaEl: HTMLDivElement;

  function set(key: string | null) {
    if (active === key) return;
    active = key;
    emitHighlight(key, title);
  }

  $effect(() => {
    // 公式裡的 \htmlData{key=…} 跟著高亮
    formulaEl?.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => el.classList.toggle('on', el.dataset.key === active));
  });

  onMount(() => {
    const offLive = onLive(({ values: v }) => { values = { ...values, ...v }; });
    const offHi = onHighlight(({ key, source }) => { if (source !== title) active = key; });
    const over = (e: Event) => { const k = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key; if (k) set(k); };
    formulaEl.addEventListener('pointerover', over);
    return () => { offLive(); offHi(); formulaEl.removeEventListener('pointerover', over); };
  });

  const fmt = (v: number | undefined, digits = 2) =>
    v === undefined || Number.isNaN(v) ? '—' : Number.isInteger(v) && digits === 0 ? v.toLocaleString('zh-TW') : v.toFixed(digits);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="card" aria-label={title} onpointerleave={() => set(null)}>
  <div class="formula" bind:this={formulaEl}>{@html formulaHtml}</div>

  {#if live.length}
    <dl class="live" aria-live="off">
      {#each live as row}
        <div class="lv" class:on={active === row.key}>
          <dt>{@html row.labelHtml}</dt>
          <dd class="num">{fmt(values[row.key], row.digits)}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  <h3>每個符號</h3>
  <ul class="symbols">
    {#each symbols as s}
      <li>
        <button type="button" class:on={active === s.key} aria-pressed={active === s.key}
          onpointerenter={() => set(s.key)} onfocus={() => set(s.key)} onblur={() => set(null)}
          onclick={() => set(active === s.key ? null : s.key)}>
          <span class="sym">{@html s.symbolHtml}</span>
          <span class="meaning">{@html s.meaningHtml}</span>
        </button>
      </li>
    {/each}
  </ul>

  {#if rangeHtml}<h3>範圍與極端</h3><div class="text">{@html rangeHtml}</div>{/if}
  {#if relatedHtml}<h3>和誰有關</h3><div class="text">{@html relatedHtml}</div>{/if}
</section>

<style>
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); }
  .formula { font-size: 15px; overflow-x: auto; overflow-y: hidden; padding: var(--space-2) 0; }
  .formula :global([data-key]) { border-radius: 4px; transition: background 150ms; cursor: help; }
  .formula :global([data-key].on) { background: var(--signal-soft); box-shadow: 0 0 0 2px var(--signal-soft); }
  .live { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: var(--space-2) 0; padding: var(--space-2) var(--space-3); background: var(--accent-soft); border-radius: 8px; }
  .lv { display: flex; gap: var(--space-2); align-items: baseline; }
  .lv.on { outline: 2px solid var(--signal); outline-offset: 2px; border-radius: 4px; }
  .lv dt { font-size: 15px; }
  .lv dd { margin: 0; font-size: 15px; }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  h3 { font-size: 14px; margin: var(--space-4) 0 var(--space-2); color: var(--muted); font-family: var(--font-body); font-weight: 500; }
  .symbols { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .symbols button { width: 100%; display: grid; grid-template-columns: 5.5em 1fr; gap: var(--space-3); align-items: baseline; text-align: left; font: inherit; font-size: 15px; color: var(--ink); background: none; border: 0; border-radius: 6px; padding: 4px var(--space-2); cursor: pointer; }
  .symbols button.on { background: var(--signal-soft); }
  .meaning :global(p), .text :global(p) { margin: 0; }
  .text { font-size: 15px; }
</style>
