<script lang="ts">
  // 第 3 章場景 A 右側：聚集係數 C(t) 和「同樣人數、同樣連結數的隨機網路」的 C 隨學期變化。
  interface Props {
    /** 每天結束時的值 */
    series: { day: number; C: number; R: number }[];
    /** 目前播到第幾天（0 起算）；之後的部分不畫 */
    day: number;
    totalDays: number;
  }
  let { series, day, totalDays }: Props = $props();

  const W = 360, H = 170, M = { l: 34, r: 10, t: 12, b: 30 };
  const shown = $derived(series.filter((p) => p.day <= day));
  const yMax = $derived(Math.max(0.2, Math.ceil(Math.max(...series.map((p) => Math.max(p.C, p.R)), 0) * 10) / 10));
  const x = (d: number) => M.l + (d / Math.max(1, totalDays - 1)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / yMax) * (H - M.t - M.b);
  const path = (key: 'C' | 'R') => shown.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p[key]).toFixed(1)}`).join('');
  const last = $derived(shown.at(-1));
  const weeks = $derived(Array.from({ length: Math.floor(totalDays / 28) + 1 }, (_, i) => i * 28).filter((d) => d < totalDays));
  const ratio = $derived(last && last.R > 0 ? last.C / last.R : null);
</script>

<figure class="cc">
  <svg viewBox="0 0 {W} {H}" role="img"
    aria-label="聚集係數隨時間的變化。{last ? `目前 C = ${last.C.toFixed(2)}，同樣連結數的隨機網路約 ${last.R.toFixed(2)}。` : '還沒有資料。'}">
    {#each [0, yMax / 2, yMax] as t}
      <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} class="grid" />
      <text x={M.l - 5} y={y(t) + 3.5} text-anchor="end" class="tick">{+t.toFixed(2)}</text>
    {/each}
    {#each weeks as d}<text x={x(d)} y={H - M.b + 13} text-anchor="middle" class="tick">第 {d / 7 + 1} 週</text>{/each}
    <text x={(M.l + W - M.r) / 2} y={H - 3} text-anchor="middle" class="axis-label">學期進度</text>
    <path d={path('R')} class="rand" />
    <path d={path('C')} class="real" />
    {#if last}
      <circle cx={x(last.day)} cy={y(last.C)} r="3.5" class="dot" />
      <text x={Math.min(x(last.day) + 5, W - M.r - 40)} y={y(last.C) - 6} class="lab real-l">C</text>
      <text x={Math.min(x(last.day) + 5, W - M.r - 40)} y={y(last.R) + 13} class="lab rand-l">隨機</text>
    {/if}
  </svg>
  <figcaption>
    {#if last}
      聚集係數 <b>{last.C.toFixed(2)}</b>；同樣連結數的隨機網路約 <b>{last.R.toFixed(2)}</b>{ratio !== null && ratio > 1.05 ? `，是隨機的 ${ratio.toFixed(1)} 倍` : ''}。
    {:else}
      學期開始後，曲線會一天一天畫出來。
    {/if}
  </figcaption>
</figure>

<style>
  .cc { margin: 0; }
  svg { display: block; width: 100%; height: auto; max-height: 190px; }
  .grid { stroke: var(--line); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .axis-label { font-size: 11px; fill: var(--muted); }
  .real { fill: none; stroke: var(--accent); stroke-width: 2.5; }
  .rand { fill: none; stroke: var(--muted); stroke-width: 2; stroke-dasharray: 5 4; }
  .dot { fill: var(--accent); }
  .lab { font-size: 11px; }
  .real-l { fill: var(--accent); font-weight: 600; }
  .rand-l { fill: var(--muted); }
  figcaption { font-size: 13px; color: var(--muted); }
  figcaption b { color: var(--ink); font-family: var(--font-mono); font-weight: 500; }
</style>
