<script lang="ts">
  // 小人引擎 + 雙視圖（校園 ⇄ 網路）。規格見 docs/design.md「共用互動元件」1、2。
  // 章節在 src/components/chapters/ 裡寫一個小元件，把劇本（函式）傳進來；Astro 頁面不能直接傳函式。
  import { onMount } from 'svelte';
  import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationNodeDatum } from 'd3-force';
  import CampusMap from './CampusMap.svelte';
  import type { CampusScene } from './scene';
  import {
    CampusSim, type CampusLayout, type Point, type Script, type Tie, hash01, pointAlong, slotLabel, walkRoute, SLOTS_PER_DAY,
  } from '../../lib/sim/campus';
  import { type Graph, averageDegree, numEdges } from '../../lib/network';
  import { COLLEGE_LABEL, type State } from '../../lib/sprites/character';
  import { emitLive, onHighlight } from '../../lib/ui/bus';
  import { onThemeChange, prefersReducedMotion } from '../../lib/ui/theme';

  type View = 'campus' | 'network';
  interface Highlight { nodes?: number[]; edges?: [number, number][] }

  interface Props {
    script: Script;
    layouts: { landscape: CampusLayout; portrait: CampusLayout };
    /** 給螢幕閱讀器的名稱 */
    label: string;
    active?: string[] | null;
    /** 目前的視圖；可以 bind，捲動敘事用它自動切換 */
    view?: View;
    autoplay?: boolean;
    /** 一開始停在第幾個時段 */
    initialSlot?: number;
    showFps?: boolean;
    /** 資料卡上本章相關的指標 */
    metric?: (i: number, g: Graph) => { label: string; value: string } | null;
    /** 每個人的狀態（生病、被拿掉…） */
    stateOf?: (i: number, sim: CampusSim) => State;
    /** 每個時段送給公式卡的即時數值 */
    live?: (g: Graph, sim: CampusSim) => Record<string, number>;
    /** 公式卡滑過符號 key 時要高亮哪些人、哪些連結 */
    highlight?: (key: string, g: Graph) => Highlight | null;
    /** 網路視圖的節點直徑（8–28 px） */
    nodeSize?: (i: number, g: Graph) => number;
    onslot?: (sim: CampusSim) => void;
  }

  let {
    script, layouts, label, active = null, view = $bindable('campus'), autoplay = true, initialSlot = 0,
    showFps = false, metric, stateOf, live, highlight, nodeSize, onslot,
  }: Props = $props();

  const SPEEDS = [1, 4, 16] as const;
  /** 1× 時每秒走幾個時段 */
  const SLOTS_PER_SECOND = 0.25;
  const WALK = 0.3, TIE_AT = 0.36, TIE_GROW = 0.14, MORPH_MS = 750;

  // ---- UI 狀態
  let playing = $state(false);
  let speed = $state<(typeof SPEEDS)[number]>(1);
  let slotIdx = $state(0);
  let selected = $state<number | null>(null);
  let showEdges = $state(true);
  let zoomK = $state(1);
  let summary = $state('');
  let announce = $state('');
  let fps = $state(0);
  let ready = $state(false);
  let failed = $state('');
  let orientation = $state<'landscape' | 'portrait'>('landscape');
  let mapT = $state({ x: 0, y: 0, k: 1 });
  let card = $state<{ x: number; y: number } | null>(null);
  let reduced = $state(false);
  let viewT = 0;

  // ---- 非反應式的大型狀態
  let host: HTMLDivElement;
  let stage: HTMLDivElement;
  let scene: CampusScene | null = null;
  const sim = new CampusSim(script);
  const n = script.people.length;
  let playhead = initialSlot;
  let ties: Tie[] = [];
  let graph: Graph = sim.graph();
  let routes: Point[][] = [];
  let routeSlot = -2;
  let newTieSlot = -1;
  let talkers = new Set<number>();
  let hiNodes = new Set<number>();
  let hiEdges = new Set<string>();
  let raf = 0;
  let visible = true;
  let last = 0;
  let fpsFrames = 0, fpsSince = 0;
  let width = 0;

  type Node = SimulationNodeDatum & { i: number };
  const nodes: Node[] = script.people.map((_, i) => ({ i }));
  let force: Simulation<Node, undefined> | null = null;

  const layout = $derived(layouts[orientation]);
  const totalSlots = sim.totalSlots;

  function syncSim(s: number) {
    sim.seek(s + 1);
    if (sim.slot - 1 !== newTieSlot) {
      ties = sim.currentTies();
      graph = sim.graph();
      newTieSlot = sim.slot - 1;
      const fresh = sim.history[s]?.newTies ?? [];
      talkers = new Set(fresh.flat());
      updateForceLinks();
      if (live) emitLive(live(graph, sim), label);
      onslot?.(sim);
    }
    slotIdx = s;
    const m = numEdges(graph);
    summary = `${slotLabel(s)} · ${n} 人 · ${m} 條連結 · 平均朋友數 ${averageDegree(graph).toFixed(1)}`;
  }

  function updateForceLinks() {
    if (!force) return;
    const maxW = Math.max(1, ...ties.map((t) => t.weight));
    const links = ties.map((t) => ({ source: t.a, target: t.b, w: t.weight / maxW }));
    force.force('link', forceLink<Node, { source: number; target: number; w: number }>(links).id((d) => d.i).distance(42).strength((l) => 0.08 + 0.4 * l.w));
    force.alpha(Math.max(force.alpha(), 0.25));
  }

  function setupForce() {
    const L = layout;
    const pad = 30;
    force = forceSimulation(nodes)
      .force('charge', forceManyBody<Node>().strength(() => -18 - 9000 / Math.max(60, n)).distanceMax(420))
      .force('x', forceX<Node>(L.width / 2).strength(0.025))
      .force('y', forceY<Node>(L.height / 2).strength(0.035))
      .force('collide', forceCollide<Node>(9))
      .stop();
    force.on('tick', () => {
      for (const d of nodes) {
        d.x = Math.max(pad, Math.min(L.width - pad, d.x ?? 0));
        d.y = Math.max(pad, Math.min(L.height - pad, d.y ?? 0));
      }
    });
    updateForceLinks();
    // 先排好，第一次切換時不會跳動
    force.tick(150);
  }

  function computeRoutes(s: number) {
    const prev = sim.locationsAt(s - 1), cur = sim.locationsAt(s);
    routes = script.people.map((p, i) => {
      const a = layout.locations.find((l) => l.id === prev[i])!, b = layout.locations.find((l) => l.id === cur[i])!;
      return walkRoute(layout, a, b, p.id);
    });
    routeSlot = s;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!scene || !visible) { last = now; return; }
    step(now);
  }

  /** 一幀的全部工作（模擬推進 + 排版 + 繪圖），拆出來方便量測效能。 */
  function step(now: number) {
    if (!scene) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;

    if (playing) {
      playhead += dt * SLOTS_PER_SECOND * speed;
      if (playhead >= totalSlots - 1e-6) { playhead = totalSlots - 1e-6; playing = false; announceNow(); }
    }
    const s = Math.floor(playhead), f = playhead - s;
    if (s !== slotIdx || s + 1 > sim.slot) syncSim(s);
    if (routeSlot !== s) computeRoutes(s);

    // 視圖變形
    const target = view === 'network' ? 1 : 0;
    if (reduced) viewT = target;
    else if (viewT !== target) viewT = Math.max(0, Math.min(1, viewT + Math.sign(target - viewT) * ((dt * 1000) / MORPH_MS)));
    if (force && (viewT > 0 || force.alpha() > 0.05)) force.tick();

    const campus: Point[] = new Array(n), walking: boolean[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const delay = hash01(script.people[i].id) * 0.08;
      const g = reduced ? 1 : Math.max(0, Math.min(1, (f - delay) / WALK));
      campus[i] = pointAlong(routes[i], g < 1 ? (g < 0.5 ? 2 * g * g : 1 - (-2 * g + 2) ** 2 / 2) : 1);
      walking[i] = g > 0 && g < 1 && routes[i].length > 2;
    }
    const net = nodes.map((d) => ({ x: d.x ?? 0, y: d.y ?? 0 }));
    const growT = reduced ? (f >= TIE_AT ? 1 : 0) : Math.max(0, Math.min(1, (f - TIE_AT) / TIE_GROW));
    const frameTies = [];
    for (const t of ties) {
      const grow = t.since === s ? growT : 1;
      if (grow > 0) frameTies.push({ a: t.a, b: t.b, weight: t.weight, grow });
    }
    const secPerSlot = 1 / (SLOTS_PER_SECOND * speed);
    const age = (f - TIE_AT) * secPerSlot;
    const talking = new Map<number, number>();
    if (age >= 0 && age < 1.6) for (const i of talkers) talking.set(i, age);

    const states: State[] = script.people.map((_, i) => stateOf?.(i, sim) ?? 'idle');
    const sizes = script.people.map((_, i) => Math.max(8, Math.min(28, nodeSize?.(i, graph) ?? 12)));
    scene.view = { x: mapT.x * scene.fit, y: mapT.y * scene.fit, k: mapT.k };
    scene.render({
      campus, net, viewT, walking, states, ties: frameTies, showEdges, selected,
      highlightNodes: hiNodes, highlightEdges: hiEdges, talking, nodeSize: sizes, now, reducedMotion: reduced,
    });
    if (selected !== null) {
      const p = scene.screenPos(selected);
      if (p) card = p;
    }
    if (showFps) {
      fpsFrames++;
      if (now - fpsSince > 1000) { fps = Math.round((fpsFrames * 1000) / (now - fpsSince)); fpsFrames = 0; fpsSince = now; }
    }
  }

  function announceNow() { announce = summary; }

  // ---- 控制
  function togglePlay() {
    if (!playing && playhead >= totalSlots - 1e-3) playhead = 0;
    playing = !playing;
    if (!playing) announceNow();
  }
  function seekTo(v: number) {
    playhead = Math.max(0, Math.min(totalSlots - 1, v)) + 0.999; // 停在該時段結束：走路與新連結都已完成
    syncSim(Math.floor(playhead));
    announceNow();
  }
  function setView(v: View) { view = v; }
  function zoom(by: number) {
    const k = Math.max(1, Math.min(4, mapT.k * by));
    // 以畫面中心為準縮放
    const cx = layout.width / 2, cy = layout.height / 2;
    mapT = { k, x: cx - ((cx - mapT.x) * k) / mapT.k, y: cy - ((cy - mapT.y) * k) / mapT.k };
    if (k === 1) mapT = { x: 0, y: 0, k: 1 };
    zoomK = k;
  }
  function select(i: number | null) {
    selected = i;
    if (i === null) card = null;
    else announce = cardText(i);
  }
  function cardText(i: number) {
    const p = script.people[i];
    const k = graph.adj[i].length;
    const m = metric?.(i, graph);
    return `${p.name}，${p.dept}，朋友 ${k} 位${m ? `，${m.label} ${m.value}` : ''}`;
  }

  // ---- 指標事件：拖曳平移、點選、拖節點
  let down: { x: number; y: number; mx: number; my: number; moved: boolean; node: number | null; id: number } | null = null;
  function local(e: PointerEvent) {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onPointerDown(e: PointerEvent) {
    if (!scene) return;
    const p = local(e);
    const hit = scene.hitTest(p.x, p.y);
    down = { x: p.x, y: p.y, mx: mapT.x, my: mapT.y, moved: false, node: view === 'network' && viewT === 1 ? hit : null, id: e.pointerId };
    if (down.node !== null || e.pointerType === 'mouse' || mapT.k > 1) stage.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!down || !scene || e.pointerId !== down.id) return;
    const p = local(e);
    if (Math.hypot(p.x - down.x, p.y - down.y) > 4) down.moved = true;
    if (!down.moved) return;
    if (down.node !== null) {
      const w = scene.toWorld(p.x, p.y);
      const d = nodes[down.node];
      d.fx = w.x; d.fy = w.y;
      force?.alpha(Math.max(force.alpha(), 0.2));
    } else if (e.pointerType === 'mouse' || mapT.k > 1) {
      mapT = { ...mapT, x: down.mx + (p.x - down.x) / scene.fit, y: down.my + (p.y - down.y) / scene.fit };
    }
  }
  function onPointerUp(e: PointerEvent) {
    if (!down || !scene) return;
    if (down.node !== null) { const d = nodes[down.node]; d.fx = null; d.fy = null; }
    if (!down.moved) {
      const p = local(e);
      const hit = scene.hitTest(p.x, p.y);
      select(hit === selected ? null : hit);
    }
    down = null;
  }
  function onWheel(e: WheelEvent) {
    // 只有觸控板捏合（ctrlKey）或按住 ⌘/Ctrl 才縮放，避免搶走頁面捲動
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { select(selected === null ? 0 : (selected + 1) % n); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { select(selected === null ? n - 1 : (selected - 1 + n) % n); e.preventDefault(); }
    else if (e.key === 'Escape') select(null);
    else if (e.key === '+' || e.key === '=') zoom(1.25);
    else if (e.key === '-') zoom(0.8);
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    let disposed = false;
    const ro = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      orientation = width < 560 ? 'portrait' : 'landscape';
      const L = layouts[orientation];
      const h = (width * L.height) / L.width;
      stage.style.height = `${h}px`;
      if (scene) { scene.resize(width, h, L.width); scene.spriteScale = width < 560 ? 0.8 : 1; routeSlot = -2; }
    });
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(host);
    const offTheme = onThemeChange(() => scene?.bakeAll());
    const offHi = onHighlight(({ key }) => {
      const h = key && highlight ? highlight(key, graph) : null;
      hiNodes = new Set(h?.nodes ?? []);
      hiEdges = new Set((h?.edges ?? []).map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
    });

    (async () => {
      try {
        const { CampusScene } = await import('./scene');
        if (disposed) return;
        const s = new CampusScene();
        width = host.clientWidth;
        orientation = width < 560 ? 'portrait' : 'landscape';
        const L = layouts[orientation];
        const h = (width * L.height) / L.width;
        stage.style.height = `${h}px`;
        await s.init(stage, script.people.map((p) => p.look), width, h);
        if (disposed) { s.destroy(); return; }
        s.resize(width, h, L.width);
        s.spriteScale = width < 560 ? 0.8 : 1;
        scene = s;
        syncSim(Math.floor(playhead));
        computeRoutes(Math.floor(playhead));
        nodes.forEach((d, i) => { const r = routes[i]; const p = r[r.length - 1]; d.x = p.x; d.y = p.y; });
        setupForce();
        viewT = view === 'network' ? 1 : 0;
        playing = autoplay && !reduced; // 減少動態時不自動播放
        ready = true;
        raf = requestAnimationFrame(frame);
        if (showFps) {
          // 效能量測用（只在 showFps 時掛上）：連續跑 frames 幀，回傳每幀平均毫秒數
          (window as unknown as Record<string, unknown>).__networkLabBench = (frames = 120) => {
            const t0 = performance.now();
            for (let k = 0; k < frames; k++) step(t0 + k * 16.7);
            return (performance.now() - t0) / frames;
          };
        }
      } catch (err) {
        failed = '這個瀏覽器無法啟動繪圖（WebGL / Canvas）。下面的文字摘要仍然會更新。';
        console.error(err);
        syncSim(Math.floor(playhead));
      }
    })();

    return () => {
      disposed = true; ro.disconnect(); io.disconnect(); offTheme(); offHi();
      cancelAnimationFrame(raf); force?.stop(); scene?.destroy(); scene = null;
    };
  });

  // 換方向時重建排版的中心
  $effect(() => {
    const L = layout;
    if (!force) return;
    force.force('x', forceX<Node>(L.width / 2).strength(0.025)).force('y', forceY<Node>(L.height / 2).strength(0.035));
    force.alpha(0.5);
    routeSlot = -2;
  });

  const person = $derived(selected === null ? null : script.people[selected]);
  const cardMetric = $derived(selected === null || !metric ? null : (slotIdx, metric(selected, graph)));
  const cardDegree = $derived(selected === null ? 0 : (slotIdx, graph.adj[selected].length));
  const weekOf = (s: number) => Math.floor(s / (SLOTS_PER_DAY * 7)) + 1;
