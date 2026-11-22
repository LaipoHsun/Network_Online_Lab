<script lang="ts">
  // 第 4 章場景 B 下方：⟨d⟩(p)/⟨d⟩(0) 與 C(p)/C(0)，x 為對數軸，標出目前的 p。
  interface Props { curve: { p: number; d: number; C: number }[]; p: number }
  let { curve, p }: Props = $props();
  const W = 360, H = 200, M = { l: 34, r: 10, t: 14, b: 34 };
  const lo = -3, hi = 0;
  const x = (v: number) => M.l + ((Math.log10(v) - lo) / (hi - lo)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - v * (H - M.t - M.b);
  const line = (k: 'd' | 'C') => curve.map((q, i) => `${i ? 'L' : 'M'}${x(q.p).toFixed(1)} ${y(q[k]).toFixed(1)}`).join('');
  const mx = $derived(p > 0 ? x(Math.max(p, 1e-3)) : M.l);
</script>

<figure class="ws">
  <figcaption class="t">距離先掉、三角形後掉</figcaption>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="平均距離和聚集係數相對於格子的比例，隨抽卡成功率 p 變化。目前 p = {p}。">
    {#each [0, 0.5, 1] as t}
      <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} class="grid" />
      <text x={M.l - 5} y={y(t) + 3.5} text-anchor="end" class="tick">{t}</text>
    {/each}
    {#each [0.001, 0.01, 0.1, 1] as t}<text x={x(t)} y={H - M.b + 13} text-anchor="middle" class="tick">{t}</text>{/each}
    <text x={(M.l + W - M.r) / 2} y={H - 4} text-anchor="middle" class="axis">抽卡成功率 p（對數尺度）</text>
    {#if curve.length}
      <path d={line('C')} class="c" />
      <path d={line('d')} class="d" />
      {#each curve as q}<circle cx={x(q.p)} cy={y(q.C)} r="2.5" class="cdot" /><circle cx={x(q.p)} cy={y(q.d)} r="2.5" class="ddot" />{/each}
    {:else}
      <text x={W / 2} y={H / 2} text-anchor="middle" class="tick">計算中…</text>
    {/if}
    <line x1={mx} x2={mx} y1={M.t} y2={H - M.b} class="now" />
    <text x={mx + 4} y={M.t + 10} class="now-l">{p > 0 ? `p = ${p}` : 'p = 0（格子）'}</text>
  </svg>
  <ul class="legend">
    <li><span class="sw c-sw"></span>聚集係數 C(p) / C(0)</li>
    <li><span class="sw d-sw"></span>平均距離 ⟨d⟩(p) / ⟨d⟩(0)</li>
  </ul>
  <p class="note">這張圖用比較大的網路（400 人、每人認識 10 位）、每個 p 平均 8 次，形狀比上面 60 人的圈清楚。</p>
</figure>

<style>
  .ws { margin: 0; }
  .t { font-family: var(--font-display); font-weight: 600; font-size: 16px; margin-bottom: 4px; }
  svg { display: block; width: 100%; height: auto; }
  .grid { stroke: var(--line); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .axis { font-size: 11px; fill: var(--muted); }
  .c { fill: none; stroke: var(--college-socsci); stroke-width: 2.5; }
  .d { fill: none; stroke: var(--accent); stroke-width: 2.5; }
  .cdot { fill: var(--college-socsci); }
  .ddot { fill: var(--accent); }
  .now { stroke: var(--signal); stroke-width: 1.5; stroke-dasharray: 4 3; }
  .now-l { font-size: 11px; fill: var(--signal); }
  .legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12px; color: var(--muted); }
  .legend li { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
  .c-sw { background: var(--college-socsci); }
  .d-sw { background: var(--accent); }
  .note { margin: 4px 0 0; font-size: 11px; color: var(--muted); }
</style>
