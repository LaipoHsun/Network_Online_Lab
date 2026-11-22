// 小人引擎的模擬邏輯（純函式／純資料，無 DOM）。規格見 docs/design.md「小人引擎」。
//
// 時間以「時段」（slot）為單位：一天 SLOTS_PER_DAY 個時段，一週 7 天，一學期 weeks 週。
// 每個時段開始時，每個人依日程規則決定要去的地點；同一地點的兩人依章節規則以某個機率相認識，
// 已認識的人累積相處時間（連結權重 = 累積相處分鐘數）。
// 走路動畫只是繪圖層在兩個時段之間做的內插，不影響模擬結果，所以拖曳時間軸只要重播即可。
import type { CharacterParams, College } from '../sprites/character';
import { fromEdges, type Graph } from '../network/graph';
import { type Rng, seededRandom } from './random';

// ---------------------------------------------------------------- 校園配置

export interface Rect { x: number; y: number; w: number; h: number }

export interface CampusLocation {
  id: string;
  label: string;
  /** building：建築；open：戶外空間；path：道路（只經過，不算相遇）；landmark：地標，不作焦點 */
  kind: 'building' | 'open' | 'path' | 'landmark';
  rect: Rect;
  /** 入口接到哪個道路節點 */
  road: string;
  capacity: number;
  college?: College;
}

export interface CampusLayout {
  width: number;
  height: number;
  locations: CampusLocation[];
  roads: { nodes: { id: string; x: number; y: number }[]; edges: [string, string][] };
}

export interface Point { x: number; y: number }

/** 地點入口：地點矩形上最靠近道路節點的點。 */
export function entranceOf(layout: CampusLayout, loc: CampusLocation): Point {
  const road = layout.roads.nodes.find((n) => n.id === loc.road)!;
  const { x, y, w, h } = loc.rect;
  return { x: Math.min(Math.max(road.x, x), x + w), y: Math.min(Math.max(road.y, y), y + h) };
}

/** 道路網上兩點之間的最短路徑（Dijkstra，距離為歐氏長度），回傳經過的座標。 */
export function roadRoute(layout: CampusLayout, from: string, to: string): Point[] {
  const nodes = layout.roads.nodes;
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const s = idx.get(from), t = idx.get(to);
  if (s === undefined || t === undefined) throw new Error(`道路節點不存在：${from} 或 ${to}`);
  const adj: { v: number; w: number }[][] = nodes.map(() => []);
  for (const [a, b] of layout.roads.edges) {
    const i = idx.get(a)!, j = idx.get(b)!;
    const w = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
    adj[i].push({ v: j, w }); adj[j].push({ v: i, w });
  }
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
  dist[s] = 0;
  for (let k = 0; k < nodes.length; k++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (const { v, w } of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  if (dist[t] === Infinity) throw new Error(`道路網上 ${from} 到不了 ${to}`);
  const path: Point[] = [];
  for (let v = t; v >= 0; v = prev[v]) path.push({ x: nodes[v].x, y: nodes[v].y });
  return path.reverse();
}

/** 由字串產生 [0, 1) 的雜湊值，用來決定每個人在地點內固定的站位。 */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** 某人在某地點內的站位（同一人同一地點永遠相同）。 */
export function spotIn(loc: CampusLocation, personId: string, inset = 10): Point {
  const { x, y, w, h } = loc.rect;
  const ix = Math.min(inset, w / 3), iy = Math.min(inset, h / 3);
  return {
    x: x + ix + hash01(personId + '|' + loc.id + '|x') * (w - 2 * ix),
    y: y + iy + hash01(personId + '|' + loc.id + '|y') * (h - 2 * iy),
  };
}

/** 從 A 地點的站位走到 B 地點站位的完整路線。 */
export function walkRoute(layout: CampusLayout, a: CampusLocation, b: CampusLocation, personId: string): Point[] {
  const start = spotIn(a, personId), end = spotIn(b, personId);
  if (a.id === b.id) return [start, end];
  return [start, entranceOf(layout, a), ...roadRoute(layout, a.road, b.road), entranceOf(layout, b), end];
}

/** 折線上依弧長比例 f ∈ [0, 1] 取點。 */
export function pointAlong(route: readonly Point[], f: number): Point {
  if (route.length === 1 || f <= 0) return route[0];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    segs.push(d); total += d;
  }
  if (f >= 1 || total === 0) return route[route.length - 1];
  let target = f * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const t = segs[i] === 0 ? 0 : target / segs[i];
      return { x: route[i].x + (route[i + 1].x - route[i].x) * t, y: route[i].y + (route[i + 1].y - route[i].y) * t };
    }
    target -= segs[i];
  }
  return route[route.length - 1];
}

