<script lang="ts">
  // 第 6 章場景 B：剪斷實驗（docs/chapters/06-weak-ties.md ③）。
  // 依連結強度排序剪掉 f 比例的連結，網路即時斷裂，旁邊同步畫最大連通群比例 S(f)。
  // 三條 S(f) 曲線事先用 union-find 一次算好，拖滑桿只是查表（遠低於 100 ms）。
  import { onMount } from 'svelte';
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
  import { CampusSim, type Tie } from '../../../lib/sim/campus';
  import { connectedComponents, edgeOverlaps, fromEdges } from '../../../lib/network';
  import { seededRandom, shuffle } from '../../../lib/sim/random';
  import { emitLive, onHighlight } from '../../../lib/ui/bus';
  import { prefersReducedMotion } from '../../../lib/ui/theme';
  import { ch6Script, XIAOYU } from './script';

  type Order = 'weak' | 'strong' | 'random';
  const ORDER_LABEL: Record<Order, string> = { weak: '從最弱的開始剪', strong: '從最強的開始剪', random: '隨機剪（對照組）' };

  // ---- 網路（學期末）
  const script = ch6Script();
  const sim = new CampusSim(script);
  sim.seek(sim.totalSlots);
  const ties: Tie[] = sim.currentTies();
  const n = script.people.length, m = ties.length;
  const people = script.people;
  const overlapOf = new Map(edgeOverlaps(fromEdges(n, ties.map((t) => [t.a, t.b] as [number, number]))).map((o) => [`${o.u}-${o.v}`, o.overlap]));

  // 各種順序下每條連結被剪的名次
  const byWeight = ties.map((_, k) => k).sort((x, y) => ties[x].weight - ties[y].weight || x - y);
  const orders: Record<Order, number[]> = {
    weak: byWeight,
    strong: [...byWeight].reverse(),
    random: shuffle(seededRandom(66), ties.map((_, k) => k)),
  };
  const rankOf: Record<Order, number[]> = { weak: [], strong: [], random: [] };
  for (const o of Object.keys(orders) as Order[]) orders[o].forEach((e, r) => (rankOf[o][e] = r));

  /** S[k] = 剪掉前 k 條之後最大連通群的比例（倒著把連結加回去，union-find） */
  function curve(seq: number[]): number[] {
    const parent = Array.from({ length: n }, (_, i) => i), size = new Array(n).fill(1);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const S = new Array<number>(m + 1);
    let best = 1;
    S[m] = 1 / n;
    for (let k = m - 1; k >= 0; k--) {
      const t = ties[seq[k]];
      let a = find(t.a), b = find(t.b);
      if (a !== b) { if (size[a] < size[b]) [a, b] = [b, a]; parent[b] = a; size[a] += size[b]; best = Math.max(best, size[a]); }
      S[k] = best / n;
    }
    return S;
  }
  const curves: Record<Order, number[]> = { weak: curve(orders.weak), strong: curve(orders.strong), random: curve(orders.random) };

  // 弱的一半與強的一半的平均重疊度（預測 b）
  const half = Math.floor(m / 2);
  const meanO = (idx: number[]) => idx.reduce((s, k) => s + overlapOf.get(`${ties[k].a}-${ties[k].b}`)!, 0) / Math.max(1, idx.length);
  const OWeak = meanO(byWeight.slice(0, half)), OStrong = meanO(byWeight.slice(half));
  const maxW = Math.max(...ties.map((t) => t.weight));

  // ---- 狀態
  let order = $state<Order>('weak');
  let f = $state(0);
  let playing = $state(false);
  let raf = 0;
  const k = $derived(Math.round(f * m));
  const S = $derived(curves[order][k]);
  const alive = $derived(ties.map((_, e) => rankOf[order][e] >= k));
  const comps = $derived(connectedComponents(fromEdges(n, ties.filter((_, e) => alive[e]).map((t) => [t.a, t.b] as [number, number]))));
  const lcc = $derived(new Set(comps[0]));
  let hiKey = $state<string | null>(null);

  $effect(() => { emitLive({ f, S, Ow: OWeak, Os: OStrong, N: n }, 'cut'); });

  function play() {
    if (playing) { playing = false; cancelAnimationFrame(raf); return; }
    if (f >= 1) f = 0;
    if (prefersReducedMotion()) { f = 1; return; }
    playing = true;
    let last = performance.now();
    const tick = (now: number) => {
      f = Math.min(1, f + (now - last) / 7000);
      last = now;
      if (f < 1 && playing) raf = requestAnimationFrame(tick); else playing = false;
    };
    raf = requestAnimationFrame(tick);
  }
  function choose(o: Order) { order = o; f = 0; playing = false; cancelAnimationFrame(raf); play(); }

  // ---- 排版（d3-force 的起點與抖動都固定，每次排出一樣的圖）
  type N = SimulationNodeDatum & { i: number };
  const W = 360, H = 300;
  const nodes: N[] = people.map((p, i) => ({ i, x: W / 2 + 120 * Math.cos((2 * Math.PI * i) / n), y: H / 2 + 100 * Math.sin((2 * Math.PI * i) / n) }));
  const layout = forceSimulation(nodes)
    .force('link', forceLink<N, { source: number; target: number; w: number }>(ties.map((t) => ({ source: t.a, target: t.b, w: t.weight / maxW }))).id((d) => d.i).distance(22).strength((l) => 0.05 + 0.6 * l.w))
    .force('charge', forceManyBody().strength(-38))
    .force('x', forceX(W / 2).strength(0.06)).force('y', forceY(H / 2).strength(0.08))
    .force('collide', forceCollide(6)).stop();
  layout.tick(400);
  const pos = nodes.map((d) => ({ x: Math.max(8, Math.min(W - 8, d.x!)), y: Math.max(8, Math.min(H - 8, d.y!)) }));
  const width = (w: number) => 0.5 + 3 * Math.sqrt(w / maxW);

  onMount(() => {
    const off = onHighlight(({ key }) => (hiKey = key));
    return () => { off(); cancelAnimationFrame(raf); };
  });
  const hotEdge = (e: number) => (hiKey === 'O' || hiKey === 'n') && overlapOf.get(`${ties[e].a}-${ties[e].b}`) === 0;
  const hotNode = (i: number) => hiKey === 'S' && lcc.has(i);

  // ---- S(f) 小圖
  const CW = 360, CH = 170, P = { l: 40, r: 10, t: 12, b: 34 };
  const cx = (x: number) => P.l + x * (CW - P.l - P.r), cy = (y: number) => P.t + (1 - y) * (CH - P.t - P.b);
  const path = (S: number[]) => S.map((v, i) => `${i ? 'L' : 'M'}${cx(i / m).toFixed(1)} ${cy(v).toFixed(1)}`).join('');
  const explain = $derived(
    f === 0 ? `網路有 ${n} 人、${m} 條連結，線越粗代表相處時間越長。按上面的按鈕開始剪。`
    : `剪掉 ${Math.round(f * 100)}% 的連結（${ORDER_LABEL[order].replace('剪', '剪起')}）：最大連通群還有 ${comps[0].length} 人（${Math.round(S * 100)}%），整個網路分成 ${comps.length} 塊。`
      + (order === 'weak' && S < 0.5 ? '弱連結是圈子之間的橋，剪掉它們，網路就碎成一個個系所圈。' : order === 'strong' && f > 0.5 ? '強連結大多在圈子裡面，剪掉它們只是讓每個圈子變鬆，整體還連在一起。' : ''),
  );
