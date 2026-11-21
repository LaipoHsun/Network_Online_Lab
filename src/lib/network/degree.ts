// 度與度分布（第 1、5、9 章）。
import { type Graph, numEdges } from './graph';

export function degrees(g: Graph): number[] {
  return g.adj.map((a) => a.length);
}

/** hist[k] = 度為 k 的節點數，長度為最大度 + 1（同 networkx degree_histogram）。 */
export function degreeHistogram(g: Graph): number[] {
  const ds = degrees(g);
  const hist = new Array<number>(ds.length ? Math.max(...ds) + 1 : 0).fill(0);
  for (const d of ds) hist[d]++;
  return hist;
}

/** 度分布 p_k = 度為 k 的節點比例。 */
export function degreeDistribution(g: Graph): number[] {
  return g.n === 0 ? [] : degreeHistogram(g).map((c) => c / g.n);
}

/** 平均度 ⟨k⟩ = 2m / N。 */
export function averageDegree(g: Graph): number {
  return g.n === 0 ? 0 : (2 * numEdges(g)) / g.n;
}

/** 度的中位數。 */
export function medianDegree(g: Graph): number {
  const ds = degrees(g).sort((a, b) => a - b);
  if (ds.length === 0) return 0;
  const mid = ds.length >> 1;
  return ds.length % 2 ? ds[mid] : (ds[mid - 1] + ds[mid]) / 2;
}

/** ⟨k⟩、⟨k²⟩ 與變異數 ⟨k²⟩ − ⟨k⟩²（第 5 章友誼悖論、第 9 章傳播門檻 ⟨k⟩/⟨k²⟩）。 */
export function degreeMoments(g: Graph): { mean: number; meanSquare: number; variance: number } {
  const ds = degrees(g);
  if (ds.length === 0) return { mean: 0, meanSquare: 0, variance: 0 };
  const mean = ds.reduce((s, d) => s + d, 0) / ds.length;
  const meanSquare = ds.reduce((s, d) => s + d * d, 0) / ds.length;
  return { mean, meanSquare, variance: meanSquare - mean * mean };
}

/** 朋友的平均度 ⟨k²⟩/⟨k⟩（隨機挑一條連結，連結另一端的人的期望度）。 */
export function meanNeighborDegree(g: Graph): number {
  const { mean, meanSquare } = degreeMoments(g);
  return mean === 0 ? 0 : meanSquare / mean;
}

/** 密度 2m / N(N−1)。 */
export function density(g: Graph): number {
  return g.n <= 1 ? 0 : (2 * numEdges(g)) / (g.n * (g.n - 1));
}
