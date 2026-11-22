<script lang="ts">
  // 第 1 章第 ④ 段：六個人的鄰接矩陣。點一格就加上／拿掉一段友誼（A_ij 和 A_ji 一起變），
  // 每一列的總和就是那個人的度；所有度加起來永遠是 2L（握手定理）。
  import { renderCharacter } from '../../../lib/sprites/character';
  import { makePeople, PINYU, ROOMMATE } from './script';

  const crowd = makePeople();
  const who = [PINYU, ROOMMATE, 2, 3, 4, 5].map((i) => crowd[i]);
  const names = who.map((p, i) => (i === 1 ? `${p.name}（室友）` : p.name));
  const short = who.map((p) => p.name.slice(-2));
  const N = who.length;
  // 一開始的友誼（只是示範）
  let A = $state<number[][]>(Array.from({ length: N }, () => Array(N).fill(0)));
  for (const [i, j] of [[0, 1], [1, 2], [1, 3], [1, 4], [2, 3], [4, 5]]) { A[i][j] = 1; A[j][i] = 1; }

  function toggle(i: number, j: number) {
    if (i === j) return;
    const v = A[i][j] ? 0 : 1;
    A[i][j] = v; A[j][i] = v;
    announce = `${names[i]} 和 ${names[j]} ${v ? '成為朋友' : '不再是朋友'}。${names[i]} 的度是 ${deg[i]}，${names[j]} 的度是 ${deg[j]}。`;
  }
  let announce = $state('');
  let focus = $state<[number, number] | null>(null);
  const deg = $derived(A.map((r) => r.reduce((s, v) => s + v, 0)));
  const total = $derived(deg.reduce((s, k) => s + k, 0));
  const L = $derived(total / 2);

  // 圓形排列的小網路
  const R = 70, C = 95;
  const pos = who.map((_, i) => ({ x: C + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / N), y: C + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / N) }));
  const sprites = who.map((p) => renderCharacter(p.look, 'idle', { size: 30, title: p.name }));

  const cells: HTMLButtonElement[][] = Array.from({ length: N }, () => []);
  function onKey(e: KeyboardEvent, i: number, j: number) {
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    const ni = (i + m[0] + N) % N, nj = (j + m[1] + N) % N;
    cells[ni][nj]?.focus();
  }
  const hl = (i: number, j: number) => focus !== null && ((focus[0] === i && focus[1] === j) || (focus[0] === j && focus[1] === i));
</script>

<div class="adj">
  <svg viewBox="0 0 190 190" class="net" role="img" aria-label="六個人的友誼網路：{L} 條連結">
    {#each A as row, i}
      {#each row as v, j}
        {#if v && i < j}<line x1={pos[i].x} y1={pos[i].y} x2={pos[j].x} y2={pos[j].y} class:hl={hl(i, j)} />{/if}
      {/each}
    {/each}
    {#each pos as p, i}
      <g transform="translate({p.x - 15} {p.y - 20})">{@html sprites[i]}</g>
      <text x={p.x} y={p.y + 21} text-anchor="middle" class="nm">{short[i]}<tspan class="k"> {deg[i]}</tspan></text>
    {/each}
  </svg>

  <div class="mat-wrap">
    <table class="mat">
      <caption class="visually-hidden">鄰接矩陣 A：第 i 列第 j 行是 1 代表兩人是朋友。最後一行是每一列的總和，也就是度。</caption>
      <thead>
        <tr><th></th>{#each short as s}<th scope="col">{s}</th>{/each}<th scope="col" class="sum">度 k</th></tr>
      </thead>
      <tbody>
        {#each A as row, i}
          <tr>
            <th scope="row">{short[i]}</th>
            {#each row as v, j}
              <td>
                {#if i === j}
                  <span class="diag" aria-hidden="true">0</span>
                {:else}
                  <button type="button" bind:this={cells[i][j]} class:on={v === 1} class:hl={hl(i, j)}
                    aria-pressed={v === 1} aria-label="{names[i]} 和 {names[j]}：{v ? '是朋友' : '不是朋友'}"
                    onclick={() => toggle(i, j)} onkeydown={(e) => onKey(e, i, j)}
                    onfocus={() => (focus = [i, j])} onblur={() => (focus = null)}
                    onpointerenter={() => (focus = [i, j])} onpointerleave={() => (focus = null)}>{v}</button>
                {/if}
              </td>
            {/each}
            <td class="sum">{deg[i]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="hand">所有度加起來：{deg.join(' + ')} = <b>{total}</b> = 2 × <b>{L}</b> 條連結</p>
  </div>
  <p class="visually-hidden" aria-live="polite">{announce}</p>
</div>

<style>
  .adj { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); }
  .net { width: min(170px, 100%); flex: 0 1 auto; }
  .net line { stroke: var(--muted); stroke-width: 2; }
  .net line.hl { stroke: var(--signal); stroke-width: 3.5; }
  .nm { font-size: 10px; fill: var(--ink); }
  .k { font-family: var(--font-mono); fill: var(--accent); font-weight: 600; }
  .mat-wrap { flex: 1 1 260px; min-width: 0; overflow-x: auto; }
  .mat { border-collapse: collapse; font-size: 13px; }
  th { font-weight: 500; color: var(--muted); padding: 2px 2px; font-size: 12px; white-space: nowrap; }
  td { padding: 1px; text-align: center; }
  button, .diag { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 6px; font-family: var(--font-mono); font-size: 14px; }
  button { border: 1px solid var(--line); background: var(--bg); color: var(--muted); cursor: pointer; padding: 0; }
  button.on { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  button.hl { outline: 2px solid var(--signal); outline-offset: 1px; }
  .diag { color: var(--line); }
  .sum { font-family: var(--font-mono); color: var(--accent); font-weight: 600; padding-left: 8px; }
  th.sum { font-family: inherit; }
  .hand { margin: var(--space-2) 0 0; font-size: 14px; color: var(--muted); }
  .hand b { color: var(--ink); font-family: var(--font-mono); }
</style>
