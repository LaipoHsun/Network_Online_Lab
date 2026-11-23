<script lang="ts">
  // 第 7 章場景：四種眼鏡（docs/chapters/07-centrality.md ③ 場景 A）。
  // 同一張網路，切換四種中心性，小人的大小跟著變；每種配一個「東西怎麼流動」的動畫：
  // 度 = 從他身上冒出的對話；接近 = 從他發出的漣漪；介數 = 信件穿過他；特徵向量 = 反覆轉傳時熱度累積。
  import { onMount, untrack } from 'svelte';
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
  import { bfsLayers, shortestPath } from '../../../lib/network';
  import { renderCharacter } from '../../../lib/sprites/character';
  import { seededRandom } from '../../../lib/sim/random';
  import { emitLive } from '../../../lib/ui/bus';
  import { loadPrediction, onPrediction } from '../../../lib/ui/storage';
  import { prefersReducedMotion } from '../../../lib/ui/theme';
  import { centralities, CIRCLES, makeNetwork, makePeople, MEASURES, rankOf, topOf, type Measure } from './model';

  interface Props { predictId?: string }
  let { predictId }: Props = $props();

  const people = makePeople();
  const g = makeNetwork();
  const cent = centralities(g);
  const sprites = people.map((p) => renderCharacter(p.look, 'idle', { size: 36, title: `${p.name}（${p.role}）` }));
  const W = 640, H = 480;

  type Node = SimulationNodeDatum & { i: number };
  const pos = (() => {
    const nodes: Node[] = people.map((p, i) => ({ i, x: W / 2 + 160 * Math.cos((p.circle * Math.PI) / 2 + i), y: H / 2 + 140 * Math.sin((p.circle * Math.PI) / 2 + i) }));
    const links: { source: number; target: number }[] = [];
    g.adj.forEach((nb, a) => nb.forEach((b) => { if (a < b) links.push({ source: a, target: b }); }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink<Node, { source: number; target: number }>(links).id((d) => d.i).distance(48).strength(0.35))
      .force('charge', forceManyBody<Node>().strength(-200))
      .force('x', forceX<Node>(W / 2).strength(0.05)).force('y', forceY<Node>(H / 2).strength(0.07))
      .force('collide', forceCollide<Node>(22)).stop();
    sim.tick(400);
    return nodes.map((d) => ({ x: Math.max(28, Math.min(W - 28, d.x!)), y: Math.max(34, Math.min(H - 24, d.y!)) }));
  })();
  const edges: [number, number][] = [];
  g.adj.forEach((nb, a) => nb.forEach((b) => { if (a < b) edges.push([a, b]); }));

  let measure = $state<Measure>('degree');
  let selected = $state<number | null>(null);
  let guess = $state<number | null>(null);
  let t = $state(0);
  let raf = 0;
  const reduced = typeof window !== 'undefined' && prefersReducedMotion();

  const vals = $derived(cent[measure]);
  const top = $derived(topOf(vals));
  const vmax = $derived(Math.max(...vals));
  const size = (i: number) => 26 + 36 * (vmax > 0 ? vals[i] / vmax : 0);

  // 介數動畫用：30 對隨機配對的最短路徑
  const pairs = (() => {
    const rng = seededRandom(77);
    const out: number[][] = [];
    while (out.length < 30) {
      const a = Math.floor(rng() * people.length), b = Math.floor(rng() * people.length);
      const p = a !== b ? shortestPath(g, a, b) : null;
      if (p && p.length > 3) out.push(p);
    }
    return out;
  })();
  // 特徵向量動畫用：從均勻開始的冪次迭代
  const power = (() => {
    const steps: number[][] = [];
    let x = people.map(() => 1);
    for (let s = 0; s < 14; s++) {
      steps.push(x);
      const y = x.map((xi, i) => xi + g.adj[i].reduce((acc, j) => acc + x[j], 0));
      const m = Math.max(...y);
      x = y.map((v) => v / m);
    }
    return steps;
  })();
  const layers = $derived(bfsLayers(g, top));

  onMount(() => {
    if (predictId) {
      const a = loadPrediction(predictId);
      if (a?.kind === 'node') guess = a.node;
    }
    const off = predictId ? onPrediction(predictId, (a) => { guess = a?.kind === 'node' ? a.node : null; }) : () => {};
    if (!reduced) {
      const t0 = performance.now();
      const loop = (now: number) => { t = (now - t0) / 1000; raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
    return () => { off(); cancelAnimationFrame(raf); };
  });

  // 公式卡（第 ④ 段）：目前選到的人（沒選就看這副眼鏡的第一名）的四種中心性
  $effect(() => {
    const i = selected ?? top;
    const v = { CB: cent.betweenness[i], CC: cent.closeness[i], x: cent.eigenvector[i], k: g.adj[i].length };
    untrack(() => emitLive(v, 'ch7'));
  });

  // ---- 每種眼鏡的流動畫面（reduced motion 時顯示靜態的最終狀態）
  const phase = $derived(reduced ? 0.999 : (t % 4) / 4);
  const ripple = $derived(reduced ? layers.length : phase * (layers.length + 1));
  const heat = $derived(power[Math.min(power.length - 1, Math.floor((reduced ? 0.999 : (t % 7) / 7) * power.length))]);
  function along(p: number[], f: number) {
    const s = f * (p.length - 1), k = Math.min(p.length - 2, Math.floor(s)), r = s - k;
    return { x: pos[p[k]].x + (pos[p[k + 1]].x - pos[p[k]].x) * r, y: pos[p[k]].y + (pos[p[k + 1]].y - pos[p[k]].y) * r };
  }
  const dist = $derived.by(() => { const d = new Array(people.length).fill(-1); layers.forEach((l, k) => l.forEach((v) => (d[v] = k))); return d; });
  const info = $derived(MEASURES.find((m) => m.key === measure)!);
  const fmt = (v: number) => v.toFixed(2);
</script>

<div class="lenses">
  <div class="stage">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="40 位同學的網路，用「{info.label}中心性」看，最高的是{people[top].name}（{people[top].role}）。">
      {#each edges as [a, b]}
        <line x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} class="edge"
          class:hot={measure === 'degree' && (a === top || b === top)} />
      {/each}

      {#if measure === 'closeness'}
        {#each pos as q, i}
          {#if dist[i] >= 0 && dist[i] <= ripple}<circle cx={q.x} cy={q.y} r={size(i) / 2 + 8} class="reach" />{/if}
        {/each}
      {:else if measure === 'betweenness' && !reduced}
        {#each pairs as p, k}
          {@const f = ((t * 0.35 + k / pairs.length) % 1)}
          {@const q = along(p, f)}
          <rect x={q.x - 5} y={q.y - 4} width="10" height="8" rx="1.5" class="letter" />
        {/each}
      {:else if measure === 'eigenvector'}
        {#each pos as q, i}
          <circle cx={q.x} cy={q.y} r={10 + 26 * heat[i]} class="heat" style:opacity={0.15 + 0.6 * heat[i]} />
        {/each}
      {:else if measure === 'degree' && !reduced}
        {#each g.adj[top] as j, k}
          {@const f = ((t * 0.6 + k / g.adj[top].length) % 1)}
          <circle cx={pos[top].x + (pos[j].x - pos[top].x) * f} cy={pos[top].y + (pos[j].y - pos[top].y) * f} r="4" class="chat" />
        {/each}
      {/if}

      {#each pos as q, i}
        <g transform="translate({q.x - size(i) / 3} {q.y - size(i) * 0.6})" class="person" class:top={i === top} class:sel={i === selected} class:guess={i === guess}
          role="button" tabindex="-1" aria-label={people[i].name} onclick={() => (selected = selected === i ? null : i)} onkeydown={(e) => { if (e.key === 'Enter') selected = i; }}>
          <rect x="-4" y="-3" width={(size(i) * 2) / 3 + 8} height={size(i) + 6} rx="8" class="halo" />
          <svg width={(size(i) * 2) / 3} height={size(i)} viewBox="0 0 24 36">{@html sprites[i]}</svg>
        </g>
      {/each}
      {#each [0, 1, 2, 3] as c}
        {@const ms = people.map((p, i) => (p.circle === c ? i : -1)).filter((i) => i >= 0)}
        {@const cx = ms.reduce((s, i) => s + pos[i].x, 0) / ms.length}
        {@const cy = Math.min(...ms.map((i) => pos[i].y)) - 26}
        <text x={cx} y={Math.max(14, cy)} text-anchor="middle" class="circle-l">{CIRCLES[c]}</text>
      {/each}
    </svg>
  </div>

  <div class="panel">
    <div class="row" role="radiogroup" aria-label="中心性">
      {#each MEASURES as m}
        <button type="button" role="radio" aria-checked={measure === m.key} onclick={() => (measure = m.key)}>{m.label}</button>
      {/each}
    </div>
    <p class="flow">{info.flow}</p>
    <p class="big" aria-live="polite">第一名：<b>{people[top].name}</b>（{people[top].role}）</p>
    <table>
      <thead><tr><th></th>{#each MEASURES as m}<th>{m.label}</th>{/each}</tr></thead>
      <tbody>
        {#each [{ i: top, who: '這副眼鏡的第一名' }, ...(guess !== null ? [{ i: guess, who: '你在第 ② 段選的人' }] : []), ...(selected !== null ? [{ i: selected, who: '你點的人' }] : [])] as r}
          <tr><td>{r.who}<br /><span class="nm">{people[r.i].name}・{people[r.i].role}</span></td>
            {#each MEASURES as m}<td class="num">第 {rankOf(cent[m.key], r.i)}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
    <p class="note">小人越大，在這副眼鏡下越重要。點任何一位小人，看他在四種眼鏡下各排第幾（共 {people.length} 人）。{guess !== null ? '橘色框是你在第 ② 段選的人。' : ''}</p>
  </div>
</div>

<style>
  .lenses { display: flex; flex-direction: column; gap: var(--space-2); }
  @media (min-width: 960px) { .lenses { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr); align-items: start; gap: var(--space-4); } }
  .stage { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
  svg { display: block; width: 100%; height: auto; }
  .edge { stroke: var(--line); stroke-width: 1.5; }
  .edge.hot { stroke: var(--accent); stroke-width: 2.5; }
  .reach { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1; }
  .letter { fill: var(--panel); stroke: var(--signal); stroke-width: 1.5; }
  .heat { fill: var(--signal); }
  .chat { fill: var(--accent); }
  .person { cursor: pointer; }
  .halo { fill: transparent; stroke: none; }
  .person.top .halo { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
  .person.guess .halo { stroke: var(--signal); stroke-width: 2.5; fill: var(--signal-soft); }
  .person.sel .halo { stroke: var(--ink); stroke-width: 2.5; }
  .circle-l { font-size: 13px; fill: var(--muted); }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: 6px; }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .flow { margin: 0; font-size: 14px; color: var(--muted); }
  .big { margin: 0; font-size: 16px; }
  table { border-collapse: collapse; font-size: 13px; width: 100%; }
  th { font-weight: 500; color: var(--muted); text-align: center; padding: 2px 4px; }
  td { border-top: 1px solid var(--line); padding: 4px; text-align: center; }
  td:first-child { text-align: left; font-size: 12px; color: var(--muted); }
  .nm { color: var(--ink); font-size: 13px; }
  .num { font-family: var(--font-mono); }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
</style>
