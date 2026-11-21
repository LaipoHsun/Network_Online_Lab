// 三角形、聚集係數、遷移性、鄰居重疊度（第 3、6 章）。
import { type Graph, edges } from './graph';

function commonCount(a: readonly number[], b: readonly number[]): number {
  // 兩個排序好的鄰居串列的交集大小
  let i = 0, j = 0, c = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { c++; i++; j++; } else if (a[i] < b[j]) i++; else j++;
  }
  return c;
}

/** 每個節點所在的三角形數。 */
export function triangles(g: Graph): number[] {
  return Array.from({ length: g.n }, (_, i) => {
    const a = g.adj[i];
    let t = 0;
    for (const j of a) t += commonCount(a, g.adj[j]);
    return t / 2;
  });
}

/** 局部聚集係數 C_i = 2T_i / k_i(k_i − 1)；度小於 2 時為 0（同 networkx）。 */
export function clustering(g: Graph): number[] {
  const tri = triangles(g);
  return tri.map((t, i) => {
    const k = g.adj[i].length;
    return k < 2 ? 0 : (2 * t) / (k * (k - 1));
  });
}

/** 平均局部聚集係數（度小於 2 的節點以 0 計入，同 networkx 預設）。 */
export function averageClustering(g: Graph): number {
  if (g.n === 0) return 0;
  return clustering(g).reduce((s, c) => s + c, 0) / g.n;
}

/** 全域遷移性 T = 3 × 三角形數 / 連通三元組數。 */
export function transitivity(g: Graph): number {
  const tri = triangles(g).reduce((s, t) => s + t, 0); // = 3 × 三角形數
  let triads = 0;
  for (const a of g.adj) triads += (a.length * (a.length - 1)) / 2;
  return triads === 0 ? 0 : tri / triads;
}

/** i、j 的共同朋友數 n_ij。 */
export function commonNeighbors(g: Graph, i: number, j: number): number {
  return commonCount(g.adj[i], g.adj[j]);
}

/**
 * 鄰居重疊度 O_ij = n_ij / ((k_i − 1) + (k_j − 1) − n_ij)（第 6 章）。
 * 分母為 0（兩端除了彼此沒有其他朋友）時回傳 0。
 */
export function neighborhoodOverlap(g: Graph, i: number, j: number): number {
  const n = commonNeighbors(g, i, j);
  const denom = (g.adj[i].length - 1) + (g.adj[j].length - 1) - n;
  return denom > 0 ? n / denom : 0;
}

/** 每條連結的鄰居重疊度，順序同 edges(g)。 */
export function edgeOverlaps(g: Graph): { u: number; v: number; overlap: number }[] {
  return edges(g).map(([u, v]) => ({ u, v, overlap: neighborhoodOverlap(g, u, v) }));
}