</script>

<div class="cut">
  <div class="row" role="radiogroup" aria-label="剪的順序">
    {#each ['weak', 'strong', 'random'] as const as o}
      <button type="button" role="radio" aria-checked={order === o} onclick={() => choose(o)}>{ORDER_LABEL[o]}</button>
    {/each}
  </div>

  <div class="views">
    <svg class="net" viewBox="0 0 {W} {H}" role="img" aria-label="剪斷後的網路：{comps.length} 塊，最大連通群 {comps[0].length} 人">
      {#each ties as t, e}
        {@const a = pos[t.a]}
        {@const b = pos[t.b]}
        {@const mx = (a.x + b.x) / 2}
        {@const my = (a.y + b.y) / 2}
        <g class="edge" class:gone={!alive[e]} class:hot={hotEdge(e)} style:--w="{width(t.weight)}px">
          <line x1={a.x} y1={a.y} x2={mx} y2={my} style:transform-origin="{a.x}px {a.y}px" />
          <line x1={b.x} y1={b.y} x2={mx} y2={my} style:transform-origin="{b.x}px {b.y}px" />
        </g>
      {/each}
      {#each pos as p, i}
        <circle cx={p.x} cy={p.y} r={i === XIAOYU ? 6.5 : 5} class="node" class:out={!lcc.has(i)} class:hot={hotNode(i)} class:me={i === XIAOYU}
          style:fill="var(--college-{people[i].college})"><title>{people[i].name}（{people[i].dept}）</title></circle>
      {/each}
    </svg>

    <svg class="chart" viewBox="0 0 {CW} {CH}" role="img" aria-label="最大連通群比例 S(f)：目前 f = {f.toFixed(2)}，S = {S.toFixed(2)}">
      {#each [0, 0.5, 1] as t}
        <line x1={P.l} x2={CW - P.r} y1={cy(t)} y2={cy(t)} class="grid" />
        <text x={P.l - 6} y={cy(t) + 4} text-anchor="end" class="tick">{t}</text>
      {/each}
      {#each [0, 0.25, 0.5, 0.75, 1] as t}<text x={cx(t)} y={CH - P.b + 14} text-anchor="middle" class="tick">{t}</text>{/each}
      <text x={(CW + P.l) / 2} y={CH - 4} text-anchor="middle" class="axis">剪掉的連結比例 f</text>
      <text transform="translate(11 {(CH - P.b + P.t) / 2}) rotate(-90)" text-anchor="middle" class="axis">S(f)</text>
      {#each ['random', 'strong', 'weak'] as const as o}
        <path d={path(curves[o])} class="curve" class:on={order === o} data-o={o} />
      {/each}
      <line x1={cx(f)} x2={cx(f)} y1={P.t} y2={CH - P.b} class="now-line" />
      <circle cx={cx(f)} cy={cy(S)} r="4" class="now-dot" />
      <g class="legend" transform="translate({CW - P.r - 118} {P.t + 4})">
        {#each ['weak', 'strong', 'random'] as const as o, j}
          <line x1="0" x2="16" y1={j * 14 + 4} y2={j * 14 + 4} class="curve on" data-o={o} />
          <text x="20" y={j * 14 + 8} class="tick">{o === 'weak' ? '先剪弱的' : o === 'strong' ? '先剪強的' : '隨機'}</text>
        {/each}
      </g>
    </svg>
  </div>

  <div class="row slider">
    <button type="button" onclick={play} aria-pressed={playing}>{playing ? '暫停' : f >= 1 ? '重剪一次' : '開始剪'}</button>
    <label>
      <span>f = <b class="num">{f.toFixed(2)}</b></span>
      <input type="range" min="0" max="1" step="0.01" bind:value={f} oninput={() => { playing = false; cancelAnimationFrame(raf); }} aria-label="剪掉的連結比例 f" />
    </label>
    <span class="num s">S = {S.toFixed(2)}</span>
  </div>
  <p class="now" aria-live="polite"><strong>現在發生了什麼？</strong>{explain}</p>
  <p class="note">剪斷的連結會從中間斷開縮回兩端；不在最大連通群裡的人變淡。灰色細線（隨機剪）是對照組。</p>
</div>

<style>
  .cut { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"], button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .views { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
  svg { width: 100%; height: auto; display: block; }
  .net { background: var(--bg); border-radius: 8px; }
  .edge line { stroke: var(--accent); stroke-width: var(--w); stroke-opacity: 0.55; stroke-linecap: round; transition: transform 350ms ease-in-out, stroke-opacity 350ms ease-in-out; }
  .edge.gone line { transform: scale(0); stroke-opacity: 0; }
  .edge.hot line { stroke: var(--signal); stroke-opacity: 1; }
  .node { stroke: var(--panel); stroke-width: 1; transition: opacity 300ms ease-in-out; }
  .node.out { opacity: 0.3; }
  .node.me { stroke: var(--signal); stroke-width: 2.5; }
  .node.hot { stroke: var(--signal); stroke-width: 2.5; }
  .grid { stroke: var(--line); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .axis { font-size: 11px; fill: var(--muted); }
  .curve { fill: none; stroke-width: 1.5; opacity: 0.45; }
  .curve.on { stroke-width: 2.5; opacity: 1; }
  .curve[data-o="weak"] { stroke: var(--signal); }
  .curve[data-o="strong"] { stroke: var(--accent); }
  .curve[data-o="random"] { stroke: var(--muted); stroke-dasharray: 3 3; }
  .now-line { stroke: var(--ink); stroke-dasharray: 2 3; }
  .now-dot { fill: var(--ink); }
  .slider label { flex: 1 1 200px; display: flex; align-items: center; gap: var(--space-2); font-size: 14px; }
  .slider input { flex: 1; min-width: 0; accent-color: var(--accent); min-height: 32px; }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .s { font-size: 14px; }
  .now { margin: 0; font-size: 15px; line-height: 1.7; }
  .now strong { display: block; font-size: 13px; color: var(--muted); font-weight: 500; }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
  @media (min-width: 1100px) { .views { grid-template-columns: minmax(0, 1fr); } }
</style>
