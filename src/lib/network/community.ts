// 社群：模組度、Louvain、Girvan–Newman（第 8 章）。
import { type Edge, type Graph, edges, numEdges, removeEdges } from './graph';
import { connectedComponents } from './paths';
import { edgeBetweennessCentrality } from './centrality';
import { type Rng, seededRandom, shuffle } from '../sim/random';

/** 群別表示法：membership[i] 是節點 i 所屬的群（任意整數）。 */
export type Membership = readonly number[];

/** 群的串列 → 每個節點的群別（0, 1, 2…，依串列順序）。每個節點必須恰好出現一次。 */
export function membershipFromCommunities(n: number, communities: readonly (readonly number[])[]): number[] {
  const m = new Array<number>(n).fill(-1);
  communities.forEach((c, id) => c.forEach((v) => {
    if (m[v] !== -1) throw new Error(`節點 ${v} 出現在兩個群裡`);
    m[v] = id;
  }));
  const missing = m.indexOf(-1);
  if (missing >= 0) throw new Error(`節點 ${missing} 不在任何群裡`);
  return m;
}

/** 每個節點的群別 → 群的串列；群依最小成員排序，成員由小到大。 */
export function communitiesFromMembership(membership: Membership): number[][] {
  const groups = new Map<number, number[]>();
  membership.forEach((c, v) => { if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(v); });
  return [...groups.values()].sort((a, b) => a[0] - b[0]);
}

/** 模組度 Q = Σ_c [ L_c/m − γ (d_c / 2m)² ]，L_c 是群內連結數、d_c 是群內度數和。 */
export function modularity(g: Graph, membership: Membership, resolution = 1): number {
  if (membership.length !== g.n) throw new RangeError('membership 長度必須等於節點數');
  const m = numEdges(g);
  if (m === 0) return 0;
  const inside = new Map<number, number>(), degSum = new Map<number, number>();
  for (let u = 0; u < g.n; u++) {
    const c = membership[u];
    degSum.set(c, (degSum.get(c) ?? 0) + g.adj[u].length);
    for (const v of g.adj[u]) if (u < v && membership[v] === c) inside.set(c, (inside.get(c) ?? 0) + 1);
  }
  let q = 0;
  for (const [c, d] of degSum) q += (inside.get(c) ?? 0) / m - resolution * (d / (2 * m)) ** 2;
  return q;
}

// ---------------------------------------------------------------- Louvain

/** 加權圖（Louvain 聚合用）：nbr/w 不含自環，self[i] 是自環權重。 */
interface WGraph { nbr: number[][]; w: number[][]; self: number[] }

function toWeighted(g: Graph): WGraph {
  return { nbr: g.adj.map((a) => [...a]), w: g.adj.map((a) => a.map(() => 1)), self: new Array(g.n).fill(0) };
}

/** 單層移動：回傳每個節點的新群別（重新編號為 0..C-1）以及是否有人移動。 */
function moveNodes(G: WGraph, gamma: number, rng: Rng): { comm: number[]; moved: boolean } {
  const N = G.nbr.length;
  const k = G.nbr.map((ns, i) => G.w[i].reduce((s, x) => s + x, 0) + 2 * G.self[i]);
  const m2 = k.reduce((s, x) => s + x, 0);
  const comm = Array.from({ length: N }, (_, i) => i);
  const tot = k.slice();
  let movedAny = false;
  const order = shuffle(rng, Array.from({ length: N }, (_, i) => i));
  for (let improved = true; improved;) {
    improved = false;
    for (const i of order) {
      const ci = comm[i];
      const wTo = new Map<number, number>();
      G.nbr[i].forEach((j, t) => wTo.set(comm[j], (wTo.get(comm[j]) ?? 0) + G.w[i][t]));
      tot[ci] -= k[i];
      let best = ci;
      let bestGain = (wTo.get(ci) ?? 0) - (gamma * tot[ci] * k[i]) / m2;
      for (const [c, wic] of wTo) {
        const gain = wic - (gamma * tot[c] * k[i]) / m2;
        if (gain > bestGain + 1e-12) { best = c; bestGain = gain; }
      }
      tot[best] += k[i];
      if (best !== ci) { comm[i] = best; improved = true; movedAny = true; }
    }
  }
  const relabel = new Map<number, number>();
  return { comm: comm.map((c) => { if (!relabel.has(c)) relabel.set(c, relabel.size); return relabel.get(c)!; }), moved: movedAny };
}

