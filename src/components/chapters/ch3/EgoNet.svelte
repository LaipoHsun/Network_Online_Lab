<script lang="ts">
  // 第 3 章場景 B：只留下一個人和他的朋友。朋友之間已經存在的連結是實線（分子 L_i），
  // 可能存在但還沒有的是虛線；實線 + 虛線 = k_i(k_i − 1)/2（分母）。
  // 下方小圖：每個人的 (k_i, C_i)，選到的人標成 --signal。
  import { type Graph, clustering } from '../../../lib/network';

  interface Props { g: Graph; center: number; names: string[] }
  let { g, center, names }: Props = $props();

  const friends = $derived(g.adj[center] ?? []);
  const k = $derived(friends.length);
  const pairs = $derived.by(() => {
    const out: { a: number; b: number; on: boolean }[] = [];
    const set = new Set(friends);
    for (let x = 0; x < friends.length; x++) for (let y = x + 1; y < friends.length; y++) {
      const a = friends[x], b = friends[y];
      out.push({ a: x, b: y, on: g.adj[a].includes(b) && set.has(b) });
    }
    return out;
  });
  const Li = $derived(pairs.filter((p) => p.on).length);
  const possible = $derived((k * (k - 1)) / 2);
  const Ci = $derived(possible ? Li / possible : 0);
  const allC = $derived(clustering(g));

  const S = 220, R = 80, c = S / 2;
  const pos = $derived(friends.map((_, i) => ({
    x: c + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, k)),
    y: c + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, k)),
  })));

  // (k, C) 散布圖
  const PW = 220, PH = 120, P = { l: 30, r: 8, t: 8, b: 26 };
  const kMax = $derived(Math.max(4, ...g.adj.map((a) => a.length)));
  const px = (v: number) => P.l + (v / kMax) * (PW - P.l - P.r);
  const py = (v: number) => PH - P.b - v * (PH - P.t - P.b);
</script>

<div class="ego">
  <svg viewBox="0 0 {S} {S}" class="net" role="img"
    aria-label="{names[center]}和 {k} 位朋友：朋友之間有 {Li} 條連結，最多可能有 {possible} 條。">
    {#each pairs as p}
      {#if !p.on}<line x1={pos[p.a].x} y1={pos[p.a].y} x2={pos[p.b].x} y2={pos[p.b].y} class="miss" />{/if}
    {/each}
    {#each pos as q}<line x1={c} y1={c} x2={q.x} y2={q.y} class="spoke" />{/each}
    {#each pairs as p}
      {#if p.on}<line x1={pos[p.a].x} y1={pos[p.a].y} x2={pos[p.b].x} y2={pos[p.b].y} class="on" />{/if}
    {/each}
    {#each pos as q, i}
      <circle cx={q.x} cy={q.y} r="7" class="friend" />
      <text x={q.x} y={q.y + (q.y > c ? 19 : -11)} text-anchor="middle" class="nm">{names[friends[i]].slice(-2)}</text>
    {/each}
    <circle cx={c} cy={c} r="10" class="me" />
    <text x={c} y={c + 24} text-anchor="middle" class="nm me-t">{names[center]}</text>
  </svg>

  <div class="nums">
    <p class="formula">
      <span><b class="on-t">{Li}</b> 條實線</span> ÷ <span><b>{possible}</b> 條可能的連結</span> = <b class="c">C = {possible ? Ci.toFixed(2) : '—'}</b>
    </p>
    <p class="note">{k < 2 ? '朋友少於兩位時，聚集係數沒有定義。' : `${k} 位朋友兩兩配對有 ${k} × ${k - 1} ÷ 2 = ${possible} 種；實線是已經認識的，虛線是還不認識的。`}</p>
    <svg viewBox="0 0 {PW} {PH}" class="scatter" role="img" aria-label="每個人的朋友數和聚集係數">
      {#each [0, 0.5, 1] as t}
        <line x1={P.l} x2={PW - P.r} y1={py(t)} y2={py(t)} class="grid" />
        <text x={P.l - 4} y={py(t) + 3} text-anchor="end" class="tick">{t}</text>
      {/each}
      {#each g.adj as a, i}
        {#if a.length >= 2 && i !== center}<circle cx={px(a.length)} cy={py(allC[i])} r="2.6" class="pt" />{/if}
      {/each}
      {#if k >= 2}<circle cx={px(k)} cy={py(Ci)} r="5" class="pt-me" />{/if}
      <text x={(P.l + PW - P.r) / 2} y={PH - 4} text-anchor="middle" class="axis-label">朋友數 k</text>
      <text x={4} y={P.t + 2} class="axis-label" dominant-baseline="hanging">C</text>
    </svg>
  </div>
</div>

<style>
  .ego { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
  .net { width: min(240px, 100%); flex: 0 1 auto; }
  .miss { stroke: var(--muted); stroke-width: 1.2; stroke-dasharray: 3 3; opacity: 0.7; }
  .spoke { stroke: var(--line); stroke-width: 1.5; }
  .on { stroke: var(--accent); stroke-width: 2.5; }
  .friend { fill: var(--panel); stroke: var(--accent); stroke-width: 2; }
  .me { fill: var(--signal); }
  .nm { font-size: 10px; fill: var(--ink); }
  .me-t { font-weight: 600; }
  .nums { flex: 1 1 200px; min-width: 0; }
  .formula { margin: 0; font-size: 15px; line-height: 1.8; }
  .formula b { font-family: var(--font-mono); }
  .on-t { color: var(--accent); }
  .c { color: var(--ink); }
  .note { margin: var(--space-1) 0 var(--space-2); font-size: 12px; color: var(--muted); }
  .scatter { width: 100%; max-width: 280px; display: block; }
  .grid { stroke: var(--line); }
  .tick { font-size: 9px; fill: var(--muted); font-family: var(--font-mono); }
  .axis-label { font-size: 10px; fill: var(--muted); }
  .pt { fill: var(--muted); opacity: 0.6; }
  .pt-me { fill: var(--signal); }
</style>