// ---------------------------------------------------------------- 角色與劇本

export interface Person {
  id: string;
  name: string;
  /** 系級，例如「經濟一」 */
  dept: string;
  college: College;
  year: 1 | 2 | 3 | 4;
  dorm?: string;
  clubs?: string[];
  look: CharacterParams;
}

export const SLOTS_PER_DAY = 5;
export const PERIOD_LABEL = ['早上', '中午', '下午', '晚上', '深夜'] as const;
export const DAY_LABEL = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const;
/** 每個時段代表的分鐘數（權重 = 累積相處分鐘數） */
export const SLOT_MINUTES = 120;

export interface SlotTime {
  /** 從 0 起算的全域時段編號 */
  slot: number;
  week: number;
  /** 0 = 週一 */
  day: number;
  /** 0..SLOTS_PER_DAY-1，對應 PERIOD_LABEL */
  period: number;
}

export function slotTime(slot: number): SlotTime {
  const perWeek = SLOTS_PER_DAY * 7;
  return { slot, week: Math.floor(slot / perWeek), day: Math.floor((slot % perWeek) / SLOTS_PER_DAY), period: slot % SLOTS_PER_DAY };
}

export function slotLabel(slot: number, byDay = false): string {
  const t = slotTime(slot);
  if (byDay) return `第 ${t.week * 7 + t.day + 1} 天${PERIOD_LABEL[t.period]}`;
  return `第 ${t.week + 1} 週 ${DAY_LABEL[t.day]}${PERIOD_LABEL[t.period]}`;
}

/** 章節提供的「劇本」：誰、去哪、怎麼認識。 */
export interface Script {
  people: Person[];
  layout: CampusLayout;
  seed: number;
  /** 一學期幾週 */
  weeks: number;
  /** 只跑前幾天（例如三天的迎新宿營）；有設定時時間軸以「天」顯示，總長 = days 天 */
  days?: number;
  /** 第 i 個人在這個時段要去的地點 id。 */
  where(person: Person, i: number, time: SlotTime, rng: Rng): string;
  /** 同在 location 的兩人在這個時段相認識的機率（尚未認識時才會呼叫）；present 是當下在這個地點的人數。 */
  meetProbability(a: Person, b: Person, location: CampusLocation, time: SlotTime, present: number): number;
  /** 一開始就認識的配對（例如室友）。 */
  initialTies?: [number, number][];
  /**
   * 每個時段開始、決定大家去哪之前呼叫（可選）。章節可以在這裡依「目前的朋友關係」安排活動，
   * 例如第 3 章的宵夜：有人約、再帶上自己的朋友。只能用傳進來的 rng，模擬才會可重播。
   */
  beforeSlot?(time: SlotTime, rng: Rng, sim: { neighbors(i: number): number[]; hasTie(a: number, b: number): boolean }): void;
  /** 「各做各的」地點：同在這裡不算相處、也不會認識（例如晚上的宿舍區）。 */
  quietLocations?: string[];
}

export interface Tie { a: number; b: number; since: number; weight: number }

export interface SlotResult {
  slot: number;
  /** 這個時段每個人所在的地點 id */
  at: string[];
  /** 這個時段新認識的配對 */
  newTies: [number, number][];
}

const pairKey = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a);

/**
 * 小人引擎的模擬核心。完全確定：同一個劇本、同一個種子，每次結果都一樣。
 * history[s] 保留每個時段的位置，讓繪圖層可以在 s−1 和 s 之間內插走路。
 */
export class CampusSim {
  readonly script: Script;
  readonly totalSlots: number;
  private rng: Rng;
  private ties = new Map<number, Tie>();
  /** 每個人目前的朋友（和 ties 同步），給 beforeSlot 查詢用 */
  private adj: number[][] = [];
  private locById: Map<string, CampusLocation>;
  readonly history: SlotResult[] = [];

