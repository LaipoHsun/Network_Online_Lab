<script lang="ts">
  // 第 2 章場景 B：兩種畫法。左：二分圖（上排是人、下排是焦點）；按「投影」後焦點消失，
  // 只留下「共享至少一個焦點」的人與人連結。30 人的通識課會瞬間變成 30 人全連通的一大團。
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
  import { untrack } from 'svelte';
  import { emitLive } from '../../../lib/ui/bus';

  const NP = 40;
  // 焦點與成員（示意）：一門 30 人的通識課、一個 6 人社團、兩間 4 人寢室、一個 5 人專題討論
  const FOCI: { name: string; members: number[] }[] = [
    { name: '通識課（30 人）', members: Array.from({ length: 30 }, (_, i) => i) },
    { name: '吉他社（6 人）', members: [26, 27, 28, 29, 30, 31] },
    { name: '寢室 A（4 人）', members: [31, 32, 33, 34] },
    { name: '寢室 B（4 人）', members: [2, 35, 36, 37] },
    { name: '專題討論（5 人）', members: [34, 37, 38, 39, 10] },
  ];
  let projected = $state(false);
  let focus = $state<number | null>(null);
  const W = 640, H = 420;

  // 二分圖排法：人在上排、焦點在下排
  const bip = Array.from({ length: NP }, (_, i) => ({ x: 20 + (i * (W - 40)) / (NP - 1), y: 70 }));
  const fpos = FOCI.map((_, m) => ({ x: 80 + (m * (W - 160)) / (FOCI.length - 1), y: 330 }));

  // 投影：P = B Bᵀ（非對角線 > 0 就相連）
  const P: number[][] = Array.from({ length: NP }, () => Array(NP).fill(0));
  for (const f of FOCI) for (const a of f.members) for (const b of f.members) if (a !== b) P[a][b] += 1;
  const projEdges: [number, number][] = [];
  for (let a = 0; a < NP; a++) for (let b = a + 1; b < NP; b++) if (P[a][b] > 0) projEdges.push([a, b]);

  type Node = SimulationNodeDatum & { i: number };
  const proj = (() => {
    const nodes: Node[] = Array.from({ length: NP }, (_, i) => ({ i, x: bip[i].x, y: H / 2 }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink<Node, { source: number; target: number }>(projEdges.map(([a, b]) => ({ source: a, target: b }))).id((d) => d.i).distance(40).strength(0.15))
      .force('charge', forceManyBody<Node>().strength(-60))
      .force('x', forceX<Node>(W / 2).strength(0.05)).force('y', forceY<Node>(H / 2).strength(0.08))
      .force('collide', forceCollide<Node>(9)).stop();
    sim.tick(300);
    return nodes.map((d) => ({ x: Math.max(14, Math.min(W - 14, d.x!)), y: Math.max(14, Math.min(H - 14, d.y!)) }));
  })();

  const pos = $derived(projected ? proj : bip);
  const inFocus = (i: number) => focus !== null && FOCI[focus].members.includes(i);
  const sizeOf = (m: number) => FOCI[m].members.length;
  const linksOf = (m: number) => (sizeOf(m) * (sizeOf(m) - 1)) / 2;

  $effect(() => {
    const v = { N: NP, M: FOCI.length, L: projEdges.length, big: linksOf(0) };
    untrack(() => emitLive(v, 'ch2'));
  });
</script>

<div class="bip">
  <div class="row">
    <div role="radiogroup" aria-label="畫法" class="seg">
      <button type="button" role="radio" aria-checked={!projected} onclick={() => (projected = false)}>二分圖</button>
      <button type="button" role="radio" aria-checked={projected} onclick={() => (projected = true)}>投影</button>
    </div>
    <label class="pick">標出焦點：
      <select bind:value={focus}>
        <option value={null}>（不標）</option>
        {#each FOCI as f, m}<option value={m}>{f.name}</option>{/each}
      </select>
    </label>
  </div>

  <svg viewBox="0 0 {W} {H}" role="img"
    aria-label={projected ? `投影後：${NP} 個人、${projEdges.length} 條人與人的連結。` : `二分圖：${NP} 個人、${FOCI.length} 個焦點。`}>
    <!-- 二分圖的人–焦點連結 -->
    <g class="layer" class:hidden={projected}>
      {#each FOCI as f, m}
        {#each f.members as i}
          <line x1={bip[i].x} y1={bip[i].y} x2={fpos[m].x} y2={fpos[m].y} class="bedge" class:hl={focus === m} />
        {/each}
      {/each}
      {#each FOCI as f, m}
        <g transform="translate({fpos[m].x} {fpos[m].y})">
          <rect x="-46" y="-14" width="92" height="28" rx="6" class="focus" class:hl={focus === m} />
          <text y="4" text-anchor="middle" class="fl">{f.name.replace(/（.*）/, '')}</text>
          <text y="28" text-anchor="middle" class="fs">{f.members.length} 人</text>
        </g>
      {/each}
      <text x={W / 2} y={30} text-anchor="middle" class="cap">人（{NP} 位）</text>
      <text x={W / 2} y={385} text-anchor="middle" class="cap">焦點（{FOCI.length} 個）</text>
    </g>
    <!-- 投影後的人–人連結 -->
    <g class="layer" class:hidden={!projected}>
      {#each projEdges as [a, b]}
        <line x1={proj[a].x} y1={proj[a].y} x2={proj[b].x} y2={proj[b].y} class="pedge" class:hl={inFocus(a) && inFocus(b)} class:multi={P[a][b] > 1} />
      {/each}
    </g>
    {#each pos as q, i}
      <circle cx={q.x} cy={q.y} r="6" class="person" class:hl={inFocus(i)} />
    {/each}
  </svg>

  <p class="now" aria-live="polite">
    {#if projected}
      投影後剩下 {NP} 個人、{projEdges.length} 條連結。光是那門 30 人的通識課就產生 30 × 29 ÷ 2 = {linksOf(0)} 條：佔了全部的 {Math.round((linksOf(0) / projEdges.length) * 100)}%。粗線是共享兩個焦點的人。
    {:else}
      上排是人，下排是焦點（課、社團、寢室）。一條線代表「這個人屬於這個焦點」。按「投影」看看人與人之間會長出多少連結。
    {/if}
  </p>
</div>

<style>
  .bip { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
  .seg { display: flex; gap: 6px; }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .pick { font-size: 13px; color: var(--muted); }
  select { font: inherit; font-size: 13px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px; }
  svg { display: block; width: 100%; height: auto; }
  .layer { transition: opacity 500ms; }
  .layer.hidden { opacity: 0; pointer-events: none; }
  .bedge { stroke: var(--line); stroke-width: 1; }
  .bedge.hl { stroke: var(--accent); stroke-width: 1.8; }
  .focus { fill: var(--bg); stroke: var(--muted); }
  .focus.hl { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
  .fl { font-size: 12px; fill: var(--ink); }
  .fs { font-size: 10px; fill: var(--muted); }
  .cap { font-size: 12px; fill: var(--muted); }
  .pedge { stroke: var(--line); stroke-width: 0.8; }
  .pedge.multi { stroke: var(--muted); stroke-width: 2.4; }
  .pedge.hl { stroke: var(--accent); }
  .person { fill: var(--college-socsci); stroke: var(--panel); stroke-width: 1.5; transition: cx 700ms ease-in-out, cy 700ms ease-in-out; }
  .person.hl { fill: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .person, .layer { transition: none; } }
  .now { margin: 0; font-size: 14px; line-height: 1.7; }
</style>
