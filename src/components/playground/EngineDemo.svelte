<script lang="ts">
  // /playground 的引擎展示：示範劇本 + 雙視圖 + 公式卡連動。
  // 章節的場景元件（src/components/chapters/）照這個樣子寫。
  import DualView from '../engine/DualView.svelte';
  import campus from '../../data/campus.json';
  import { demoScript } from './demoScript';
  import type { CampusLayout } from '../../lib/sim/campus';
  import { type Graph, averageDegree, edges, numEdges } from '../../lib/network';

  interface Props { initialCount?: 60 | 200; initialView?: 'campus' | 'network'; active?: string[] | null; showFps?: boolean }
  let { initialCount = 60, initialView = 'campus', active = null, showFps = true }: Props = $props();

  const layouts = campus as unknown as { landscape: CampusLayout; portrait: CampusLayout };
  let count = $state(initialCount);
  let view = $state(initialView);
  const script = $derived(demoScript(count));

  const hub = (g: Graph) => g.adj.reduce((best, a, i) => (a.length > g.adj[best].length ? i : best), 0);
  function highlight(key: string, g: Graph) {
    if (key === 'ki' || key === 'A') { const h = hub(g); return { nodes: [h, ...g.adj[h]], edges: g.adj[h].map((j) => [h, j] as [number, number]) }; }
    if (key === 'L') return { edges: edges(g).map(([a, b]) => [a, b] as [number, number]) };
    if (key === 'N') return { nodes: g.adj.map((_, i) => i) };
    return null;
  }
</script>

<div class="demo">
  <div class="opts" role="radiogroup" aria-label="人數">
    <span>人數</span>
    {#each [60, 200] as c}
      <button type="button" role="radio" aria-checked={count === c} onclick={() => (count = c as 60 | 200)}>{c} 人</button>
    {/each}
    <span class="note">200 人用來測效能（目標：桌機 60 fps、手機 ≥ 30 fps）</span>
  </div>
  {#key count}
    <DualView {script} {layouts} {active} {showFps} bind:view
      label="示範校園（{count} 人）"
      metric={(i, g) => ({ label: '朋友的平均朋友數', value: g.adj[i].length ? (g.adj[i].reduce((s, j) => s + g.adj[j].length, 0) / g.adj[i].length).toFixed(1) : '—' })}
      live={(g) => ({ N: g.n, L: numEdges(g), kavg: averageDegree(g), ki: g.adj[hub(g)].length })}
      {highlight}
      nodeSize={(i, g) => 8 + 2 * Math.sqrt(g.adj[i].length) * 2} />
  {/key}
</div>

<style>
  .demo { display: flex; flex-direction: column; gap: var(--space-2); }
  .opts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-size: 14px; }
  .note { color: var(--muted); font-size: 13px; }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 32px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
</style>
