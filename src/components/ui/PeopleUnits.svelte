<script lang="ts">
  // 第 ⑥ 段「用小人畫出真實資料」（作者決定：揭曉時把數字畫成一個個人，比較好理解）。
  // 資料由 PeopleUnits.astro 從 data/build/<章>/people_*.json 讀進來，每一組都有 source。
  // 捲到位後小人一組一組出現；prefers-reduced-motion 時直接全部顯示。
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '../../lib/ui/theme';

  interface Group { label: string; count: number; tone: string; sprites: string[] }
  interface Row { label: string; groups: Group[] }
  interface Props {
    title: string;
    unit: string;
    rows: Row[];
    note?: string;
    source: { text: string; url?: string; sample?: string; year?: number };
  }
  let { title, unit, rows, note, source }: Props = $props();

  let root: HTMLElement;
  let shown = $state(false);
  onMount(() => {
    if (prefersReducedMotion()) { shown = true; root.classList.add('instant'); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { shown = true; io.disconnect(); } }, { threshold: 0.3 });
    io.observe(root);
    return () => io.disconnect();
  });
  const TONE: Record<string, string> = {
    accent: 'var(--accent)', signal: 'var(--signal)', muted: 'var(--muted)', line: 'var(--line)', sci: 'var(--college-sci)', ill: 'var(--ill)',
  };
</script>

<figure class="people" class:shown bind:this={root} aria-label="{title}。{rows.map((r) => `${r.label}：${r.groups.filter((g) => g.count).map((g) => `${g.label} ${g.count} 個`).join('、')}`).join('；')}">
  <figcaption class="title">{title}</figcaption>
  <p class="unit">{unit}</p>
  {#each rows as r, ri}
    <div class="row">
      {#if rows.length > 1}<p class="row-label">{r.label}</p>{/if}
      <div class="grid" aria-hidden="true">
        {#each r.groups as g, gi}
          {#each g.sprites as sp, k}
            <span class="u" style:--tone={TONE[g.tone] ?? 'var(--muted)'}
              style:transition-delay="{Math.min(1800, (r.groups.slice(0, gi).reduce((s, x) => s + x.count, 0) + k) * 14 + ri * 200)}ms">{@html sp}</span>
          {/each}
        {/each}
      </div>
      <ul class="legend">
        {#each r.groups.filter((g) => g.count > 0) as g}
          <li><span class="sw" style:background={TONE[g.tone] ?? 'var(--muted)'}></span>{g.label}<b class="num">{g.count}</b></li>
        {/each}
      </ul>
    </div>
  {/each}
  {#if note}<p class="note">{note}</p>{/if}
  <p class="source">資料來源：{#if source.url}<a href={source.url} rel="noopener" target="_blank">{source.text}</a>{:else}{source.text}{/if}{source.sample ? `；樣本：${source.sample}` : ''}</p>
</figure>

<style>
  .people { margin: var(--space-4) 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); }
  .title { font-family: var(--font-display); font-weight: 600; font-size: 18px; }
  .unit { margin: 2px 0 var(--space-3); font-size: 13px; color: var(--muted); }
  .row { margin-bottom: var(--space-3); }
  .row-label { margin: 0 0 4px; font-size: 14px; font-weight: 500; }
  .grid { display: flex; flex-wrap: wrap; gap: 2px; }
  .u { width: 26px; height: 30px; border-radius: 8px; background: color-mix(in srgb, var(--tone) 30%, transparent); border-bottom: 3px solid var(--tone);
    display: grid; place-items: center; opacity: 0; transform: translateY(6px); transition: opacity 300ms ease-out, transform 300ms ease-out; }
  .u :global(svg) { width: 22px; height: 26px; }
  .shown .u { opacity: 1; transform: none; }
  :global(.instant) .u { transition: none; }
  .legend { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13px; color: var(--muted); }
  .legend li { display: inline-flex; align-items: center; gap: 6px; }
  .legend b { color: var(--ink); font-family: var(--font-mono); font-weight: 500; }
  .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .note { margin: var(--space-2) 0; font-size: 15px; line-height: 1.7; }
  .source { margin: 0; font-size: 12px; color: var(--muted); }
  @media (max-width: 480px) { .u { width: 20px; height: 24px; } .u :global(svg) { width: 17px; height: 20px; } }
</style>
