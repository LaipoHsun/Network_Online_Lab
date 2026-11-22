<script lang="ts">
  // 第 5 章場景 B：兩種抽樣各抽 200 次，直方圖並排。
  // 「隨機點一個人」抽到的朋友數平均就是 ⟨k⟩；「隨機點一條連結、取它的一端」平均是 ⟨k²⟩/⟨k⟩。
  import { onMount } from 'svelte';
  import { seededRandom } from '../../../lib/sim/random';
  import { prefersReducedMotion } from '../../../lib/ui/theme';
  import { networkAt, paradoxStats, sampleEdgeEnds, sampleNodes, SPREADS } from './model';

  const g = networkAt(SPREADS[3].value);
  const st = paradoxStats(g);
  const kMax = Math.max(...g.adj.map((a) => a.length));
  let round = 0;
  let a = $state<number[]>([]), b = $state<number[]>([]);
  let raf = 0;

  function draw() {
    cancelAnimationFrame(raf);
    round += 1;
    const rng = seededRandom(500 + round);
    const all = { a: sampleNodes(g, 200, rng).map((i) => g.adj[i].length), b: sampleEdgeEnds(g, 200, rng).map((i) => g.adj[i].length) };
    if (prefersReducedMotion()) { a = all.a; b = all.b; return; }
    let shown = 0;
    const tick = () => {
      shown = Math.min(200, shown + 8);
      a = all.a.slice(0, shown); b = all.b.slice(0, shown);
      if (shown < 200) raf = requestAnimationFrame(tick);
    };
    tick();
  }
  onMount(() => () => cancelAnimationFrame(raf));

  const hist = (xs: number[]) => { const h = new Array(kMax + 1).fill(0); for (const k of xs) h[k]++; return h; };
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  const W = 300, Hh = 130, M = { l: 26, r: 6, t: 20, b: 26 };
  const top = $derived(Math.max(10, ...hist(a), ...hist(b)));
  const bw = (W - M.l - M.r) / (kMax + 1);
  const xk = (k: number) => M.l + (k + 0.5) * bw;
  const yv = (v: number) => Hh - M.b - (v / top) * (Hh - M.t - M.b);
</script>

<div class="sampling">
  <div class="row">
    <button type="button" class="go" onclick={draw}>{a.length ? '再抽一次（各 200 次）' : '開始抽樣（各 200 次）'}</button>
    <span class="note">這張網路的社交性差異是「大」：⟨k⟩ = {st.mean.toFixed(2)}，⟨k²⟩/⟨k⟩ = {st.friendMean.toFixed(2)}</span>
  </div>
  <div class="pair">
    {#each [{ xs: a, t: '隨機點一個人', cls: 'p' }, { xs: b, t: '隨機點一條連結，取它的一端', cls: 'e' }] as h}
      <figure>
        <figcaption>{h.t}</figcaption>
        <svg viewBox="0 0 {W} {Hh}" role="img" aria-label="{h.t}：抽了 {h.xs.length} 次，抽到的人平均有 {mean(h.xs).toFixed(2)} 位朋友。">
          <line x1={M.l} x2={W - M.r} y1={Hh - M.b} y2={Hh - M.b} class="axis" />
          {#each hist(h.xs) as c, k}
            {#if c}<rect x={M.l + k * bw + 0.5} width={Math.max(1, bw - 1)} y={yv(c)} height={Hh - M.b - yv(c)} class="bar {h.cls}" />{/if}
          {/each}
          {#each [0, 5, 10, 15, 20].filter((k) => k <= kMax) as k}<text x={xk(k)} y={Hh - M.b + 12} text-anchor="middle" class="tick">{k}</text>{/each}
          <text x={(M.l + W - M.r) / 2} y={Hh - 2} text-anchor="middle" class="tick">抽到的人的朋友數</text>
          {#if h.xs.length}
            <line x1={xk(mean(h.xs))} x2={xk(mean(h.xs))} y1={M.t - 4} y2={Hh - M.b} class="mean" />
            <text x={Math.min(xk(mean(h.xs)) + 4, W - 70)} y={M.t - 7} class="lab">平均 {mean(h.xs).toFixed(2)}</text>
          {/if}
        </svg>
      </figure>
    {/each}
  </div>
  <p class="note">第二種抽法等於「隨機挑一位某人的朋友」：朋友多的人有很多條連結，被抽到的機會也比較大。</p>
</div>

<style>
  .sampling { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .go { font: inherit; font-size: 14px; background: var(--signal); border: 1px solid var(--signal); color: var(--panel); border-radius: 8px; padding: 4px 14px; min-height: 34px; cursor: pointer; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-3); }
  figure { margin: 0; }
  figcaption { font-size: 14px; font-weight: 500; }
  svg { display: block; width: 100%; height: auto; }
  .axis { stroke: var(--muted); }
  .bar.p { fill: var(--muted); }
  .bar.e { fill: var(--college-sci); }
  .tick { font-size: 10px; fill: var(--muted); font-family: var(--font-mono); }
  .mean { stroke: var(--ink); stroke-width: 1.5; }
  .lab { font-size: 11px; fill: var(--ink); }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
</style>
