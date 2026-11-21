<script lang="ts">
  // 邏輯鏈：假設 → 推導 → 結果 → 預測（docs/design.md 共用元件 4）。
  // 文字與公式由 LogicChain.astro 在建置時轉成 HTML 傳進來。
  export type StepKind = 'assumption' | 'derivation' | 'result' | 'prediction';
  export interface Step {
    kind: StepKind;
    /** 收合時的一句話（HTML） */
    summaryHtml: string;
    /** 展開後的完整推導（HTML，可含 KaTeX） */
    detailHtml?: string;
    /** 這一格依賴哪些格（索引）；預設依賴前面所有格 */
    dependsOn?: number[];
    /** 關鍵假設 */
    critical?: boolean;
  }
  export interface Removal {
    /** 可以被拿掉的假設（索引） */
    step: number;
    /** 「那會得到什麼」（HTML） */
    effectHtml: string;
  }

  interface Props {
    title?: string;
    steps: Step[];
    removal?: Removal;
    /** 展示用：一開始就展開哪幾格、是否已拿掉假設 */
    initialOpen?: number[];
    initialRemoved?: boolean;
  }
  let { title = '邏輯鏈', steps, removal, initialOpen = [], initialRemoved = false }: Props = $props();

  const KIND_LABEL: Record<StepKind, string> = { assumption: '假設', derivation: '推導', result: '結果', prediction: '預測' };
  const uid = $props.id(); // SSR 與 hydration 一致的 DOM id
  let open = $state<Set<number>>(new Set(initialOpen));
  let removed = $state(initialRemoved);

  function depends(i: number, on: number): boolean {
    if (i === on) return false;
    const deps = steps[i].dependsOn ?? Array.from({ length: i }, (_, k) => k);
    return deps.includes(on) || deps.some((d) => depends(d, on));
  }
  const greyed = $derived(new Set(removed && removal ? steps.map((_, i) => i).filter((i) => depends(i, removal.step)) : []));

  function toggle(i: number) {
    const next = new Set(open);
    if (next.has(i)) next.delete(i); else next.add(i);
    open = next;
  }
</script>

<section class="chain" aria-label={title}>
  <ol class="cells">
    {#each steps as s, i}
      <li class="cell" data-kind={s.kind} class:grey={greyed.has(i)} class:cut={removed && removal?.step === i}>
        <div class="head">
          <span class="kind">{KIND_LABEL[s.kind]}</span>
          {#if s.critical}<span class="critical">關鍵假設</span>{/if}
        </div>
        <div class="summary">{@html s.summaryHtml}</div>
        {#if s.detailHtml}
          <button type="button" class="more" aria-expanded={open.has(i)} aria-controls="lc-{uid}-{i}" onclick={() => toggle(i)}>
            {open.has(i) ? '收合推導' : '看完整推導'}
          </button>
          <div class="detail" id="lc-{uid}-{i}" hidden={!open.has(i)}>{@html s.detailHtml}</div>
        {/if}
        {#if removal?.step === i}
          <button type="button" class="remove" aria-pressed={removed} onclick={() => (removed = !removed)}>
            {removed ? '把假設放回來' : '拿掉這個假設'}
          </button>
        {/if}
        {#if greyed.has(i)}<p class="note">這一格依賴被拿掉的假設，不再成立。</p>{/if}
      </li>
    {/each}
  </ol>
  {#if removal && removed}
    <div class="effect" role="status">
      <strong>那會得到什麼？</strong>
      {@html removal.effectHtml}
    </div>
  {/if}
</section>

<style>
  .chain { display: flex; flex-direction: column; gap: var(--space-3); }
  .cells { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); counter-reset: step; }
  .cell { position: relative; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); transition: opacity 300ms ease-in-out; }
  .cell:not(:last-child)::after { content: '→'; position: absolute; right: calc(-1 * var(--space-3)); top: 50%; transform: translate(50%, -50%); color: var(--muted); font-size: 14px; }
  .cell[data-kind="assumption"] { border-top: 3px solid var(--accent); }
  .cell[data-kind="prediction"] { border-top: 3px solid var(--signal); }
  .head { display: flex; gap: var(--space-2); align-items: center; }
  .kind { font-family: var(--font-display); font-weight: 700; font-size: 15px; }
  .critical { font-size: 12px; color: var(--signal); border: 1px solid var(--signal); border-radius: 999px; padding: 0 8px; line-height: 1.6; }
  .summary :global(p) { margin: 0; font-size: 15px; line-height: 1.7; }
  .detail { font-size: 14px; border-top: 1px dashed var(--line); padding-top: var(--space-2); overflow-x: auto; }
  .detail :global(p) { margin: 0 0 var(--space-2); }
  button { font: inherit; font-size: 13px; align-self: flex-start; color: var(--accent); background: none; border: 1px solid var(--line); border-radius: 8px; padding: 2px 10px; min-height: 30px; cursor: pointer; }
  .remove { color: var(--signal); }
  .remove[aria-pressed="true"] { background: var(--signal-soft); }
  .grey { opacity: 0.45; }
  .cut .summary { text-decoration: line-through; text-decoration-color: var(--signal); }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
  .effect { background: var(--signal-soft); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 15px; }
  .effect :global(p) { margin: var(--space-1) 0 0; }
  @media (max-width: 760px) {
    .cells { grid-template-columns: 1fr; }
    .cell:not(:last-child)::after { content: '↓'; right: 50%; top: auto; bottom: calc(-1 * var(--space-3)); transform: translate(50%, 50%); }
  }
</style>
