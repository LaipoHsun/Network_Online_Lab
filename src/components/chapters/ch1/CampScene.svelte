<script lang="ts">
  // 第 1 章場景（docs/chapters/01-degree.md ③）。
  // mode="intro"：第 ① 段，宿營從頭播放。
  // mode="camp"：場景 A，迎新宿營 + 即時度分布 + 「社交性差異」。
  // mode="you"：場景 B，宿營結束時的網路圖，點一位小人當作自己，看他的百分位。
  import DualView from '../../engine/DualView.svelte';
  import campus from '../../../data/campus.json';
  import type { CampusLayout, CampusSim } from '../../../lib/sim/campus';
  import type { Graph } from '../../../lib/network';
  import DegreeHistogram from './DegreeHistogram.svelte';
  import { ch1Script, PINYU, ROOMMATE, SPREADS } from './script';

  interface Props { mode?: 'intro' | 'camp' | 'you' }
  let { mode = 'camp' }: Props = $props();

  const layouts = campus as unknown as { landscape: CampusLayout; portrait: CampusLayout };
  let spreadIdx = $state(2);
  const script = $derived(ch1Script(SPREADS[spreadIdx].value));
  const totalSlots = $derived((script.days ?? 0) * 5);
  let view = $state<'campus' | 'network'>(mode === 'you' ? 'network' : 'campus');
  let degrees = $state<number[]>([]);
  let me = $state<number | null>(null);

  function onslot(sim: CampusSim) {
    degrees = sim.graph().adj.map((a) => a.length);
  }

  const you = $derived.by(() => {
    if (me === null || !degrees.length) return null;
    const k = degrees[me];
    const fewer = degrees.filter((d) => d < k).length, more = degrees.filter((d) => d > k).length;
    const n = degrees.length;
    return { k, fewer: Math.round((100 * fewer) / n), more: Math.round((100 * more) / n), name: script.people[me].name };
  });
  const mean = $derived(degrees.length ? degrees.reduce((s, k) => s + k, 0) / degrees.length : 0);
  const median = $derived.by(() => {
    const s = [...degrees].sort((a, b) => a - b), n = s.length;
    return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
  });

  // 公式卡（第 ④ 段）用的即時數值
  function live(g: Graph) {
    const N = g.n, L = g.adj.reduce((s, a) => s + a.length, 0) / 2;
    return { N, L, kbar: (2 * L) / N, rho: L / ((N * (N - 1)) / 2) };
  }
</script>

<div class="scene" class:wide={mode !== 'intro'}>
  {#key spreadIdx}
    <DualView {script} {layouts} bind:view
      label={mode === 'intro' ? '第 1 章：迎新宿營的三天' : mode === 'camp' ? '場景 A：迎新宿營' : '場景 B：點你自己'}
      autoplay={mode !== 'you'}
      initialSlot={mode === 'you' ? totalSlots - 1 : 0}
      {onslot} {live}
      onselect={(i) => (me = i)}
      ringed={(i) => i === PINYU || (mode !== 'intro' && i === ROOMMATE) || i === me}
      stateOf={(i) => (i === me ? 'selected' : 'idle')}
      nodeSize={(i, g) => 7 + g.adj[i].length * 0.65}
      metric={(i) => (degrees.length ? { label: '朋友比較少的人', value: `${Math.round((100 * degrees.filter((d) => d < degrees[i]).length) / degrees.length)}%` } : null)} />
  {/key}

  {#if mode !== 'intro'}
    <div class="panel">
      <div class="row" role="radiogroup" aria-label="社交性差異">
        <span class="lbl">社交性差異：</span>
        {#each SPREADS as s, i}
          <button type="button" role="radio" aria-checked={spreadIdx === i} onclick={() => (spreadIdx = i)}>{s.label}</button>
        {/each}
      </div>
      <DegreeHistogram {degrees} mark={you?.k ?? null} />
      {#if mode === 'you'}
        <p class="now" aria-live="polite">
          {#if you}
            <strong>{you.name}</strong>有 <b>{you.k}</b> 位朋友：{you.fewer}% 的人朋友比較少，{you.more}% 的人比較多。
            {#if you.k < mean && you.k >= median}低於平均（{mean.toFixed(1)}），卻在中位數（{median}）以上：平均數被少數朋友很多的人拉高了。{/if}
          {:else}
            點地圖或網路圖上的任何一位小人（或用「找人」選單、方向鍵），當作你自己。
          {/if}
        </p>
      {/if}
      <p class="note">
        {#if spreadIdx === 0}
          現在每個人一樣愛交朋友：朋友數集中在平均附近，平均數和中位數幾乎一樣。
        {:else}
          橘色圈是品妤和她的室友{mode === 'you' && me !== null ? '，以及你選的人' : ''}。差異越大，少數交際花的朋友越多，平均數被拉得比中位數高。
        {/if}
        改變差異會從第一天重新開始。
      </p>
    </div>
  {/if}
</div>

<style>
  .scene { display: flex; flex-direction: column; gap: var(--space-2); }
  /* 場景 A、B 橫跨整個版面：左邊校園／網路，右邊直方圖 */
  @media (min-width: 960px) {
    .scene.wide { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); align-items: start; gap: var(--space-4); }
  }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .lbl { font-size: 14px; color: var(--muted); }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .now { margin: 0; font-size: 15px; line-height: 1.7; }
  .now b { font-family: var(--font-mono); }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
</style>
