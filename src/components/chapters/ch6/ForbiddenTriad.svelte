<script lang="ts">
  // 第 6 章邏輯鏈的三人動畫：「禁止三角形」→ 強連結不可能是局部橋（docs/chapters/06-weak-ties.md ⑤）。
  import { randomCrowd, renderCharacter } from '../../../lib/sprites/character';
  import { CHAPTERS } from '../../../data/chapters';

  const [lookB, lookC] = randomCrowd(2, 61);
  const A = { name: '小瑜', look: CHAPTERS[5].hero.look, x: 180, y: 70 };
  const B = { name: 'B', look: lookB, x: 70, y: 210 };
  const C = { name: 'C', look: lookC, x: 290, y: 210 };

  let step = $state(0);
  let assume = $state(true);
  const STEPS = [
    '小瑜和 B、小瑜和 C 都是強連結（粗線）。現在問：小瑜–B 這條強連結，可不可能是局部橋（兩端沒有共同朋友）？',
    '禁止三角形說：兩個人都和小瑜很熟，他們之間至少會有弱連結。所以 B–C 一定存在（虛線）。',
    '於是 C 是小瑜和 B 的共同朋友，小瑜–B 就不是局部橋了。只要小瑜還有別的強連結，這個論證都成立：局部橋只能是弱連結。',
  ];
  const NO_ASSUME = '拿掉禁止三角形之後，B 和 C 可以互不認識。小瑜–B 是強連結，卻也是局部橋：「橋 = 弱連結」不再有保證。';
  const showBC = $derived(assume && step >= 1);
  const bridge = $derived(!assume && step >= 1);
  const sprite = (look: typeof A.look) => renderCharacter(look, 'idle', { size: 54 });
</script>

<figure class="triad">
  <svg viewBox="0 0 360 290" role="img" aria-label={assume ? STEPS[step] : NO_ASSUME}>
    <line x1={A.x} y1={A.y + 20} x2={B.x} y2={B.y} class="strong" class:bridge />
    <line x1={A.x} y1={A.y + 20} x2={C.x} y2={C.y} class="strong" />
    {#if showBC}<line x1={B.x + 20} y1={B.y + 10} x2={C.x - 20} y2={C.y + 10} class="weak" class:on={step >= 1} />{/if}
    {#if step >= 2 && assume}<text x="180" y="245" text-anchor="middle" class="tag">C 是共同朋友 → 小瑜–B 不是局部橋</text>{/if}
    {#if bridge}<text x="105" y="135" text-anchor="middle" class="tag warn">強連結，也是局部橋</text>{/if}
    {#each [A, B, C] as p}
      <g transform="translate({p.x - 18} {p.y - 27})">{@html sprite(p.look)}</g>
      <text x={p.x} y={p.y + 44} text-anchor="middle" class="name">{p.name}</text>
    {/each}
  </svg>
  <figcaption aria-live="polite">{assume ? STEPS[step] : NO_ASSUME}</figcaption>
  <div class="row">
    <button type="button" onclick={() => (step = Math.max(0, step - 1))} disabled={step === 0}>上一步</button>
    <button type="button" onclick={() => (step = Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>下一步</button>
    <label class="opt"><input type="checkbox" bind:checked={assume} /> 禁止三角形成立</label>
  </div>
</figure>

<style>
  .triad { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); }
  svg { width: 100%; max-width: 420px; display: block; margin: 0 auto; }
  .strong { stroke: var(--accent); stroke-width: 6; stroke-linecap: round; }
  .strong.bridge { stroke: var(--signal); }
  .weak { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 5; opacity: 0; transition: opacity 500ms ease-in-out; }
  .weak.on { opacity: 1; }
  .name { font-size: 14px; fill: var(--ink); }
  .tag { font-size: 13px; fill: var(--accent); font-weight: 500; }
  .tag.warn { fill: var(--signal); }
  figcaption { font-size: 15px; line-height: 1.7; margin: var(--space-2) 0; min-height: 5.1em; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  button { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 34px; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  .opt { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; margin-left: auto; }
</style>
