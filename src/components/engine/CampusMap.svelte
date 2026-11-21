<script lang="ts">
  // 校園底圖（SVG）。示意插畫草稿，規格見 docs/campus-map.md；PixiJS 圖層畫在它上面。
  import type { CampusLayout } from '../../lib/sim/campus';
  import { entranceOf } from '../../lib/sim/campus';

  interface Props {
    layout: CampusLayout;
    /** 這一章用得到的地點；其他地點降到 35% 不透明度。null 代表全部點亮。 */
    active?: string[] | null;
    /** 與 Pixi 世界座標相同的平移（viewBox 單位）與縮放 */
    tx?: number;
    ty?: number;
    k?: number;
    /** 整張地圖的不透明度（切到網路視圖時淡出） */
    opacity?: number;
  }
  let { layout, active = null, tx = 0, ty = 0, k = 1, opacity = 1 }: Props = $props();

  const nodeById = $derived(new Map(layout.roads.nodes.map((n) => [n.id, n])));
  const isOn = (id: string) => !active || active.includes(id);
  const boulevard = $derived(layout.locations.find((l) => l.id === 'boulevard'));
  // 椰林大道兩側的椰子樹
  const palms = $derived.by(() => {
    if (!boulevard) return [];
    const { x, y, w, h } = boulevard.rect;
    const n = Math.max(4, Math.floor(w / 46));
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) { const px = x + (w * i) / n; out.push({ x: px, y: y - 6 }, { x: px, y: y + h + 6 }); }
    return out;
  });
</script>

<svg class="campus-map" viewBox="0 0 {layout.width} {layout.height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style:opacity>
  <rect width={layout.width} height={layout.height} fill="var(--map-grass)" />
  <g transform="translate({tx} {ty}) scale({k})">
    <!-- 道路網 -->
    <g stroke="var(--map-road)" stroke-linecap="round" stroke-width="12" fill="none">
      {#each layout.roads.edges as [a, b]}
        {@const p = nodeById.get(a)!}
        {@const q = nodeById.get(b)!}
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
      {/each}
    </g>
    <!-- 地點入口的小徑 -->
    <g stroke="var(--map-walk)" stroke-linecap="round" stroke-width="6">
      {#each layout.locations as loc}
        {#if loc.kind !== 'path'}
          {@const e = entranceOf(layout, loc)}
          {@const r = nodeById.get(loc.road)!}
          <line x1={e.x} y1={e.y} x2={r.x} y2={r.y} />
        {/if}
      {/each}
    </g>

    {#each layout.locations as loc (loc.id)}
      {@const { x, y, w, h } = loc.rect}
      <g opacity={isOn(loc.id) ? 1 : 0.35}>
        {#if loc.kind === 'path'}
          <rect {x} {y} width={w} height={h} rx={Math.min(h / 2, 12)} fill="var(--map-road)" />
        {:else if loc.id === 'lake'}
          <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="var(--map-water)" />
        {:else if loc.id === 'bell'}
          <rect x={x + w / 2 - 4} y={y} width="8" height={h} rx="2" fill="var(--map-roof)" />
          <circle cx={x + w / 2} cy={y + 4} r="6" fill="var(--map-building)" stroke="var(--map-roof)" stroke-width="2" />
        {:else if loc.id === 'gym'}
          <rect {x} {y} width={w} height={h} rx="14" fill="var(--map-walk)" />
          <rect x={x + 14} y={y + 14} width={w - 28} height={h - 28} rx={(h - 28) / 2} fill="none" stroke="var(--map-roof)" stroke-width="5" />
        {:else}
          <rect {x} {y} width={w} height={h} rx="8" fill="var(--map-building)" stroke="var(--line)" />
          <rect {x} {y} width={w} height="9" rx="4" fill={loc.college ? `var(--college-${loc.college})` : 'var(--map-roof)'} />
        {/if}
        {#if loc.kind !== 'landmark'}
          <text x={x + w / 2} y={loc.kind === 'path' ? y + h / 2 + 5 : y + h - 8} text-anchor="middle" class="label">{loc.label}</text>
        {:else}
          <text x={x + w / 2} y={y + h + 16} text-anchor="middle" class="label">{loc.label}</text>
        {/if}
      </g>
    {/each}

    <g fill="var(--map-tree)">
      {#each palms as t}
        <circle cx={t.x} cy={t.y} r="5" />
        <path d="M{t.x - 7} {t.y} L{t.x} {t.y - 3} L{t.x + 7} {t.y} Z" opacity="0.8" />
      {/each}
    </g>
  </g>
</svg>

<style>
  .campus-map { position: absolute; inset: 0; width: 100%; height: 100%; display: block; transition: opacity 750ms ease-in-out; }
  .label { font-family: var(--font-body); font-size: 14px; fill: var(--muted); paint-order: stroke; stroke: var(--map-grass); stroke-width: 3px; }
  @media (prefers-reduced-motion: reduce) { .campus-map { transition: none; } }
</style>
