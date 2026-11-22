<script lang="ts">
  // 第 6 章場景 A：職缺怎麼傳到你手上（docs/chapters/06-weak-ties.md ③）。
  // mode="intro" 時只是第 ① 段的校園（小人走動、學期從頭播放）。
  import { onMount } from 'svelte';
  import DualView from '../../engine/DualView.svelte';
  import campus from '../../../data/campus.json';
  import type { CampusLayout, CampusSim, Tie } from '../../../lib/sim/campus';
  import { type Graph, bfsLayers, fromEdges } from '../../../lib/network';
  import { prefersReducedMotion } from '../../../lib/ui/theme';
  import { ch6Script, GROUPS, PER_GROUP, SENIOR, XIAOYU } from './script';

  interface Props { mode?: 'intro' | 'job' }
  let { mode = 'job' }: Props = $props();

  const layouts = campus as unknown as { landscape: CampusLayout; portrait: CampusLayout };
  const script = ch6Script();
  const people = script.people;
  const totalSlots = script.weeks * 7 * 5;
  let view = $state<'campus' | 'network'>('campus');

  // 職缺從學姊的系（資工）裡、另一位同學那裡出現
  const SOURCES = { senior: SENIOR + 3, own: XIAOYU + 4 } as const;
  type Channel = 'strong' | 'all';
  let channel = $state<Channel>('strong');
  let source = $state<number>(SOURCES.senior);
  let layers = $state<number[][]>([]);
  let step = $state(-1); // -1：還沒發布
  let ties: Tie[] = [];
  let threshold = $state(0);
  let timer: ReturnType<typeof setInterval> | null = null;
  let informed = new Set<number>();

  function onslot(sim: CampusSim) {
    ties = sim.currentTies();
    const ws = ties.map((t) => t.weight).sort((a, b) => a - b);
    threshold = ws.length ? ws[Math.floor(ws.length / 2)] : 0;
    if (step >= 0) reset();
  }

  function graphFor(ch: Channel): Graph {
    const use = ch === 'all' ? ties : ties.filter((t) => t.weight >= threshold);
    return fromEdges(people.length, use.map((t) => [t.a, t.b] as [number, number]));
  }

  function reset() {
    if (timer) clearInterval(timer);
    timer = null; step = -1; layers = []; informed = new Set();
  }

  function publish() {
    reset();
    layers = bfsLayers(graphFor(channel), source);
    step = 0;
    informed = new Set(layers[0]);
    if (prefersReducedMotion()) { step = layers.length - 1; informed = new Set(layers.flat()); return; }
    timer = setInterval(() => {
      if (step >= layers.length - 1) { clearInterval(timer!); timer = null; return; }
      step += 1;
      informed = new Set(layers.slice(0, step + 1).flat());
    }, 900);
  }

  function preset(k: 'strong' | 'all' | 'own') {
    channel = k === 'own' ? 'all' : k;
    source = k === 'own' ? SOURCES.own : SOURCES.senior;
    publish();
  }

  onMount(() => () => { if (timer) clearInterval(timer); });

  const reached = $derived(step >= 0 && layers.slice(0, step + 1).some((l) => l.includes(XIAOYU)));
  const done = $derived(step >= 0 && step === layers.length - 1);
  const xiaoyuStep = $derived(layers.findIndex((l) => l.includes(XIAOYU)));
  const groupOf = (i: number) => GROUPS[Math.floor(i / PER_GROUP)].dept;
  const knownGroups = $derived(step < 0 ? [] : [...new Set(layers.slice(0, step + 1).flat().map(groupOf))]);
  const explain = $derived.by(() => {
    if (step < 0) return `職缺會從${groupOf(source)}圈裡的${people[source].name}那裡出現。先選「只透過強連結傳」或「也透過弱連結傳」，再按「發布職缺」。`;
    const n = layers.slice(0, step + 1).flat().length;
    const head = `第 ${step} 步：${n} 人知道了這個職缺（${knownGroups.join('、')}圈）。`;
    if (reached) return head + `小瑜在第 ${xiaoyuStep} 步收到了，${channel === 'all' ? '是透過一條弱連結傳過來的。' : '這條路全是強連結。'}`;
    if (done) return head + (channel === 'strong' ? '消息停在原本的圈子裡：強連結幾乎都在圈內，沒有一條通到小瑜。' : '小瑜沒有收到。');
    return head + '小瑜還沒收到。';
  });
</script>

<div class="scene">
  <DualView {script} {layouts} bind:view
    label={mode === 'intro' ? '第 6 章校園：70 位學生的一學期' : '場景 A：職缺怎麼傳到你手上'}
    initialSlot={mode === 'intro' ? 0 : totalSlots - 35} /* 第 18 週週一早上：大家在自己的系館，圈子看得出來 */
    autoplay={mode === 'intro'}
    active={mode === 'intro' ? null : ['socsci', 'eng', 'sci', 'liberal', 'library', 'gym', 'clubs', 'cafeteria']}
    {onslot}
    stateOf={(i) => (mode === 'job' && informed.has(i) ? 'happy' : 'idle')}
    ringed={(i) => i === XIAOYU || (mode === 'job' && step >= 0 && i === source)}
    metric={(i) => ({ label: '連結強度中位數以上的朋友', value: String(ties.filter((t) => (t.a === i || t.b === i) && t.weight >= threshold).length) })}
    nodeSize={(i, g) => 9 + Math.sqrt(g.adj[i].length) * 2.5} />

  {#if mode === 'job'}
    <div class="panel">
      <div class="row" role="radiogroup" aria-label="職缺透過哪些連結傳遞">
        <button type="button" role="radio" aria-checked={channel === 'strong'} onclick={() => { channel = 'strong'; reset(); }}>只透過強連結傳</button>
        <button type="button" role="radio" aria-checked={channel === 'all'} onclick={() => { channel = 'all'; reset(); }}>也透過弱連結傳</button>
        <button type="button" class="go" onclick={publish}>{step < 0 ? '發布職缺' : '重新發布'}</button>
      </div>
      <p class="now" aria-live="polite"><strong>現在發生了什麼？</strong>{explain}</p>
      <div class="row presets">
        <span>試試看：</span>
        <button type="button" onclick={() => preset('strong')}>職缺在學姊的系，只走強連結</button>
        <button type="button" onclick={() => preset('all')}>同一個職缺，也走弱連結</button>
        <button type="button" onclick={() => preset('own')}>職缺就在小瑜自己的系</button>
      </div>
      <p class="note">強連結 = 累積相處時間在全部連結的中位數以上。橘色圈是小瑜{step >= 0 ? '和職缺的來源' : ''}；頭上有星星的人已經知道職缺。</p>
    </div>
  {/if}
</div>

<style>
  .scene { display: flex; flex-direction: column; gap: var(--space-2); }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .presets { font-size: 13px; color: var(--muted); }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 34px; cursor: pointer; }
  button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  .go { background: var(--signal); border-color: var(--signal); color: var(--panel); }
  .presets button { font-size: 13px; }
  .now { margin: 0; font-size: 15px; line-height: 1.7; }
  .now strong { display: block; font-size: 13px; color: var(--muted); font-weight: 500; }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
</style>