  constructor(script: Script) {
    this.script = script;
    this.totalSlots = (script.days ?? script.weeks * 7) * SLOTS_PER_DAY;
    this.locById = new Map(script.layout.locations.map((l) => [l.id, l]));
    this.rng = seededRandom(script.seed);
    this.reset();
  }

  /** 回到學期開始（時段 −1：還沒有人出門，大家在宿舍）。 */
  reset(): void {
    this.rng = seededRandom(this.script.seed);
    this.ties.clear();
    this.adj = this.script.people.map(() => []);
    this.history.length = 0;
    for (const [a, b] of this.script.initialTies ?? []) {
      this.ties.set(pairKey(a, b), { a: Math.min(a, b), b: Math.max(a, b), since: -1, weight: 0 });
      this.adj[a].push(b); this.adj[b].push(a);
    }
  }

  /** 已經跑完的時段數。 */
  get slot(): number { return this.history.length; }

  location(id: string): CampusLocation {
    const loc = this.locById.get(id);
    if (!loc) throw new Error(`地點不存在：${id}`);
    return loc;
  }

  /** 跑一個時段。到學期末時回傳 null。 */
  step(): SlotResult | null {
    if (this.slot >= this.totalSlots) return null;
    const time = slotTime(this.slot);
    const { people } = this.script;
    this.script.beforeSlot?.(time, this.rng, this);
    const at = people.map((p, i) => {
      const id = this.script.where(p, i, time, this.rng);
      this.location(id); // 檢查地點存在
      return id;
    });
    const groups = new Map<string, number[]>();
    at.forEach((id, i) => { if (!groups.has(id)) groups.set(id, []); groups.get(id)!.push(i); });
    const newTies: [number, number][] = [];
    for (const [id, members] of groups) {
      const loc = this.location(id);
      if (loc.kind === 'path' || loc.kind === 'landmark' || this.script.quietLocations?.includes(id)) continue;
      for (let x = 0; x < members.length; x++) for (let y = x + 1; y < members.length; y++) {
        const a = members[x], b = members[y], key = pairKey(a, b);
        const tie = this.ties.get(key);
        if (tie) { tie.weight += SLOT_MINUTES; continue; }
        const p = this.script.meetProbability(people[a], people[b], loc, time, members.length);
        if (p > 0 && this.rng() < p) {
          this.ties.set(key, { a: Math.min(a, b), b: Math.max(a, b), since: this.slot, weight: SLOT_MINUTES });
          this.adj[a].push(b); this.adj[b].push(a);
          newTies.push([Math.min(a, b), Math.max(a, b)]);
        }
      }
    }
    const result = { slot: this.slot, at, newTies };
    this.history.push(result);
    return result;
  }

  /** 跳到「已經跑完 slot 個時段」的狀態（往回跳時從頭重播）。 */
  seek(slot: number): void {
    const target = Math.max(0, Math.min(this.totalSlots, Math.floor(slot)));
    if (target < this.slot) this.reset();
    while (this.slot < target) this.step();
  }

  /** 第 i 個人目前的朋友（不要修改回傳的陣列）。 */
  neighbors(i: number): number[] { return this.adj[i]; }

  hasTie(a: number, b: number): boolean { return this.ties.has(pairKey(a, b)); }

  /** 目前所有連結（含權重），依 (a, b) 排序。 */
  currentTies(): Tie[] {
    return [...this.ties.values()].map((t) => ({ ...t })).sort((x, y) => x.a - y.a || x.b - y.b);
  }

  /** 目前的網路，可以直接交給 src/lib/network 的函式。 */
  graph(): Graph {
    return fromEdges(this.script.people.length, this.currentTies().map((t) => [t.a, t.b] as [number, number]), this.script.people.map((p) => p.id));
  }

  /** 第 s 個時段每個人所在地點；s < 0 時回傳每個人的宿舍（或第一個地點）。 */
  locationsAt(s: number): string[] {
    if (s >= 0 && s < this.history.length) return this.history[s].at;
    const fallback = this.script.layout.locations[0].id;
    return this.script.people.map((p) => p.dorm ?? fallback);
  }
}
