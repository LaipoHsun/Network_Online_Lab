<script lang="ts">
  // 資料揭曉圖（docs/design.md 共用元件 6、「圖表」）：一開始只顯示讀者的預測，
  // 捲到位後真實資料「畫」出來。資料由 RevealChart.astro 從 data/build 讀進來。
  import { onMount } from 'svelte';
  import { scaleBand, scaleLinear, scaleLog } from 'd3-scale';
  import { line as d3line } from 'd3-shape';
  import { type PredictAnswer, loadPrediction, onPrediction } from '../../lib/ui/storage';
  import { prefersReducedMotion } from '../../lib/ui/theme';

  export interface ChartPoint { x: number | string; y: number; label?: string; ci?: [number, number] | null }
  export interface ChartSeries { name: string; points: ChartPoint[] }
  export interface ChartSource { text: string; url?: string; sample?: string; year?: number }

  interface Props {
    /** 一句結論，不是變數名 */
    title: string;
    kind: 'line' | 'bar' | 'scatter' | 'distribution';
    series: ChartSeries[];
    source: ChartSource;
    xLabel: string;
    yLabel: string;
    logX?: boolean;
    logY?: boolean;
    /** 讀哪一個預測（Predict 的 id） */
    predictId?: string;
    /** 數字型預測畫成垂直線（x 方向）或水平線（y 方向） */
    predictAxis?: 'x' | 'y';
    predictLabel?: string;
    /** 額外的參考線，例如平均數、中位數 */
    markers?: { axis: 'x' | 'y'; value: number; label: string }[];
    /** 額外的數字型預測（例如同時猜中位數和平均數），一律畫成 x 方向的垂直線 */
    morePredictions?: { id: string; label: string }[];
    /** 展示用：強制揭曉狀態、或直接給一個預測 */
    revealed?: boolean | null;
    demoPrediction?: PredictAnswer | null;
  }
  let {
    title, kind, series, source, xLabel, yLabel, logX = false, logY = false,
    predictId, predictAxis = 'x', predictLabel = '你的猜測', markers = [], revealed = null, demoPrediction = null,
    morePredictions = [],
  }: Props = $props();

  const uid = $props.id();
  let width = $state(640);
  let shown = $state(revealed ?? false);
  let prediction = $state<PredictAnswer | null>(demoPrediction);
  let extra = $state<(number | null)[]>(morePredictions.map(() => null));
  let showTable = $state(false);
  let root: HTMLElement;
  const height = $derived(Math.max(220, Math.min(380, width * 0.6)));
  const M = $derived({ l: width < 420 ? 44 : 56, r: 16, t: 16, b: 48 });

  onMount(() => {
    if (predictId && !demoPrediction) prediction = loadPrediction(predictId);
    const offP = predictId && !demoPrediction ? onPrediction(predictId, (a) => (prediction = a)) : () => {};
    const num = (a: PredictAnswer | null) => (a?.kind === 'number' ? a.value : null);
    extra = morePredictions.map((m) => num(loadPrediction(m.id)));
    const offs = morePredictions.map((m, i) => onPrediction(m.id, (a) => { extra[i] = num(a); }));
    const ro = new ResizeObserver(([e]) => (width = Math.max(280, e.contentRect.width)));
    ro.observe(root);
    let io: IntersectionObserver | null = null;
    if (revealed === null) {
      io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) { shown = true; io?.disconnect(); }
      }, { threshold: [0, 0.6, 1] });
      io.observe(root);
    }
    if (prefersReducedMotion()) root.classList.add('instant');
    return () => { offP(); offs.forEach((f) => f()); ro.disconnect(); io?.disconnect(); };
  });

  // ---- 尺度
  const allPts = $derived(series.flatMap((s) => s.points));
  const categorical = $derived(kind === 'bar' || kind === 'distribution');
  const xBand = $derived(scaleBand<string>().domain(allPts.map((p) => String(p.x)).filter((v, i, a) => a.indexOf(v) === i)).range([M.l, width - M.r]).padding(0.18));
  const xNum = $derived.by(() => {
    const xs = allPts.map((p) => +p.x);
    const pv = [...(prediction?.kind === 'number' && predictAxis === 'x' ? [prediction.value] : []), ...extra.filter((v): v is number => v !== null)]
      .filter((v) => !logX || v > 0);
    const lo = Math.min(...xs, ...pv), hi = Math.max(...xs, ...pv);
    return logX ? scaleLog().domain([lo, hi]).range([M.l, width - M.r]) : scaleLinear().domain([Math.min(0, lo), hi]).nice().range([M.l, width - M.r]);
  });
  const yScale = $derived.by(() => {
    const ys = allPts.map((p) => p.y);
    const extra = prediction?.kind === 'curve' ? prediction.ys : prediction?.kind === 'split' ? prediction.values : prediction?.kind === 'number' && predictAxis === 'y' ? [prediction.value] : [];
    const cis = allPts.flatMap((p) => (p.ci ? [p.ci[1]] : []));
    const hi = Math.max(...ys, ...extra, ...cis);
    return logY ? scaleLog().domain([Math.min(...ys.filter((y) => y > 0)), hi]).range([height - M.b, M.t])
      : scaleLinear().domain([0, hi]).nice().range([height - M.b, M.t]);
  });
  // 分布圖：x 是整數類別，數字型預測畫在對應位置（可以落在兩根長條之間）
  function xOf(v: number | string): number {
    if (!categorical) return xNum(+v);
    const dom = xBand.domain();
    const i = dom.indexOf(String(v));
    if (i >= 0) return xBand(String(v))! + xBand.bandwidth() / 2;
    // 數值落在類別之間：線性內插
    const nums = dom.map(Number);
    const t = +v;
    const step = xBand.step();
    const first = xBand(dom[0])! + xBand.bandwidth() / 2;
    return first + ((t - nums[0]) / ((nums[nums.length - 1] - nums[0]) || 1)) * step * (nums.length - 1);
  }
  // 對數軸只標 10 的次方，避免 1、2、3…擠成一團
  const yTicks = $derived(logY
    ? (yScale.ticks() as number[]).filter((t) => Math.abs(Math.log10(t) - Math.round(Math.log10(t))) < 1e-9)
    : yScale.ticks(5));
  const xTicks = $derived(categorical ? xBand.domain()
    : logX ? (xNum.ticks() as number[]).filter((t) => Math.abs(Math.log10(t) - Math.round(Math.log10(t))) < 1e-9)
    : (xNum.ticks(6) as number[]));
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString('zh-TW') : Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(0) : String(+v.toFixed(3)));
  const PALETTE = ['var(--accent)', 'var(--muted)', 'var(--college-sci)'];
  const linePath = (pts: ChartPoint[]) => d3line<ChartPoint>().x((p) => xOf(p.x)).y((p) => yScale(p.y))(pts) ?? '';
  const predPath = $derived(prediction?.kind === 'curve'
    ? prediction.xs.map((x, i) => `${i ? 'L' : 'M'}${xOf(x)} ${yScale((prediction as { ys: number[] }).ys[i])}`).join('') : '');
  const wrapLabel = (s: string) => (s.length > 4 && width < 480 ? s.slice(0, 3) + '…' : s);
