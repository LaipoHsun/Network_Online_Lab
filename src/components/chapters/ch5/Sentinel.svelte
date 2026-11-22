<script lang="ts">
  // 第 5 章場景 C：期末流感哨兵。從 600 人的網路抽出隨機組（60 人）和朋友組（隨機組每人提名一位朋友），
  // 放很多場流感，畫兩組的平均累積感染比例。朋友組比較早被感染：這是第 9 章傳染的預告。
  import { onMount } from 'svelte';
  import { FLU, sentinelCurves, sentinelSetup } from './model';

  const setup = sentinelSetup();
  const STEPS = 40;
  let batches = $state(0);
  let curves = $state<{ random: number[]; friend: number[]; runs: number } | null>(null);
  const meanDeg = (grp: number[]) => grp.reduce((s, i) => s + setup.g.adj[i].length, 0) / grp.length;

  function more() {
    const c = sentinelCurves(setup, 40, 100 + batches, STEPS);
    if (!curves) curves = c;
    else {
      const n0 = curves.runs, n1 = c.runs, n = Math.max(1, n0 + n1);
      curves = {
        random: curves.random.map((v, i) => (v * n0 + c.random[i] * n1) / n),
        friend: curves.friend.map((v, i) => (v * n0 + c.friend[i] * n1) / n),
        runs: n0 + n1,
      };
    }
    batches += 1;
  }
  onMount(() => { setTimeout(more, 50); });

  const W = 340, H = 190, M = { l: 34, r: 10, t: 12, b: 32 };
  const x = (t: number) => M.l + (t / STEPS) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - v * (H - M.t - M.b);
  const path = (xs: number[]) => xs.map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const reach = (xs: number[], level: number) => xs.findIndex((v) => v >= level);
  const lead = $derived(curves ? reach(curves.random, 0.25) - reach(curves.friend, 0.25) : 0);
</script>

<div class="sentinel">
  <svg viewBox="0 0 {W} {H}" role="img"
    aria-label="兩組的平均累積感染比例。{curves ? `朋友組比隨機組早約 ${lead} 步達到 25%。` : '計算中。'}">
    {#each [0, 0.25, 0.5, 0.75, 1] as t}
      <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} class="grid" />
      <text x={M.l - 5} y={y(t) + 3.5} text-anchor="end" class="tick">{t * 100}%</text>
    {/each}
    {#each [0, 10, 20, 30, 40] as t}<text x={x(t)} y={H - M.b + 13} text-anchor="middle" class="tick">{t}</text>{/each}
    <text x={(M.l + W - M.r) / 2} y={H - 3} text-anchor="middle" class="axis">流感開始後的天數（模擬的步）</text>
    {#if curves}
      <path d={path(curves.random)} class="rand" />
      <path d={path(curves.friend)} class="fr" />
      <line x1={M.l} x2={W - M.r} y1={y(0.25)} y2={y(0.25)} class="lvl" />
    {/if}
  </svg>
  <ul class="legend">
    <li><span class="sw fr-sw"></span>朋友組（平均 {meanDeg(setup.friendGroup).toFixed(1)} 位朋友）</li>
    <li><span class="sw rand-sw"></span>隨機組（平均 {meanDeg(setup.randomGroup).toFixed(1)} 位朋友）</li>
  </ul>
  <p class="now" aria-live="polite">
    {#if curves}
      已經放了 {curves.runs} 場流感。朋友組比隨機組早約 <b>{lead}</b> 步達到 25% 的人發病；到最後，朋友組也有更多人被感染。
    {:else}計算中…{/if}
  </p>
  <button type="button" onclick={more}>再放 40 場流感</button>
  <p class="note">{FLU.n} 人的網路；隨機組 {FLU.group} 人，朋友組是隨機組每人提名的一位朋友。每場流感從 3 個隨機的人開始，只計入有流行起來的場次。</p>
</div>

<style>
  .sentinel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  svg { display: block; width: 100%; height: auto; }
  .grid { stroke: var(--line); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .axis { font-size: 11px; fill: var(--muted); }
  .rand { fill: none; stroke: var(--muted); stroke-width: 2.5; stroke-dasharray: 6 4; }
  .fr { fill: none; stroke: var(--ill); stroke-width: 2.5; }
  .lvl { stroke: var(--signal); stroke-dasharray: 2 3; }
  .legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12px; color: var(--muted); }
  .legend li { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 14px; height: 3px; display: inline-block; }
  .fr-sw { background: var(--ill); }
  .rand-sw { background: var(--muted); }
  .now { margin: 0; font-size: 14px; line-height: 1.7; }
  .now b { font-family: var(--font-mono); }
  button { align-self: flex-start; font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; min-height: 34px; cursor: pointer; }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
</style>
