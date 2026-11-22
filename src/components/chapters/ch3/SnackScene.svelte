<script lang="ts">
  // 第 3 章場景（docs/chapters/03-triadic-closure.md ③）。
  // mode="intro"：第 ① 段，學期從頭播放。
  // mode="snack"：場景 A，一學期的宵夜 + 右側 C(t) 與隨機網路的 C。新形成三角形的三個人會被圈起來。
  // mode="ego"：場景 B，學期末的網路圖，點一位小人，旁邊只留下這個人和朋友。
  import DualView from '../../engine/DualView.svelte';
  import campus from '../../../data/campus.json';
  import { CampusSim, SLOTS_PER_DAY, type CampusLayout } from '../../../lib/sim/campus';
  import { type Graph, averageClustering, transitivity } from '../../../lib/network';
  import ClusteringChart from './ClusteringChart.svelte';
  import EgoNet from './EgoNet.svelte';
  import { ch3Script, CHENGEN, MODES } from './script';

  interface Props { mode?: 'intro' | 'snack' | 'ego' }
  let { mode = 'snack' }: Props = $props();

  const layouts = campus as unknown as { landscape: CampusLayout; portrait: CampusLayout };
  let modeIdx = $state(mode === 'ego' ? 3 : 2);
  const script = $derived(ch3Script(modeIdx));
  const totalSlots = $derived(script.weeks * 7 * SLOTS_PER_DAY);
  const totalDays = $derived(script.weeks * 7);
  let view = $state<'campus' | 'network'>(mode === 'ego' ? 'network' : 'campus');
  let day = $state(-1);
  let graph = $state<Graph | null>(null);
  let flash = $state(new Set<number>());
  let me = $state<number>(CHENGEN);

  // 整學期每天結束時的 C 和隨機網路的 C（另外跑一份同樣的模擬；模擬是確定的，結果和畫面上一致）
  const series = $derived.by(() => {
    if (mode !== 'snack') return [];
    const sim = new CampusSim(script);
    const out: { day: number; C: number; R: number }[] = [];
    for (let d = 0; d < totalDays; d++) {
      sim.seek((d + 1) * SLOTS_PER_DAY);
      const g = sim.graph();
      const L = g.adj.reduce((s, a) => s + a.length, 0) / 2;
      out.push({ day: d, C: averageClustering(g), R: (2 * L) / (g.n * (g.n - 1)) });
    }
    return out;
  });

  function onslot(sim: CampusSim) {
    const s = sim.slot - 1;
    day = Math.floor(s / SLOTS_PER_DAY) - (s % SLOTS_PER_DAY === SLOTS_PER_DAY - 1 ? 0 : 1);
    graph = sim.graph();
    // 這個時段新形成的三角形：新連結 (a, b) 的兩端有共同朋友 c
    const f = new Set<number>();
    for (const [a, b] of sim.history[s]?.newTies ?? []) {
      for (const c of sim.neighbors(a)) if (c !== b && sim.hasTie(b, c)) { f.add(a); f.add(b); f.add(c); }
    }
    flash = f;
  }

  // 公式卡（第 ④ 段）用的即時數值
  function live(g: Graph) {
    const L = g.adj.reduce((s, a) => s + a.length, 0) / 2;
    return { Cavg: averageClustering(g), Ctri: transitivity(g), Crand: (2 * L) / (g.n * (g.n - 1)), kbar: (2 * L) / g.n };
  }
</script>

<div class="scene" class:wide={mode !== 'intro'}>
  {#key modeIdx}
    <DualView {script} {layouts} bind:view
      label={mode === 'intro' ? '第 3 章：60 位新生的一學期' : mode === 'snack' ? '場景 A：一個學期的宵夜' : '場景 B：放大一個人'}
      autoplay={mode !== 'ego'}
      initialSlot={mode === 'ego' ? totalSlots - 1 : 0}
      {onslot} {live}
      onselect={(i) => { if (i !== null) me = i; }}
      ringed={(i) => (mode === 'ego' ? i === me : i === CHENGEN || flash.has(i))}
      stateOf={(i) => (mode === 'snack' && flash.has(i) ? 'happy' : i === me && mode === 'ego' ? 'selected' : 'idle')}
      nodeSize={(i, g) => 8 + Math.sqrt(g.adj[i].length) * 2.5}
      metric={(i, g) => {
        const k = g.adj[i].length;
        if (k < 2) return { label: '聚集係數', value: '—' };
        let L = 0;
        for (let x = 0; x < k; x++) for (let y = x + 1; y < k; y++) if (g.adj[g.adj[i][x]].includes(g.adj[i][y])) L++;
        return { label: '聚集係數', value: (L / ((k * (k - 1)) / 2)).toFixed(2) };
      }} />
  {/key}

  {#if mode !== 'intro'}
    <div class="panel">
      {#if mode === 'snack'}
        <div class="row" role="radiogroup" aria-label="宵夜怎麼揪">
          {#each MODES as m, i}
            <button type="button" role="radio" aria-checked={modeIdx === i} onclick={() => (modeIdx = i)}>{m.label}</button>
          {/each}
        </div>
        <ClusteringChart {series} {day} {totalDays} />
        <p class="note">
          {MODES[modeIdx].random
            ? '參照組：揪宵夜的人帶去同樣多的人，但不是自己的朋友，而是隨機挑的。'
            : `每晚有人揪宵夜，每位朋友有 ${Math.round(MODES[modeIdx].bring * 100)}% 的機會被帶去。`}
          圈起來、頭上冒星星的三個人，是剛剛閉合的三角形。改變設定會從第一天重新開始。
        </p>
      {:else if graph}
        <EgoNet g={graph} center={me} names={script.people.map((p) => p.name)} />
        <p class="note">點網路圖上的任何一位小人（或用「找人」選單），旁邊就只留下這個人和朋友。一開始選的是承恩。</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .scene { display: flex; flex-direction: column; gap: var(--space-2); }
  @media (min-width: 960px) {
    .scene.wide { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); align-items: start; gap: var(--space-4); }
  }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  button { font: inherit; font-size: 13px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .note { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
</style>