</script>

<figure class="reveal" class:shown bind:this={root} aria-labelledby="{uid}-t">
  <figcaption id="{uid}-t" class="title">{title}</figcaption>
  {#if series.length > 1}
    <ul class="legend">
      {#each series as s, si}<li><span class="swatch" style:background={PALETTE[si % 3]}></span>{s.name}</li>{/each}
      {#if prediction?.kind === 'curve'}<li><span class="swatch dash"></span>{predictLabel}</li>{/if}
    </ul>
  {/if}
  <svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="{title}。{shown ? '真實資料已顯示。' : '尚未揭曉。'}{prediction?.kind === 'number' ? `你的猜測是 ${prediction.value}。` : ''}">
    <!-- 格線與軸 -->
    {#each yTicks as t}
      <line x1={M.l} x2={width - M.r} y1={yScale(t)} y2={yScale(t)} class="grid" />
      <text x={M.l - 8} y={yScale(t) + 4} text-anchor="end" class="tick">{fmt(t)}</text>
    {/each}
    {#each xTicks as t}
      <text x={xOf(t)} y={height - M.b + 16} text-anchor="middle" class="tick">{categorical ? wrapLabel(String(t)) : fmt(+t)}</text>
    {/each}
    <line x1={M.l} x2={width - M.r} y1={height - M.b} y2={height - M.b} class="axis" />
    <text x={(M.l + width - M.r) / 2} y={height - 8} text-anchor="middle" class="axis-label">{xLabel}{logX ? '（對數尺度）' : ''}</text>
    <text transform="translate(12 {(M.t + height - M.b) / 2}) rotate(-90)" text-anchor="middle" class="axis-label">{yLabel}{logY ? '（對數尺度）' : ''}</text>

    <!-- 真實資料 -->
    <g class="data" aria-hidden={!shown}>
      {#each series as s, si}
        {#if categorical}
          {#each s.points as p, pi}
            <rect x={xBand(String(p.x))} width={xBand.bandwidth()} y={yScale(p.y)} height={Math.max(0, height - M.b - yScale(p.y))}
              class="bar" style:fill={PALETTE[si % 3]} style:transition-delay="{pi * 30}ms" />
          {/each}
        {:else if kind === 'line'}
          <path d={linePath(s.points)} pathLength="1" class="line" style:stroke={PALETTE[si % 3]} />
          {#each s.points as p}<circle cx={xOf(p.x)} cy={yScale(p.y)} r="3" class="dot" style:fill={PALETTE[si % 3]} />{/each}
        {:else}
          {#each s.points as p, pi}
            {#if p.ci}<line x1={xOf(p.x)} x2={xOf(p.x)} y1={yScale(p.ci[0])} y2={yScale(p.ci[1])} class="ci" style:stroke={PALETTE[si % 3]} style:transition-delay="{pi * 15}ms" />{/if}
            <circle cx={xOf(p.x)} cy={yScale(p.y)} r="4.5" class="dot scatter" style:fill={PALETTE[si % 3]} style:transition-delay="{pi * 15}ms"><title>{p.label ?? ''} ({p.x}, {fmt(p.y)})</title></circle>
          {/each}
        {/if}
      {/each}
      {#each markers as m, mi}
        {#if m.axis === 'x'}
          <line x1={xOf(m.value)} x2={xOf(m.value)} y1={M.t} y2={height - M.b} class="marker" />
          <text x={xOf(m.value) + 4} y={M.t + 12 + mi * 16} class="marker-label">{m.label}</text>
        {:else}
          <line x1={M.l} x2={width - M.r} y1={yScale(m.value)} y2={yScale(m.value)} class="marker" />
          <text x={width - M.r - 4} y={yScale(m.value) - 4} text-anchor="end" class="marker-label">{m.label}</text>
        {/if}
      {/each}
    </g>

    <!-- 讀者的預測（一直都在） -->
    {#if prediction?.kind === 'number'}
      {#if predictAxis === 'x'}
        <line x1={xOf(prediction.value)} x2={xOf(prediction.value)} y1={M.t} y2={height - M.b} class="pred" />
        <text x={xOf(prediction.value) + 4} y={M.t + 12 + markers.length * 16} class="pred-label">{predictLabel}：{prediction.value}</text>
      {:else}
        <line x1={M.l} x2={width - M.r} y1={yScale(prediction.value)} y2={yScale(prediction.value)} class="pred" />
        <text x={M.l + 4} y={yScale(prediction.value) - 6} class="pred-label">{predictLabel}：{prediction.value}</text>
      {/if}
    {:else if prediction?.kind === 'split' && categorical}
      {#each prediction.labels as lab, i}
        {#if xBand(lab) !== undefined}
          <line x1={xBand(lab)! - 4} x2={xBand(lab)! + xBand.bandwidth() + 4} y1={yScale(prediction.values[i])} y2={yScale(prediction.values[i])} class="pred" />
          <text x={xBand(lab)! + xBand.bandwidth() / 2} y={yScale(prediction.values[i]) - 6} text-anchor="middle" class="pred-label">{predictLabel} {prediction.values[i]}</text>
        {/if}
      {/each}
    {:else if prediction?.kind === 'curve'}
      <path d={predPath} class="pred" fill="none" />
    {/if}
    {#each morePredictions as m, i}
      {#if extra[i] !== null && (!logX || extra[i]! > 0)}
        {@const off = (prediction?.kind === 'number' ? 1 : 0) + i}
        <line x1={xOf(extra[i]!)} x2={xOf(extra[i]!)} y1={M.t} y2={height - M.b} class="pred" />
        <text x={xOf(extra[i]!) + 4} y={M.t + 12 + (markers.length + off) * 16} class="pred-label">{m.label}：{extra[i]}</text>
      {/if}
    {/each}
  </svg>

  <div class="below">
    <p class="source">
      資料來源：{#if source.url}<a href={source.url} rel="noopener" target="_blank">{source.text}</a>{:else}{source.text}{/if}{source.sample ? `；樣本：${source.sample}` : ''}{source.year ? `；${source.year}` : ''}
    </p>
    <div class="buttons">
      {#if !shown}<button type="button" onclick={() => (shown = true)}>直接揭曉</button>{/if}
      <button type="button" aria-expanded={showTable} aria-controls="{uid}-tbl" onclick={() => (showTable = !showTable)}>{showTable ? '收起數字' : '看數字'}</button>
    </div>
  </div>
  <div id="{uid}-tbl" hidden={!showTable} class="table-wrap">
    <table>
      <thead><tr><th>{series.length > 1 ? '系列' : ''}</th><th>{xLabel}</th><th>{yLabel}</th></tr></thead>
      <tbody>
        {#each series as s}{#each s.points as p}<tr><td>{series.length > 1 ? s.name : (p.label ?? '')}</td><td class="num">{p.x}</td><td class="num">{fmt(p.y)}</td></tr>{/each}{/each}
      </tbody>
    </table>
  </div>
</figure>

<style>
  .reveal { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); }
  .title { font-family: var(--font-display); font-weight: 600; font-size: 18px; margin-bottom: var(--space-2); }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  .grid { stroke: var(--line); }
  .axis { stroke: var(--muted); }
  .tick { font-size: 11px; fill: var(--muted); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .axis-label { font-size: 12px; fill: var(--muted); }
  .bar { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); transition: transform 700ms ease-in-out; }
  .line { fill: none; stroke-width: 2.5; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1400ms ease-in-out; }
  .dot { opacity: 0; transition: opacity 400ms ease-in-out 900ms; }
  .scatter { transition-duration: 400ms; fill-opacity: 0.75; }
  .ci { stroke-width: 1.5; opacity: 0; transition: opacity 400ms ease-in-out 900ms; }
  .shown .ci { opacity: 0.6; }
  .series-label, .marker-label { font-size: 12px; opacity: 0; transition: opacity 400ms 1200ms; }
  .marker { stroke: var(--ink); stroke-width: 1; opacity: 0; transition: opacity 400ms 900ms; }
  .marker-label { fill: var(--ink); }
  .shown .bar { transform: scaleY(1); }
  .shown .line { stroke-dashoffset: 0; }
  .shown .dot, .shown .series-label, .shown .marker, .shown .marker-label { opacity: 1; }
  :global(.instant) .bar, :global(.instant) .line, :global(.instant) .dot, :global(.instant) .marker, :global(.instant) .marker-label, :global(.instant) .series-label { transition: none !important; }
  .legend { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); font-size: 13px; color: var(--muted); }
  .legend li { display: inline-flex; align-items: center; gap: 6px; }
  .swatch { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
  .swatch.dash { background: repeating-linear-gradient(90deg, var(--signal) 0 5px, transparent 5px 8px); }
  .pred { stroke: var(--signal); stroke-width: 2; stroke-dasharray: 6 4; fill: none; }
  .pred-label { font-size: 12px; fill: var(--signal); font-weight: 500; }
  .below { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--space-2); margin-top: var(--space-2); }
  .source { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.6; flex: 1 1 260px; }
  .buttons { display: flex; gap: var(--space-2); }
  button { font: inherit; font-size: 13px; color: var(--accent); background: none; border: 1px solid var(--line); border-radius: 8px; padding: 2px 10px; min-height: 30px; cursor: pointer; }
  .table-wrap { overflow-x: auto; margin-top: var(--space-2); }
  table { border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 2px 12px 2px 0; border-bottom: 1px solid var(--line); }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
</style>
