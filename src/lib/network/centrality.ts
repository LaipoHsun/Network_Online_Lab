// 中心性：度、接近、介數（節點與連結）、特徵向量、Katz（第 7、8 章）。
// 正規化方式都和 networkx 的預設一致。
import { type Graph, edges } from './graph';
import { bfsDistances } from './paths';

/** 度中心性 k_i / (N − 1)。 */
export function degreeCentrality(g: Graph): number[] {
  const s = g.n > 1 ? 1 / (g.n - 1) : 1;
  return g.adj.map((a) => a.length * s);
}

/**
 * 接近中心性。連通時為 (N − 1) / Σ_j d_ij；不連通時採 Wasserman–Faust 修正
 * （networkx 預設 wf_improved=True）：((r − 1)/(N − 1)) × ((r − 1)/Σ_j d_ij)，r 是 i 到得了的人數（含自己）。
 */
export function closenessCentrality(g: Graph): number[] {
  return Array.from({ length: g.n }, (_, i) => {
    const dist = bfsDistances(g, i);
    let sum = 0, reach = 0;
    for (const d of dist) if (d >= 0) { sum += d; reach++; }
    if (sum === 0 || g.n <= 1) return 0;
    return ((reach - 1) / sum) * ((reach - 1) / (g.n - 1));
  });
}

interface Brandes {
  node: number[];
  /** 以 edges(g) 的順序排列 */
  edge: number[];
}

/** Brandes 演算法；回傳「配對數」為單位的原始值（每對 s, t 只算一次）。 */
function brandes(g: Graph): Brandes {
  const es = edges(g);
  const edgeIndex = new Map<number, number>();
  es.forEach(([u, v], k) => edgeIndex.set(u * g.n + v, k));
  const eid = (u: number, v: number) => edgeIndex.get(u < v ? u * g.n + v : v * g.n + u)!;

  const node = new Array<number>(g.n).fill(0);
  const edge = new Array<number>(es.length).fill(0);
  const sigma = new Array<number>(g.n);
  const dist = new Array<number>(g.n);
  const delta = new Array<number>(g.n);
  const preds: number[][] = Array.from({ length: g.n }, () => []);

  for (let s = 0; s < g.n; s++) {
    sigma.fill(0); dist.fill(-1); delta.fill(0);
    for (const p of preds) p.length = 0;
    sigma[s] = 1; dist[s] = 0;
    const order: number[] = [s];
    for (let h = 0; h < order.length; h++) {
      const u = order[h];
      for (const v of g.adj[u]) {
        if (dist[v] < 0) { dist[v] = dist[u] + 1; order.push(v); }
        if (dist[v] === dist[u] + 1) { sigma[v] += sigma[u]; preds[v].push(u); }
      }
    }
    for (let h = order.length - 1; h > 0; h--) {
      const w = order[h];
      for (const v of preds[w]) {
        const c = (sigma[v] / sigma[w]) * (1 + delta[w]);
        edge[eid(v, w)] += c;
        delta[v] += c;
      }
      node[w] += delta[w];
    }
  }
  // 無向圖每對 (s, t) 被 s→t 與 t→s 各算一次
  return { node: node.map((x) => x / 2), edge: edge.map((x) => x / 2) };
}

export interface BetweennessOptions {
  /** 預設 true：除以 (N − 1)(N − 2)/2，也就是「不含自己的配對數」。 */
  normalized?: boolean;
}

/** 介數中心性 Σ_{s<t} σ_st(i) / σ_st。 */
export function betweennessCentrality(g: Graph, opts: BetweennessOptions = {}): number[] {
  const { node } = brandes(g);
  if (opts.normalized === false) return node;
  const pairs = ((g.n - 1) * (g.n - 2)) / 2;
  return pairs > 0 ? node.map((x) => x / pairs) : node.map(() => 0);
}

/** 連結介數，順序同 edges(g)。normalized（預設 true）時除以 N(N − 1)/2。 */
export function edgeBetweennessCentrality(
  g: Graph,
  opts: BetweennessOptions = {},
): { u: number; v: number; value: number }[] {
  const { edge } = brandes(g);
  const pairs = (g.n * (g.n - 1)) / 2;
  const scale = opts.normalized === false || pairs === 0 ? 1 : 1 / pairs;
  return edges(g).map(([u, v], k) => ({ u, v, value: edge[k] * scale }));
}

export interface PowerIterationOptions {
  maxIter?: number;
  tol?: number;
}

function normalizeL2(x: number[]): number[] {
  const norm = Math.hypot(...x);
  return norm === 0 ? x : x.map((v) => v / norm);
}

/**
 * 特徵向量中心性：鄰接矩陣最大特徵值對應的特徵向量，歐氏長度為 1。
 * 和 networkx 一樣用 (A + I) 做冪次迭代，二分圖也會收斂。不收斂時丟錯。
 */
export function eigenvectorCentrality(g: Graph, opts: PowerIterationOptions = {}): number[] {
  const maxIter = opts.maxIter ?? 1000, tol = opts.tol ?? 1e-10;
  if (g.n === 0) return [];
  let x = new Array<number>(g.n).fill(1 / g.n);
  for (let it = 0; it < maxIter; it++) {
    const next = x.slice();
    for (let u = 0; u < g.n; u++) for (const v of g.adj[u]) next[v] += x[u];
    const y = normalizeL2(next);
    let err = 0;
    for (let i = 0; i < g.n; i++) err += Math.abs(y[i] - x[i]);
    x = y;
    if (err < g.n * tol) return x;
  }
  throw new Error(`特徵向量中心性在 ${maxIter} 次迭代內沒有收斂`);
}

export interface KatzOptions extends PowerIterationOptions {
  /** 衰減係數，必須小於 1/λ_max。預設 0.1（同 networkx）。 */
  alpha?: number;
  /** 每個人自帶的基本分，預設 1。 */
  beta?: number;
}

/** Katz 中心性 x = α A x + β，歐氏長度正規化為 1（同 networkx 預設）。不收斂時丟錯。 */
export function katzCentrality(g: Graph, opts: KatzOptions = {}): number[] {
  const alpha = opts.alpha ?? 0.1, beta = opts.beta ?? 1;
  const maxIter = opts.maxIter ?? 1000, tol = opts.tol ?? 1e-10;
  if (g.n === 0) return [];
  let x = new Array<number>(g.n).fill(0);
  for (let it = 0; it < maxIter; it++) {
    const next = new Array<number>(g.n).fill(beta);
    for (let u = 0; u < g.n; u++) for (const v of g.adj[u]) next[v] += alpha * x[u];
    let err = 0;
    for (let i = 0; i < g.n; i++) err += Math.abs(next[i] - x[i]);
    x = next;
    if (err < g.n * tol) return normalizeL2(x);
  }
  throw new Error(`Katz 中心性在 ${maxIter} 次迭代內沒有收斂（alpha 可能大於 1/λ_max）`);
}
