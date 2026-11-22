<script lang="ts">
  // 第 4 章場景（docs/chapters/04-small-world.md ③）。
  // mode="intro"：第 ① 段，60 位小人圍成一圈，偶爾有一條午夜抽卡的捷徑。
  // mode="lattice"：場景 A，只認識同系、隔壁的人（p = 0）。點兩個人，看信沿最短路徑飛過去。
  // mode="ws"：場景 B，調「抽卡成功率」p；下方是 ⟨d⟩(p)/⟨d⟩(0) 與 C(p)/C(0) 的對數軸曲線。
  import { onMount } from 'svelte';
  import { bfsLayers, shortestPath, type Graph } from '../../../lib/network';
  import { renderCharacter } from '../../../lib/sprites/character';
  import { emitLive } from '../../../lib/ui/bus';
  import { prefersReducedMotion } from '../../../lib/ui/theme';
  import { CURVE_PS, deptOf, K, makePeople, N, networkAt, P_LEVELS, stats, wsCurve, YIZHEN } from './model';
  import WSChart from './WSChart.svelte';

  interface Props { mode?: 'intro' | 'lattice' | 'ws' }
  let { mode = 'ws' }: Props = $props();

  const people = makePeople();
  const S = 640, R = 262, c = S / 2;
  const pos = people.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
    return { x: c + R * Math.cos(a), y: c + R * Math.sin(a), a };
  });
  const sprites = people.map((p) => renderCharacter(p.look, 'idle', { size: 26, title: `${p.name}（${p.dept}）` }));

  let pIdx = $state(mode === 'intro' ? 3 : 0);
  const p = $derived(mode === 'lattice' ? 0 : P_LEVELS[pIdx]);
  const net = $derived(networkAt(p));
  const g: Graph = $derived(net.graph);
  const st = $derived(stats(g));
  const shortcutSet = $derived(new Set(net.shortcuts.map(([a, b]) => `${a}-${b}`)));
  let prevShortcuts = new Set<string>();
  let fresh = $state(new Set<string>());

  let from = $state(YIZHEN);
  let to = $state(N / 2);
  let path = $state<number[]>([]);
  let rippleT = $state(-1);       // BFS 漣漪已經擴散到第幾層
  let letterT = $state(-1);       // 信走到 path 的第幾段（小數 = 段內位置）
  let dist = $state<number[]>([]);
  let raf = 0;
  let curve = $state<{ p: number; d: number; C: number }[]>([]);
  let announce = $state('');

  const edges = $derived.by(() => {
    const out: { a: number; b: number; short: boolean; key: string }[] = [];
    g.adj.forEach((nb, a) => nb.forEach((b) => { if (a < b) out.push({ a, b, short: shortcutSet.has(`${a}-${b}`), key: `${a}-${b}` }); }));
    return out;
  });
  const onPath = $derived(new Set(path.slice(1).map((v, i) => (path[i] < v ? `${path[i]}-${v}` : `${v}-${path[i]}`))));

  // 午夜抽卡：p 變大時，新出現的捷徑閃一下
  $effect(() => {
    const now = shortcutSet;
    const f = new Set([...now].filter((k) => !prevShortcuts.has(k)));
    prevShortcuts = now;
    fresh = f;
    if (f.size && !prefersReducedMotion()) setTimeout(() => { if (fresh === f) fresh = new Set(); }, 1600);
    emitLive({ d: st.d, C: st.C, N, K, lattice: N / (2 * K), random: Math.log(N) / Math.log(K) }, 'ch4');
    cancelAnimationFrame(raf); path = []; rippleT = -1; letterT = -1;
  });

  function send() {
    cancelAnimationFrame(raf);
    const layers = bfsLayers(g, from);
    dist = new Array(N).fill(-1);
    layers.forEach((l, d) => l.forEach((v) => (dist[v] = d)));
    path = shortestPath(g, from, to) ?? [];
    const d = path.length - 1;
    announce = path.length ? `${people[from].name}寄給${people[to].name}：最短路徑 ${d} 步，中間經過 ${Math.max(0, d - 1)} 個人。` : '到不了。';
    if (prefersReducedMotion()) { rippleT = layers.length; letterT = d; return; }
    const t0 = performance.now(), RIP = 220, SEG = 380, rippleEnd = layers.length * RIP;
    const tick = (now: number) => {
      const t = now - t0;
      rippleT = Math.min(layers.length, t / RIP);
      letterT = t < rippleEnd ? -1 : Math.min(d, (t - rippleEnd) / SEG);
      if (letterT < d) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function pick(i: number) {
    to = i;
    if (to === from) return;
    send();
  }

  const letterPos = $derived.by(() => {
    if (letterT < 0 || !path.length) return null;
    const i = Math.min(path.length - 2, Math.floor(letterT)), f = letterT - i;
    if (path.length === 1) return pos[path[0]];
    const a = pos[path[i]], b = pos[path[i + 1]];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  });

  onMount(() => {
    if (mode === 'ws') setTimeout(() => (curve = wsCurve(CURVE_PS)), 50);
    if (mode === 'intro') setTimeout(() => { from = YIZHEN; to = 33; send(); }, 600);
    return () => cancelAnimationFrame(raf);
  });

  const deptLabels = [0, 10, 20, 30, 40, 50].map((i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * (i + 4.5)) / N;
    return { x: c + (R + 44) * Math.cos(a), y: c + (R + 44) * Math.sin(a), t: deptOf(i) };
  });
</script>

<div class="ring" class:wide={mode === 'ws'}>
  <div class="stage">
    <svg viewBox="0 0 {S} {S}" role="img"
      aria-label="{N} 位學生圍成一圈，每人認識左右各 {K / 2} 位{p > 0 ? `，另有 ${net.shortcuts.length} 條午夜抽卡的捷徑` : ''}。平均距離 {st.d.toFixed(2)} 步。">
      {#each deptLabels as l}<text x={l.x} y={l.y} text-anchor="middle" class="dept">{l.t}</text>{/each}
      {#each edges as e (e.key)}
        <line x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y}
          class="edge" class:short={e.short} class:fresh={fresh.has(e.key)} class:path={onPath.has(e.key) && letterT >= 0} />
      {/each}
      {#each pos as q, i}
        {@const d = dist[i] ?? -1}
        <g class="person" class:reached={d >= 0 && d <= rippleT && rippleT >= 0} class:ends={i === from || (path.length && i === to)}
          transform="translate({q.x - 13} {q.y - 17})" role="button" tabindex="-1" aria-label="寄給{people[i].name}"
          onclick={() => pick(i)} onkeydown={(e) => { if (e.key === 'Enter') pick(i); }}>
          <circle cx="13" cy="17" r="17" class="halo" />
          {@html sprites[i]}
        </g>
      {/each}
      {#if letterPos}
        <g transform="translate({letterPos.x - 10} {letterPos.y - 30})" class="letter" aria-hidden="true">
          <rect width="20" height="14" rx="2" /><polyline points="0,0 10,8 20,0" />
        </g>
      {/if}
      <text x={c} y={c - 10} text-anchor="middle" class="big">⟨d⟩ = {st.d.toFixed(2)}</text>
      <text x={c} y={c + 16} text-anchor="middle" class="small">平均距離（步）· C = {st.C.toFixed(2)}</text>
      {#if path.length > 1 && letterT >= path.length - 1}
        <text x={c} y={c + 44} text-anchor="middle" class="small hit">這封信走了 {path.length - 1} 步</text>
      {/if}
    </svg>
  </div>

  {#if mode !== 'intro'}
  <div class="panel">
    {#if mode === 'ws'}
      <label class="slider">
        <span>抽卡成功率 p：<b>{p}</b>（{net.shortcuts.length} 條捷徑）</span>
        <input type="range" min="0" max={P_LEVELS.length - 1} step="1" bind:value={pIdx}
          aria-valuetext="p = {p}，{net.shortcuts.length} 條捷徑" />
      </label>
    {/if}
      <div class="row">
        <label>寄件人 <select bind:value={from}>{#each people as q, i}<option value={i}>{q.name}（{q.dept}）</option>{/each}</select></label>
        <label>收件人 <select bind:value={to}>{#each people as q, i}<option value={i}>{q.name}（{q.dept}）</option>{/each}</select></label>
        <button type="button" class="go" onclick={send} disabled={from === to}>寄信</button>
      </div>
      <p class="now" aria-live="polite">{announce || '選好寄件人和收件人按「寄信」，或直接點圈上的任何一位小人。綠色漣漪是 BFS：一層一層找出每個人離寄件人幾步。'}</p>
    {#if mode === 'ws'}
      <WSChart {curve} {p} />
    {/if}
  </div>
  {/if}
</div>

<style>
  .ring { display: flex; flex-direction: column; gap: var(--space-2); }
  @media (min-width: 960px) {
    .ring.wide { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(300px, 1fr); align-items: start; gap: var(--space-4); }
  }
  .stage { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
  svg { display: block; width: 100%; height: auto; max-height: 78vh; }
  .dept { font-size: 15px; fill: var(--muted); }
  .edge { stroke: var(--line); stroke-width: 2; }
  .edge.short { stroke: var(--accent); stroke-width: 1.6; opacity: 0.8; }
  .edge.fresh { stroke: var(--signal); stroke-width: 3; opacity: 1; }
  .edge.path { stroke: var(--signal); stroke-width: 4; opacity: 1; }
  .person { cursor: pointer; }
  .halo { fill: transparent; }
  .person.reached .halo { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.5; }
  .person.ends .halo { fill: var(--signal-soft); stroke: var(--signal); stroke-width: 2; }
  .letter rect { fill: var(--panel); stroke: var(--signal); stroke-width: 2; }
  .letter polyline { fill: none; stroke: var(--signal); stroke-width: 1.5; }
  .big { font-family: var(--font-mono); font-size: 34px; fill: var(--ink); }
  .small { font-size: 15px; fill: var(--muted); }
  .hit { fill: var(--signal); font-weight: 600; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; font-size: 13px; color: var(--muted); }
  select { font: inherit; font-size: 13px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px; max-width: 150px; }
  button { font: inherit; font-size: 14px; border-radius: 8px; padding: 4px 14px; min-height: 34px; cursor: pointer; }
  .go { background: var(--signal); border: 1px solid var(--signal); color: var(--panel); }
  .go:disabled { opacity: 0.5; cursor: default; }
  .slider { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .slider b { font-family: var(--font-mono); }
  input[type="range"] { width: 100%; accent-color: var(--accent); }
  .now { margin: 0; font-size: 14px; line-height: 1.7; }
  @media (prefers-reduced-motion: no-preference) { .edge.fresh { transition: stroke 600ms; } }
</style>