</script>

<div class="dual" bind:this={host}>
  <div class="toolbar" role="toolbar" aria-label="{label}：時間與視圖">
    <button type="button" onclick={togglePlay} aria-pressed={playing} disabled={!ready && !failed}>
      {playing ? '暫停' : '播放'}
    </button>
    <div class="speeds" role="radiogroup" aria-label="速度">
      {#each SPEEDS as sp}
        <button type="button" role="radio" aria-checked={speed === sp} onclick={() => (speed = sp)}>{sp}×</button>
      {/each}
    </div>
    <label class="timeline">
      <span class="visually-hidden">學期時間軸</span>
      <input type="range" min="0" max={totalSlots - 1} step="1" value={slotIdx}
        aria-valuetext={slotLabel(slotIdx)}
        oninput={(e) => { playing = false; seekTo(+(e.currentTarget as HTMLInputElement).value); }} />
      <span class="week">第 {weekOf(slotIdx)} / {script.weeks} 週</span>
    </label>
  </div>

  <div class="stage-wrap">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="stage" bind:this={stage} role="group" tabindex="0"
      aria-label="{label}。方向鍵選人，Esc 取消，加號減號縮放。"
      style:touch-action={zoomK > 1 ? 'none' : 'pan-y'}
      onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={() => (down = null)}
      onwheel={onWheel} onkeydown={onKey}>
      <CampusMap {layout} {active} tx={mapT.x} ty={mapT.y} k={mapT.k} opacity={view === 'network' ? 0.12 : 1} />
      {#if !ready && !failed}<p class="loading">小人準備中…</p>{/if}
      {#if failed}<p class="loading">{failed}</p>{/if}
    </div>

    <div class="corner">
      <div class="seg" role="radiogroup" aria-label="視圖">
        <button type="button" role="radio" aria-checked={view === 'campus'} onclick={() => setView('campus')}>校園</button>
        <button type="button" role="radio" aria-checked={view === 'network'} onclick={() => setView('network')}>網路</button>
      </div>
      <div class="zoom">
        <button type="button" onclick={() => zoom(1.25)} aria-label="放大">＋</button>
        <button type="button" onclick={() => zoom(0.8)} aria-label="縮小" disabled={zoomK <= 1}>－</button>
      </div>
    </div>

    {#if person && card}
      <div class="card" role="dialog" aria-label="{person.name}的資料卡"
        style:left="{Math.min(Math.max(card.x + 16, 8), Math.max(8, width - 216))}px"
        style:top="{Math.max(8, card.y - 70)}px">
        <button type="button" class="close" onclick={() => select(null)} aria-label="關閉資料卡">×</button>
        <strong>{person.name}</strong>
        <span class="dept">{person.dept} · {COLLEGE_LABEL[person.college]}</span>
        <dl>
          <dt>朋友數</dt><dd class="num">{cardDegree}</dd>
          {#if cardMetric}<dt>{cardMetric.label}</dt><dd class="num">{cardMetric.value}</dd>{/if}
        </dl>
      </div>
    {/if}
    {#if showFps}<span class="fps num" aria-hidden="true">{fps} fps</span>{/if}
  </div>

  <div class="foot">
    <p class="summary num">{summary}</p>
    <label class="opt"><input type="checkbox" bind:checked={showEdges} /> 在校園視圖顯示連結</label>
    <label class="opt">
      <span>找人</span>
      <select value={selected ?? ''} onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; select(v === '' ? null : +v); }}>
        <option value="">（未選）</option>
        {#each script.people as p, i}<option value={i}>{p.name}（{p.dept}）</option>{/each}
      </select>
    </label>
  </div>
  <p class="visually-hidden" aria-live="polite">{announce}</p>
</div>

<style>
  .dual { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  button, select { font: inherit; font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 32px; cursor: pointer; }
  button[aria-pressed="true"], button[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
  button:disabled { opacity: 0.5; cursor: default; }
  .speeds, .seg, .zoom { display: inline-flex; gap: 2px; }
  .timeline { flex: 1 1 200px; display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
  .timeline input { flex: 1; min-width: 0; accent-color: var(--accent); }
  .week { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 13px; color: var(--muted); white-space: nowrap; }
  .stage-wrap { position: relative; }
  .stage { position: relative; width: 100%; overflow: hidden; border-radius: 8px; background: var(--map-grass); outline-offset: 3px; user-select: none; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--muted); padding: var(--space-4); text-align: center; }
  .corner { position: absolute; top: var(--space-2); right: var(--space-2); display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-1); }
  .corner button { background: var(--panel); }
  .corner button[aria-checked="true"] { background: var(--accent); }
  .card { position: absolute; width: 200px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: var(--space-3); box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); display: flex; flex-direction: column; line-height: 1.5; font-size: 14px; }
  .card strong { font-size: 16px; }
  .dept { color: var(--muted); }
  .card dl { display: grid; grid-template-columns: auto 1fr; gap: 2px var(--space-3); margin: var(--space-2) 0 0; }
  .card dt { color: var(--muted); }
  .card dd { margin: 0; text-align: right; }
  .close { position: absolute; top: 4px; right: 4px; min-height: 0; padding: 0 8px; border: 0; background: none; font-size: 18px; }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .fps { position: absolute; left: var(--space-2); bottom: var(--space-2); font-size: 12px; background: var(--panel); padding: 0 6px; border-radius: 6px; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); font-size: 14px; }
  .summary { margin: 0; flex: 1 1 100%; color: var(--muted); font-size: 13px; }
  .opt { display: inline-flex; align-items: center; gap: var(--space-2); }
  .opt select { max-width: 200px; }
  @media (max-width: 560px) {
    .card { left: var(--space-2) !important; right: var(--space-2); top: auto !important; bottom: var(--space-2); width: auto; }
  }
</style>
