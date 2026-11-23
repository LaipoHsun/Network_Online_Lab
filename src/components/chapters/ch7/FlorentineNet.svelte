<script lang="ts">
  // 第 7 章第 ⑥ 段：佛羅倫斯 15 個家族的婚姻網路，每個家族畫成一個人，大小 = 選定的中心性。
  // 讀者先在第 ⑥ 段的預測裡猜「哪個是梅迪奇」（看不到名字），送出後這裡才顯示家族名字。
  import { onMount } from 'svelte';
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
  import { loadPrediction, onPrediction } from '../../../lib/ui/storage';

  interface Net { labels: string[]; edges: [number, number][]; degree: number[]; closeness: number[]; betweenness: number[]; eigenvector: number[] }
  interface Props { net: Net; sprites: string[]; predictId: string; source: { text: string; url?: string } }
  let { net, sprites, predictId, source }: Props = $props();

  const MEASURES = [
    { key: 'betweenness', label: '介數' }, { key: 'degree', label: '度' }, { key: 'closeness', label: '接近' }, { key: 'eigenvector', label: '特徵向量' },
  ] as const;
  type Key = (typeof MEASURES)[number]['key'];
  let measure = $state<Key>('betweenness');
  let guess = $state<number | null>(null);
  let answered = $state(false);
  const medici = net.labels.indexOf('Medici');
  const W = 560, H = 400;

  type Node = SimulationNodeDatum & { i: number };
  const pos = (() => {
    const nodes: Node[] = net.labels.map((_, i) => ({ i }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink<Node, { source: number; target: number }>(net.edges.map(([a, b]) => ({ source: a, target: b }))).id((d) => d.i).distance(70))
      .force('charge', forceManyBody<Node>().strength(-260))
      .force('x', forceX<Node>(W / 2).strength(0.06)).force('y', forceY<Node>(H / 2).strength(0.08))
      .force('collide', forceCollide<Node>(30)).stop();
    sim.tick(400);
    return nodes.map((d) => ({ x: Math.max(36, Math.min(W - 36, d.x!)), y: Math.max(40, Math.min(H - 30, d.y!)) }));
  })();

  onMount(() => {
    const a = loadPrediction(predictId);
    if (a) { answered = true; guess = a.kind === 'node' ? a.node : null; }
    return onPrediction(predictId, (a) => { answered = a !== null; guess = a?.kind === 'node' ? a.node : null; });
  });

  const vals = $derived(net[measure]);
  const vmax = $derived(Math.max(...vals));
  const size = (i: number) => 22 + 40 * (vals[i] / vmax);
  const rank = (i: number) => 1 + vals.filter((v) => v > vals[i] + 1e-12).length;
  const name = (i: number) => (answered ? net.labels[i] : `家族 ${String.fromCharCode(65 + i)}`);
</script>

<figure class="flo">
  <figcaption class="title">梅迪奇在四種眼鏡下都是第一名</figcaption>
  <div class="row" role="radiogroup" aria-label="中心性">
    {#each MEASURES as m}<button type="button" role="radio" aria-checked={measure === m.key} onclick={() => (measure = m.key)}>{m.label}</button>{/each}
  </div>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="佛羅倫斯 15 個家族的婚姻網路，大小代表{MEASURES.find((m) => m.key === measure)?.label}中心性。{answered ? `梅迪奇排第 ${rank(medici)}。` : '名字在你猜完之後才會顯示。'}">
    {#each net.edges as [a, b]}<line x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} class="edge" class:med={answered && (a === medici || b === medici)} />{/each}
    {#each pos as q, i}
      <g transform="translate({q.x - size(i) / 3} {q.y - size(i) / 2})" class="fam" class:medici={answered && i === medici} class:guess={i === guess}>
        <rect x="-4" y="-3" width={(size(i) * 2) / 3 + 8} height={size(i) + 6} rx="8" class="halo" />
        <svg width={(size(i) * 2) / 3} height={size(i)} viewBox="0 0 24 36">{@html sprites[i]}</svg>
      </g>
      <text x={q.x} y={q.y + size(i) / 2 + 15} text-anchor="middle" class="nm" class:strong={answered && i === medici}>{name(i)}</text>
    {/each}
  </svg>
  <p class="now" aria-live="polite">
    {#if !answered}
      先在上面的預測裡猜一個家族；送出之後，這裡會顯示真正的家族名字。
    {:else if guess === medici}
      你猜對了：中間那個大大的家族就是梅迪奇（Medici）。
    {:else if guess !== null}
      你選的是 {net.labels[guess]}（介數排第 {1 + net.betweenness.filter((v) => v > net.betweenness[guess!] + 1e-12).length}）；梅迪奇是中間那個最大的家族。
    {:else}
      梅迪奇（Medici）是中間那個最大的家族。
    {/if}
  </p>
  <p class="source">資料來源：{#if source.url}<a href={source.url} rel="noopener" target="_blank">{source.text}</a>{:else}{source.text}{/if}</p>
</figure>

<style>
  .flo { margin: var(--space-4) 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
  .title { font-family: var(--font-display); font-weight: 600; font-size: 18px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  svg { display: block; width: 100%; height: auto; }
  .edge { stroke: var(--line); stroke-width: 2; }
  .edge.med { stroke: var(--accent); }
  .halo { fill: transparent; }
  .fam.medici .halo { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
  .fam.guess .halo { stroke: var(--signal); stroke-width: 2.5; }
  .nm { font-size: 12px; fill: var(--muted); }
  .nm.strong { fill: var(--accent); font-weight: 600; font-size: 14px; }
  .now { margin: 0; font-size: 15px; line-height: 1.7; }
  .source { margin: 0; font-size: 12px; color: var(--muted); }
  @media (prefers-reduced-motion: no-preference) { .fam rect, .fam svg { transition: width 400ms, height 400ms; } }
</style>
