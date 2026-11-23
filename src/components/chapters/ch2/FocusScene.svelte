<script lang="ts">
  // 第 2 章場景 A（docs/chapters/02-bipartite.md ③）：一學期的校園日程。
  // mode="intro"：第 ① 段，校園從頭播放。mode="foci"：四個焦點權重 + 「朋友從哪裡來」長條圖。
  import DualView from '../../engine/DualView.svelte';
  import campus from '../../../data/campus.json';
  import type { CampusLayout, CampusSim } from '../../../lib/sim/campus';
  import { ch2Script, FOCI, LEVELS, sharedFocusShares, YUHAN, type FocusKey, type Weights } from './script';

  interface Props { mode?: 'intro' | 'foci' }
  let { mode = 'foci' }: Props = $props();

  const layouts = campus as unknown as { landscape: CampusLayout; portrait: CampusLayout };
  let lv = $state<Record<FocusKey, number>>({ dorm: 2, dept: 2, club: 2, course: 2 });
  const weights = $derived<Weights>({ dorm: LEVELS[lv.dorm].value, dept: LEVELS[lv.dept].value, club: LEVELS[lv.club].value, course: LEVELS[lv.course].value });
  const key = $derived(`${lv.dorm}${lv.dept}${lv.club}${lv.course}`);
  const script = $derived(ch2Script(weights));
  let view = $state<'campus' | 'network'>('campus');
  let shares = $state<Record<string, number> | null>(null);
  let nTies = $state(0);

  // 隨機配對時，兩人共享各焦點的比例（參考線）
  const baseline = $derived.by(() => {
    const ps = script.people, all: { a: number; b: number }[] = [];
    for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) all.push({ a, b });
    return sharedFocusShares(ps, all);
  });

  function onslot(sim: CampusSim) {
    const ties = sim.currentTies();
    nTies = ties.length;
    shares = sharedFocusShares(script.people, ties);
  }

  const BARS: { k: 'dorm' | 'dept' | 'year' | 'club' | 'course'; label: string }[] = [
    { k: 'dorm', label: '同宿舍同一層' }, { k: 'dept', label: '同系' }, { k: 'year', label: '同年級' },
    { k: 'club', label: '同社團' }, { k: 'course', label: '同一門通識' },
  ];
  const top = $derived(shares ? BARS.reduce((b, x) => (shares![x.k] - baseline[x.k] > shares![b.k] - baseline[b.k] ? x : b)) : null);
</script>

<div class="scene" class:wide={mode === 'foci'}>
  {#key key}
    <DualView {script} {layouts} bind:view
      label={mode === 'intro' ? '第 2 章：70 位學生的一學期' : '場景 A：一學期的校園日程'}
      autoplay {onslot}
      ringed={(i) => i === YUHAN}
      nodeSize={(i, g) => 8 + Math.sqrt(g.adj[i].length) * 2.2} />
  {/key}

  {#if mode === 'foci'}
    <div class="panel">
      {#each FOCI as f}
        <div class="row" role="radiogroup" aria-label="{f.label}的焦點權重">
          <span class="lbl">{f.label}</span>
          {#each LEVELS as l, i}
            <button type="button" role="radio" aria-checked={lv[f.key] === i} onclick={() => (lv = { ...lv, [f.key]: i })}>{l.label}</button>
          {/each}
        </div>
      {/each}
      <figure class="bars">
        <figcaption>這學期的 {nTies} 段友誼裡，有多少是……</figcaption>
        {#each BARS as b}
          <div class="bar-row">
            <span class="bl">{b.label}</span>
            <span class="track" role="img" aria-label="{b.label}：{shares ? Math.round(shares[b.k] * 100) : 0}%，隨機配對約 {Math.round(baseline[b.k] * 100)}%">
              <span class="fill" class:top={top?.k === b.k} style:width="{(shares?.[b.k] ?? 0) * 100}%"></span>
              <span class="base" style:left="{baseline[b.k] * 100}%"></span>
            </span>
            <span class="pct num">{shares ? Math.round(shares[b.k] * 100) : 0}%</span>
          </div>
        {/each}
        <p class="note">細線是「隨便兩個人」共享這個焦點的比例。長條超過細線越多，代表這個焦點越能解釋誰和誰是朋友。同一段友誼可能同時共享好幾個焦點。改變權重會從第一週重新開始。</p>
      </figure>
    </div>
  {/if}
</div>

<style>
  .scene { display: flex; flex-direction: column; gap: var(--space-2); }
  @media (min-width: 960px) {
    .scene.wide { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); align-items: start; gap: var(--space-4); }
  }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .lbl { width: 4em; font-size: 14px; color: var(--muted); }
  button { font: inherit; font-size: 13px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 2px 10px; min-height: 32px; min-width: 40px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .bars { margin: var(--space-2) 0 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 14px; font-weight: 500; }
  .bar-row { display: grid; grid-template-columns: 7em 1fr 3em; gap: var(--space-2); align-items: center; font-size: 13px; }
  .bl { color: var(--muted); }
  .track { position: relative; height: 14px; background: var(--bg); border-radius: 4px; overflow: hidden; }
  .fill { position: absolute; inset: 0 auto 0 0; background: var(--muted); border-radius: 4px; }
  .fill.top { background: var(--accent); }
  .base { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ink); }
  .pct { text-align: right; font-family: var(--font-mono); }
  .note { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
  @media (prefers-reduced-motion: no-preference) { .fill { transition: width 300ms ease-out; } }
</style>