function aggregate(G: WGraph, comm: number[]): WGraph {
  const C = Math.max(-1, ...comm) + 1;
  const maps = Array.from({ length: C }, () => new Map<number, number>());
  const self = new Array<number>(C).fill(0);
  for (let i = 0; i < G.nbr.length; i++) {
    self[comm[i]] += G.self[i];
    G.nbr[i].forEach((j, t) => {
      if (j < i) return; // 每條連結只算一次
      const a = comm[i], b = comm[j], w = G.w[i][t];
      if (a === b) self[a] += w;
      else {
        maps[a].set(b, (maps[a].get(b) ?? 0) + w);
        maps[b].set(a, (maps[b].get(a) ?? 0) + w);
      }
    });
  }
  return { nbr: maps.map((mp) => [...mp.keys()]), w: maps.map((mp) => [...mp.values()]), self };
}

export interface LouvainOptions {
  /** 隨機種子（預設 0）；同一個種子結果一定相同。 */
  seed?: number;
  /** 直接給隨機數產生器時優先使用。 */
  rng?: Rng;
  /** 解析度 γ，預設 1。 */
  resolution?: number;
  /** 某一層模組度的提升小於這個值就停止，預設 1e-7（同 networkx）。 */
  threshold?: number;
}

export interface LouvainResult {
  /** 最終每個節點的群別。 */
  membership: number[];
  /** 每一層合併後每個（原始）節點的群別，給「一步一步合併」的動畫用。 */
  levels: number[][];
  modularity: number;
}

/** Louvain 社群偵測（Blondel 等人 2008）。 */
export function louvain(g: Graph, opts: LouvainOptions = {}): LouvainResult {
  const gamma = opts.resolution ?? 1, threshold = opts.threshold ?? 1e-7;
  const rng = opts.rng ?? seededRandom(opts.seed ?? 0);
  let membership = Array.from({ length: g.n }, (_, i) => i);
  const levels: number[][] = [];
  if (numEdges(g) === 0) return { membership, levels, modularity: 0 };
  let G = toWeighted(g);
  let q = modularity(g, membership, gamma);
  for (;;) {
    const { comm, moved } = moveNodes(G, gamma, rng);
    if (!moved) break;
    const next = membership.map((c) => comm[c]);
    const nextQ = modularity(g, next, gamma);
    if (nextQ - q <= threshold) break;
    membership = next; q = nextQ; levels.push(next);
    G = aggregate(G, comm);
  }
  return { membership, levels, modularity: q };
}

// ---------------------------------------------------------------- Girvan–Newman

export interface GirvanNewmanSplit {
  /** 這一次分裂前依序拿掉的連結。 */
  removed: Edge[];
  /** 分裂後的連通群（依最小成員排序）。 */
  communities: number[][];
}

/**
 * Girvan–Newman：反覆拿掉介數最高的連結，每當連通群數增加就產生一次分裂。
 * 同分時拿 edges(g) 順序中最前面的連結。maxSplits 預設跑到所有連結都被拿掉。
 */
export function girvanNewman(g: Graph, maxSplits = Infinity): GirvanNewmanSplit[] {
  const splits: GirvanNewmanSplit[] = [];
  let h = g;
  let count = connectedComponents(h).length;
  let removed: Edge[] = [];
  while (numEdges(h) > 0 && splits.length < maxSplits) {
    const eb = edgeBetweennessCentrality(h);
    let best = eb[0];
    for (const e of eb) if (e.value > best.value * (1 + 1e-12) + 1e-15) best = e;
    removed.push([best.u, best.v]);
    h = removeEdges(h, [[best.u, best.v]]);
    const comps = connectedComponents(h);
    if (comps.length > count) {
      count = comps.length;
      splits.push({ removed, communities: comps.sort((a, b) => a[0] - b[0]) });
      removed = [];
    }
  }
  return splits;
}

/** 方便用：取一張圖的所有連結（給 UI 用來標記群內 / 跨群連結）。 */
export function classifyEdges(g: Graph, membership: Membership): { u: number; v: number; internal: boolean }[] {
  return edges(g).map(([u, v]) => ({ u, v, internal: membership[u] === membership[v] }));
}
