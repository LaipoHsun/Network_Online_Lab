<script lang="ts">
  // 預測元件（docs/design.md 共用元件 3）：數字滑桿、畫一條曲線、在網路上點一個人。
  // 送出後鎖定，答案存進 localStorage，第 6 段的揭曉圖讀同一個 id 畫出 --signal 虛線。
  import { onMount } from 'svelte';
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
  import { type PredictAnswer, clearPrediction, loadPrediction, savePrediction } from '../../lib/ui/storage';

  interface Props {
    /** 儲存用的 id，例如 '01-degree/mean-friends'；揭曉圖用同一個 id */
    id: string;
    kind: 'number' | 'curve' | 'node' | 'split';
    question: string;
    hint?: string;
    // number
    min?: number; max?: number; step?: number; unit?: string; initial?: number;
    // curve：在 xs 上各放一個可拖的點
    xs?: number[]; yMin?: number; yMax?: number; xLabel?: string; yLabel?: string; logX?: boolean;
    // node
    n?: number; edges?: [number, number][]; labels?: string[];
    // split：把 100% 分給幾個類別（例如常常／偶爾／很少見面）
    categories?: string[];
    /** 存不存 localStorage（展示頁可以關掉） */
    persist?: boolean;
    /** 展示用：一開始的答案 */
    demoAnswer?: PredictAnswer | null;
    /** 允許「重新作答」（只給 /playground 用） */
    allowReset?: boolean;
  }
  let {
    id, kind, question, hint,
    min = 0, max = 10, step = 1, unit = '', initial,
    xs = [], yMin = 0, yMax = 1, xLabel = '', yLabel = '', logX = false,
    n = 0, edges = [], labels = [], categories = [],
    persist = true, demoAnswer = null, allowReset = false,
  }: Props = $props();

  const uid = $props.id();
  let answer = $state<PredictAnswer | null>(demoAnswer);
  let value = $state(initial ?? Math.round((min + max) / 2 / step) * step);
  let ys = $state<number[]>(xs.map(() => (yMin + yMax) / 2));
  let picked = $state<number | null>(null);
  // 分界點（累積百分比），預設平均分配
  let cuts = $state<number[]>(categories.slice(1).map((_, i) => Math.round(((i + 1) * 100) / categories.length)));
  const shares = $derived(categories.map((_, i) => (i === categories.length - 1 ? 100 : cuts[i]) - (i === 0 ? 0 : cuts[i - 1])));
  let focusNode = $state(0);
  const locked = $derived(answer !== null);

  onMount(() => {
    if (persist && !demoAnswer) {
      const a = loadPrediction(id);
      if (a) answer = a;
    }
    if (answer?.kind === 'number') value = answer.value;
    if (answer?.kind === 'curve') ys = [...answer.ys];
    if (answer?.kind === 'node') picked = answer.node;
    if (answer?.kind === 'split') cuts = answer.values.slice(0, -1).map((_, i) => answer!.kind === 'split' ? answer.values.slice(0, i + 1).reduce((s, v) => s + v, 0) : 0);
    if (kind === 'node') layoutNodes();
  });

  function submit() {
    let a: PredictAnswer;
    if (kind === 'number') a = { kind: 'number', value, at: Date.now() };
    else if (kind === 'curve') a = { kind: 'curve', xs, ys: [...ys], at: Date.now() };
    else if (kind === 'split') a = { kind: 'split', labels: [...categories], values: [...shares], at: Date.now() };
    else { if (picked === null) return; a = { kind: 'node', node: picked, label: labels[picked], at: Date.now() }; }
    answer = a;
    if (persist) savePrediction(id, a);
  }
  function skip() {
    answer = { kind: 'skipped', at: Date.now() };
    if (persist) savePrediction(id, answer);
  }
  function reset() {
    answer = null; picked = null;
    if (persist) clearPrediction(id);
  }

  // ---- 曲線
  const W = 320, H = 200, PAD = { l: 40, r: 12, t: 10, b: 34 };
  const xPos = (x: number) => {
    const lo = xs[0], hi = xs[xs.length - 1];
    const t = logX ? (Math.log10(x) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (x - lo) / (hi - lo || 1);
    return PAD.l + t * (W - PAD.l - PAD.r);
  };
  const yPos = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const yFrom = (py: number) => Math.max(yMin, Math.min(yMax, yMin + (1 - (py - PAD.t) / (H - PAD.t - PAD.b)) * (yMax - yMin)));
  let curveSvg: SVGSVGElement;
  let drawing = false;
  function drawAt(e: PointerEvent) {
    const r = curveSvg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    let best = 0;
    xs.forEach((x, i) => { if (Math.abs(xPos(x) - px) < Math.abs(xPos(xs[best]) - px)) best = i; });
    ys[best] = yFrom(py);
  }
  function handleKey(i: number, e: KeyboardEvent) {
    const d = (yMax - yMin) / 20;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') ys[i] = Math.min(yMax, ys[i] + d);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') ys[i] = Math.max(yMin, ys[i] - d);
    else if (e.key === 'Home') ys[i] = yMin;
    else if (e.key === 'End') ys[i] = yMax;
    else return;
    e.preventDefault();
  }
  const curvePath = $derived(xs.map((x, i) => `${i ? 'L' : 'M'}${xPos(x).toFixed(1)} ${yPos(ys[i]).toFixed(1)}`).join(''));
  const fmtX = (x: number) => (x < 0.01 ? x.toExponential(0) : String(x));

  // ---- 比例條
  let barEl: HTMLDivElement;
  let dragging = -1;
  function setCut(k: number, v: number) {
    const lo = k === 0 ? 0 : cuts[k - 1], hi = k === cuts.length - 1 ? 100 : cuts[k + 1];
    cuts[k] = Math.max(lo, Math.min(hi, Math.round(v)));
  }
  function barMove(e: PointerEvent) {
    if (dragging < 0 || locked) return;
    const r = barEl.getBoundingClientRect();
    setCut(dragging, ((e.clientX - r.left) / r.width) * 100);
  }
  function cutKey(k: number, e: KeyboardEvent) {
    if (locked) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setCut(k, cuts[k] + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setCut(k, cuts[k] - step);
    else return;
    e.preventDefault();
  }

  // ---- 點一個人
  type N = SimulationNodeDatum & { i: number };
  let pts = $state<{ x: number; y: number }[]>([]);
  const NW = 320, NH = 240;
  function layoutNodes() {
    // d3-force 的初始位置與抖動都是確定的，同一張網路每次排出一樣的圖
    const nodes: N[] = Array.from({ length: n }, (_, i) => ({ i, x: NW / 2 + 80 * Math.cos(i), y: NH / 2 + 80 * Math.sin(i) }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink<N, { source: number; target: number }>(edges.map(([a, b]) => ({ source: a, target: b }))).id((d) => d.i).distance(26))
      .force('charge', forceManyBody().strength(-60))
      .force('x', forceX(NW / 2).strength(0.08)).force('y', forceY(NH / 2).strength(0.1))
      .force('collide', forceCollide(8)).stop();
    sim.tick(300);
    pts = nodes.map((d) => ({ x: Math.max(10, Math.min(NW - 10, d.x!)), y: Math.max(10, Math.min(NH - 10, d.y!)) }));
  }
  function nodeKey(i: number, e: KeyboardEvent) {
    if (locked) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') focusNode = (i + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') focusNode = (i - 1 + n) % n;
    else if (e.key === 'Enter' || e.key === ' ') picked = i;
    else return;
    e.preventDefault();
    if (e.key.startsWith('Arrow')) (document.getElementById(`${uid}-n${focusNode}`) as unknown as SVGElement | null)?.focus();
  }
</script>

<section class="predict" aria-labelledby="{uid}-q" data-locked={locked}>
  <p class="tag">先猜猜看</p>
  <h3 id="{uid}-q">{question}</h3>
  {#if hint}<p class="hint">{hint}</p>{/if}

  {#if kind === 'number'}
    <div class="slider">
      <input type="range" {min} {max} {step} bind:value disabled={locked} aria-labelledby="{uid}-q" aria-valuetext="{value}{unit}" />
      <output class="num big">{value}<small>{unit}</small></output>
    </div>
    <div class="scale num"><span>{min}{unit}</span><span>{max}{unit}</span></div>
  {:else if kind === 'curve'}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg class="curve" viewBox="0 0 {W} {H}" bind:this={curveSvg}
      onpointerdown={(e) => { if (locked) return; drawing = true; curveSvg.setPointerCapture(e.pointerId); drawAt(e); }}
      onpointermove={(e) => { if (drawing) drawAt(e); }}
      onpointerup={() => (drawing = false)}
      style:touch-action={locked ? 'auto' : 'none'}>
      <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} class="plot" />
      {#each [yMin, (yMin + yMax) / 2, yMax] as t}
        <text x={PAD.l - 6} y={yPos(t) + 4} text-anchor="end" class="tick">{+t.toFixed(2)}</text>
      {/each}
      {#each xs as x}<text x={xPos(x)} y={H - PAD.b + 14} text-anchor="middle" class="tick">{fmtX(x)}</text>{/each}
      <text x={(W + PAD.l) / 2} y={H - 4} text-anchor="middle" class="axis">{xLabel}{logX ? '（對數尺度）' : ''}</text>
      <path d={curvePath} class="line" />
      {#each xs as x, i}
        <circle cx={xPos(x)} cy={yPos(ys[i])} r="7" class="handle" role="slider" tabindex={locked ? -1 : 0}
          aria-label="{xLabel} = {fmtX(x)} 時的 {yLabel}" aria-valuemin={yMin} aria-valuemax={yMax} aria-valuenow={+ys[i].toFixed(2)}
          aria-readonly={locked} onkeydown={(e) => !locked && handleKey(i, e)} />
      {/each}
    </svg>
    <p class="hint">{yLabel}：用滑鼠或手指在圖上畫，或用方向鍵調整每個點。</p>
  {:else if kind === 'split'}
    <div class="split" bind:this={barEl} onpointermove={barMove} onpointerup={() => (dragging = -1)} onpointercancel={() => (dragging = -1)}>
      {#each categories as c, i}
        <div class="seg" style:width="{shares[i]}%" data-i={i % 3}>
          <span class="seg-label">{c}</span><span class="num seg-val">{shares[i]}%</span>
        </div>
      {/each}
      {#each cuts as v, k}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="cut" role="slider" tabindex={locked ? -1 : 0} style:left="{v}%"
          aria-label="{categories[k]}和{categories[k + 1]}的分界" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}
          aria-valuetext="{categories.map((c, i) => `${c} ${shares[i]}%`).join('，')}" aria-readonly={locked}
          onpointerdown={(e) => { if (locked) return; dragging = k; barEl.setPointerCapture(e.pointerId); }}
          onkeydown={(e) => cutKey(k, e)}></div>
      {/each}
    </div>
    <p class="hint">拖曳分界線（或用方向鍵、Shift＋方向鍵一次 5%）分配 100%。</p>
  {:else}
    <svg class="net" viewBox="0 0 {NW} {NH}" role="radiogroup" aria-labelledby="{uid}-q">
      {#each edges as [a, b]}
        {#if pts[a] && pts[b]}<line x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} class="edge" />{/if}
      {/each}
      {#each pts as p, i}
        <circle id="{uid}-n{i}" cx={p.x} cy={p.y} r={picked === i ? 9 : 6} class="node" class:picked={picked === i}
          role="radio" aria-checked={picked === i} aria-label={labels[i] ?? `第 ${i + 1} 位`}
          tabindex={locked ? -1 : i === focusNode ? 0 : -1}
          onclick={() => { if (!locked) { picked = i; focusNode = i; } }} onkeydown={(e) => nodeKey(i, e)} />
      {/each}
    </svg>
    <p class="hint">{picked === null ? '點一個人，或用方向鍵移動、Enter 選取。' : `你選了：${labels[picked] ?? `第 ${picked + 1} 位`}`}</p>
  {/if}

  <div class="actions">
    {#if !locked}
      <button type="button" class="primary" onclick={submit} disabled={kind === 'node' && picked === null}>送出我的猜測</button>
      <button type="button" class="ghost" onclick={skip}>跳過</button>
    {:else if answer?.kind === 'skipped'}
      <p class="done">你跳過了這題。第 6 段揭曉時不會畫出你的猜測。</p>
    {:else}
      <p class="done">已送出並鎖定。捲到第 6 段，看真實資料和你的猜測差多少。</p>
    {/if}
    {#if locked && allowReset}<button type="button" class="ghost" onclick={reset}>重新作答（展示用）</button>{/if}
  </div>
</section>

<style>
  .predict { background: var(--panel); border: 1px solid var(--line); border-left: 4px solid var(--signal); border-radius: var(--radius); padding: var(--space-4); }
  .tag { margin: 0; font-size: 13px; color: var(--signal); font-weight: 500; }
  h3 { margin: var(--space-1) 0 var(--space-2); font-size: 18px; }
  .hint { margin: var(--space-1) 0; font-size: 14px; color: var(--muted); }
  .slider { display: flex; align-items: center; gap: var(--space-4); }
  .slider input { flex: 1; accent-color: var(--signal); min-height: 32px; }
  .big { font-size: 28px; min-width: 3.5em; text-align: right; color: var(--signal); }
  .big small { font-size: 14px; margin-left: 2px; color: var(--muted); }
  .scale { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-right: 120px; }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  svg { width: 100%; max-width: 480px; display: block; margin: var(--space-2) 0; }
  .plot { fill: var(--bg); stroke: var(--line); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .axis { font-size: 11px; fill: var(--muted); }
  .line { fill: none; stroke: var(--signal); stroke-width: 2; stroke-dasharray: 6 4; }
  .handle { fill: var(--panel); stroke: var(--signal); stroke-width: 2; cursor: ns-resize; }
  .handle:focus-visible, .node:focus-visible { outline: none; stroke: var(--ink); stroke-width: 3; }
  .net { background: var(--bg); border-radius: 8px; }
  .edge { stroke: var(--muted); stroke-opacity: 0.45; stroke-width: 1; }
  .node { fill: var(--accent); stroke: var(--panel); stroke-width: 1.5; cursor: pointer; }
  .node.picked { fill: var(--signal); }
  [data-locked="true"] .node { cursor: default; }
  .split { position: relative; display: flex; height: 64px; margin: var(--space-3) 0 var(--space-1); border-radius: 8px; overflow: visible; touch-action: none; user-select: none; }
  .seg { display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; min-width: 0; line-height: 1.3; color: var(--ink); }
  .seg[data-i="0"] { background: var(--accent); color: var(--panel); border-radius: 8px 0 0 8px; }
  .seg[data-i="1"] { background: var(--accent-soft); }
  .seg[data-i="2"] { background: var(--bg); border: 1px solid var(--line); border-radius: 0 8px 8px 0; }
  .seg-label { font-size: 13px; white-space: nowrap; }
  .seg-val { font-size: 16px; font-weight: 500; }
  .cut { position: absolute; top: -6px; bottom: -6px; width: 14px; margin-left: -7px; cursor: ew-resize; display: flex; justify-content: center; }
  .cut::before { content: ''; width: 4px; border-radius: 2px; background: var(--signal); }
  .cut:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; border-radius: 4px; }
  [data-locked="true"] .cut { cursor: default; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
  button { font: inherit; font-size: 15px; border-radius: 8px; padding: 6px 14px; min-height: 36px; cursor: pointer; border: 1px solid var(--line); background: var(--bg); color: var(--ink); }
  .primary { background: var(--signal); border-color: var(--signal); color: var(--panel); }
  .primary:disabled { opacity: 0.5; cursor: default; }
  .ghost { background: none; color: var(--muted); }
  .done { margin: 0; font-size: 14px; color: var(--muted); }
</style>
