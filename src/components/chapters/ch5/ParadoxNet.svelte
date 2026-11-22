<script lang="ts">
  // 第 5 章場景 A：每個小人頭上兩個數字「我的朋友數 / 我朋友的平均朋友數」，前者較小的人變藍色。
  // mode="intro" 只顯示網路（第 ① 段）；mode="paradox" 加上「社交性差異」與統計。
  import { untrack } from 'svelte';
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
  import { renderCharacter } from '../../../lib/sprites/character';
  import { emitLive } from '../../../lib/ui/bus';
  import { friendMeans, JIAXUAN, makePeople, N, networkAt, paradoxStats, SPREADS } from './model';

  interface Props { mode?: 'intro' | 'paradox' }
  let { mode = 'paradox' }: Props = $props();

  const people = makePeople();
  const sprites = people.map((p) => renderCharacter(p.look, 'idle', { size: 30, title: `${p.name}（${p.dept}）` }));
  const W = 640, H = 520;
  let spreadIdx = $state(2);
  let picked = $state<number>(JIAXUAN);

  const g = $derived(networkAt(SPREADS[spreadIdx].value));
  const fm = $derived(friendMeans(g));
  const st = $derived(paradoxStats(g));
  const blue = $derived(g.adj.map((a, i) => fm[i] !== null && a.length < fm[i]! - 1e-9));
  const nBlue = $derived(blue.filter(Boolean).length);

  type Node = SimulationNodeDatum & { i: number };
  const layout = $derived.by(() => {
    const nodes: Node[] = people.map((_, i) => ({ i }));
    const links: { source: number; target: number }[] = [];
    g.adj.forEach((nb, a) => nb.forEach((b) => { if (a < b) links.push({ source: a, target: b }); }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink<Node, { source: number; target: number }>(links).id((d) => d.i).distance(62).strength(0.3))
      .force('charge', forceManyBody<Node>().strength(-320))
      .force('x', forceX<Node>(W / 2).strength(0.05))
      .force('y', forceY<Node>(H / 2).strength(0.07))
      .force('collide', forceCollide<Node>(30))
      .stop();
    sim.tick(300);
    return nodes.map((d) => ({ x: Math.max(24, Math.min(W - 24, d.x ?? 0)), y: Math.max(40, Math.min(H - 20, d.y ?? 0)) }));
  });

  $effect(() => {
    const live = { kbar: st.mean, kf: st.friendMean, var: st.variance, extra: st.variance / st.mean, share: st.share * 100 };
    if (mode === 'paradox') untrack(() => emitLive(live, 'ch5'));
  });

  const fmt = (v: number | null) => (v === null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1));
</script>

<div class="paradox" class:wide={mode === 'paradox'}>
  <svg viewBox="0 0 {W} {H}" role="img"
    aria-label="{N} 位同學的朋友網路。{mode === 'paradox' ? `${nBlue} 人的朋友數少於自己朋友的平均朋友數。` : ''}">
    {#each g.adj as nb, a}
      {#each nb as b}
        {#if a < b}<line x1={layout[a].x} y1={layout[a].y} x2={layout[b].x} y2={layout[b].y} class="edge" class:hl={a === picked || b === picked} />{/if}
      {/each}
    {/each}
    {#each layout as q, i}
      <g class="node" class:blue={mode === 'paradox' && blue[i]} class:me={i === picked} transform="translate({q.x} {q.y})"
        role="button" tabindex="-1" aria-label="{people[i].name}" onclick={() => (picked = i)} onkeydown={(e) => { if (e.key === 'Enter') picked = i; }}>
        <circle r="17" class="halo" />
        <g transform="translate(-15 -20)">{@html sprites[i]}</g>
        {#if mode === 'paradox'}
          <text y="-24" text-anchor="middle" class="nums">{g.adj[i].length}/{fmt(fm[i])}</text>
        {/if}
      </g>
    {/each}
  </svg>

  {#if mode === 'paradox'}
    <div class="panel">
      <div class="row" role="radiogroup" aria-label="社交性差異">
        <span class="lbl">社交性差異：</span>
        {#each SPREADS as s, i}
          <button type="button" role="radio" aria-checked={spreadIdx === i} onclick={() => (spreadIdx = i)}>{s.label}</button>
        {/each}
      </div>
      <p class="big"><b>{nBlue}</b> / {N} 人（{Math.round(st.share * 100)}%）的朋友比自己受歡迎</p>
      <dl class="stats">
        <div><dt>全體的平均朋友數 ⟨k⟩</dt><dd>{st.mean.toFixed(2)}</dd></div>
        <div><dt>「朋友」的平均朋友數 ⟨k²⟩/⟨k⟩</dt><dd>{st.friendMean.toFixed(2)}</dd></div>
        <div><dt>朋友數的變異數 σ²</dt><dd>{st.variance.toFixed(2)}</dd></div>
      </dl>
      <p class="now" aria-live="polite">
        <strong>{people[picked].name}</strong>有 {g.adj[picked].length} 位朋友，朋友們平均有 {fmt(fm[picked])} 位朋友{blue[picked] ? '：朋友比較受歡迎。' : '。'}
      </p>
      <p class="note">每個人頭上是「我的朋友數 / 我朋友的平均朋友數」。前者比較小的人是藍色。點任何一位小人看細節；一開始選的是家瑄。</p>
    </div>
  {/if}
</div>

<style>
  .paradox { display: flex; flex-direction: column; gap: var(--space-2); }
  @media (min-width: 960px) {
    .paradox.wide { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); align-items: start; gap: var(--space-4); }
  }
  svg { display: block; width: 100%; height: auto; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
  .edge { stroke: var(--line); stroke-width: 1.5; }
  .edge.hl { stroke: var(--signal); stroke-width: 2.5; }
  .node { cursor: pointer; }
  .halo { fill: var(--panel); stroke: var(--line); stroke-width: 1; }
  .node.blue .halo { fill: color-mix(in srgb, var(--college-sci) 35%, var(--panel)); stroke: var(--college-sci); stroke-width: 2; }
  .node.me .halo { stroke: var(--signal); stroke-width: 3; }
  .nums { font-family: var(--font-mono); font-size: 11px; fill: var(--ink); paint-order: stroke; stroke: var(--panel); stroke-width: 3px; }
  .node.blue .nums { fill: var(--college-sci); font-weight: 600; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .lbl { font-size: 14px; color: var(--muted); }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .big { margin: 0; font-size: 16px; }
  .big b { font-family: var(--font-mono); font-size: 22px; color: var(--college-sci); }
  .stats { margin: 0; display: grid; gap: 2px; font-size: 13px; }
  .stats div { display: flex; justify-content: space-between; gap: var(--space-2); }
  .stats dt { color: var(--muted); }
  .stats dd { margin: 0; font-family: var(--font-mono); }
  .now { margin: 0; font-size: 14px; line-height: 1.7; }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
</style>
