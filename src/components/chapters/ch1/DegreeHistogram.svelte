<script lang="ts">
  // 第 1 章：即時度分布直方圖，標出平均數與中位數；選了某個人時，把他那一格標成 --signal。
  interface Props {
    degrees: number[];
    /** 要強調的度（例如「你」的朋友數） */
    mark?: number | null;
    /** x 軸至少畫到多少，讓切換社交性差異時尺度不要一直跳 */
    minMax?: number;
  }
  let { degrees, mark = null, minMax = 20 }: Props = $props();

  const W = 360, H = 150, M = { l: 30, r: 8, t: 34, b: 30 };
  const lx = (v: number) => Math.max(M.l + 30, Math.min(W - M.r - 30, v));
  const stats = $derived.by(() => {
    const n = degrees.length;
    if (!n) return { counts: Array.from({ length: minMax + 1 }, () => 0), mean: 0, median: 0, max: 0, top: 1 };
    const max = Math.max(...degrees);
    const counts = Array.from({ length: Math.max(max, minMax) + 1 }, () => 0);
    for (const k of degrees) counts[k] += 1;
    const sorted = [...degrees].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const mean = degrees.reduce((s, k) => s + k, 0) / n;
    return { counts, mean, median, max, top: Math.max(...counts) };
  });
  const bw = $derived((W - M.l - M.r) / stats.counts.length);
  const x = (k: number) => M.l + (k + 0.5) * bw;
  const yTop = $derived(Math.max(4, Math.ceil(stats.top / 4) * 4));
  const y = (c: number) => H - M.b - (c / yTop) * (H - M.t - M.b);
  const xTicks = $derived(stats.counts.map((_, k) => k).filter((k) => k % (stats.counts.length > 30 ? 10 : 5) === 0));
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
</script>

<figure class="hist">
  <svg viewBox="0 0 {W} {H}" role="img"
    aria-label="朋友數的分布：{degrees.length} 人，平均 {fmt(stats.mean)} 位，中位數 {fmt(stats.median)} 位，最多 {stats.max} 位。{mark !== null ? `你有 ${mark} 位。` : ''}">
    {#each [0, yTop / 2, yTop] as t}
      <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} class="grid" />
      <text x={M.l - 5} y={y(t) + 3.5} text-anchor="end" class="tick">{t}</text>
    {/each}
    {#each stats.counts as c, k}
      {#if c > 0}
        <rect x={M.l + k * bw + 0.5} width={Math.max(1, bw - 1)} y={y(c)} height={H - M.b - y(c)} class="bar" class:me={mark === k} />
      {/if}
    {/each}
    {#each xTicks as k}<text x={x(k)} y={H - M.b + 13} text-anchor="middle" class="tick">{k}</text>{/each}
    <text x={(M.l + W - M.r) / 2} y={H - 3} text-anchor="middle" class="axis-label">朋友數（度）</text>
    <text x={M.l - 5} y={M.t - 9} text-anchor="end" class="axis-label">人數</text>

    <!-- 標籤分兩排（平均在上、中位數在下），並夾在圖內，靠很近或貼邊都不會被切掉 -->
    <line x1={x(stats.median)} x2={x(stats.median)} y1={M.t - 6} y2={H - M.b} class="median" />
    <text x={lx(x(stats.median))} y={M.t - 9} text-anchor="middle" class="lab">中位數 {fmt(stats.median)}</text>
    <line x1={x(stats.mean)} x2={x(stats.mean)} y1={M.t - 18} y2={H - M.b} class="mean" />
    <text x={lx(x(stats.mean))} y={M.t - 21} text-anchor="middle" class="lab">平均 {fmt(stats.mean)}</text>
  </svg>
  <figcaption>平均 <b>{fmt(stats.mean)}</b>、中位數 <b>{fmt(stats.median)}</b>、最多 <b>{stats.max}</b> 位</figcaption>
</figure>

<style>
  .hist { margin: 0; }
  svg { display: block; width: 100%; height: auto; max-height: 170px; }
  .grid { stroke: var(--line); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .axis-label { font-size: 11px; fill: var(--muted); }
  .bar { fill: var(--accent); opacity: 0.85; }
  .bar.me { fill: var(--signal); opacity: 1; }
  .mean { stroke: var(--ink); stroke-width: 1.5; }
  .median { stroke: var(--ink); stroke-width: 1.5; stroke-dasharray: 4 3; }
  .lab { font-size: 11px; fill: var(--ink); }
  figcaption { font-size: 13px; color: var(--muted); }
  figcaption b { color: var(--ink); font-family: var(--font-mono); font-weight: 500; }
  @media (prefers-reduced-motion: no-preference) { .bar { transition: y 200ms ease-out, height 200ms ease-out; } }
</style>
