// 路徑與距離：BFS、最短路徑、連通群、平均距離、橋與局部橋。
import { type Edge, type Graph, edges, edgeKey } from './graph';

/** 從 source 出發的 BFS 距離；到不了的節點為 -1。 */
export function bfsDistances(g: Graph, source: number): number[] {
  const dist = new Array<number>(g.n).fill(-1);
  dist[source] = 0;
  const queue = [source];
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const v of g.adj[u]) if (dist[v] < 0) { dist[v] = dist[u] + 1; queue.push(v); }
  }
  return dist;
}

/** BFS 的一層層「漣漪」：layers[d] 是距離 source 恰好 d 的節點（由小到大）。 */
export function bfsLayers(g: Graph, source: number): number[][] {
  const dist = bfsDistances(g, source);
  const layers: number[][] = [];
  dist.forEach((d, v) => { if (d >= 0) (layers[d] ??= []).push(v); });
  return layers;
}

/** s 到 t 的一條最短路徑（含兩端）；不連通時回傳 null。多條等長時取編號較小的前驅。 */
export function shortestPath(g: Graph, s: number, t: number): number[] | null {
  if (s === t) return [s];
  const prev = new Array<number>(g.n).fill(-1);
  const seen = new Array<boolean>(g.n).fill(false);
  seen[s] = true;
  const queue = [s];
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const v of g.adj[u]) {
      if (seen[v]) continue;
      seen[v] = true; prev[v] = u;
      if (v === t) {
        const path = [t];
        for (let x = u; x !== -1; x = prev[x]) path.push(x);
        return path.reverse();
      }
      queue.push(v);
    }
  }
  return null;
}

/** 所有配對的距離矩陣；到不了為 -1。 */
export function allPairsDistances(g: Graph): number[][] {
  return Array.from({ length: g.n }, (_, s) => bfsDistances(g, s));
}

/** 連通群，依大小由大到小排列（同大小時依最小節點編號）；每群內節點由小到大。 */
export function connectedComponents(g: Graph): number[][] {
  const comp = new Array<number>(g.n).fill(-1);
  const out: number[][] = [];
  for (let s = 0; s < g.n; s++) {
    if (comp[s] >= 0) continue;
    const id = out.length, members = [s];
    comp[s] = id;
    for (let h = 0; h < members.length; h++) {
      for (const v of g.adj[members[h]]) if (comp[v] < 0) { comp[v] = id; members.push(v); }
    }
    out.push(members.sort((a, b) => a - b));
  }
  return out.sort((a, b) => b.length - a.length || a[0] - b[0]);
}

export function isConnected(g: Graph): boolean {
  return g.n > 0 && connectedComponents(g).length === 1;
}

/** 最大連通群的節點數。 */
export function largestComponentSize(g: Graph): number {
  return g.n === 0 ? 0 : connectedComponents(g)[0].length;
}

/** 最大連通群佔全體的比例 S = |最大連通群| / N（第 6 章的滲流曲線）。 */
export function largestComponentFraction(g: Graph): number {
  return g.n === 0 ? 0 : largestComponentSize(g) / g.n;
}

export interface AveragePathOptions {
  /**
   * 'error'（預設，和 networkx 一樣）：網路不連通就丟錯。
   * 'reachable'：只平均彼此到得了的配對。
   */
  disconnected?: 'error' | 'reachable';
}

/** 平均距離 ⟨d⟩ = Σ_{i≠j} d_ij / N(N−1)。 */
export function averageShortestPathLength(g: Graph, opts: AveragePathOptions = {}): number {
  const mode = opts.disconnected ?? 'error';
  if (g.n <= 1) return 0;
  let sum = 0, pairs = 0;
  for (let s = 0; s < g.n; s++) {
    const dist = bfsDistances(g, s);
    for (let t = 0; t < g.n; t++) {
      if (t === s) continue;
      if (dist[t] < 0) {
        if (mode === 'error') throw new Error('網路不連通，平均距離沒有定義（可改用 { disconnected: "reachable" }）');
        continue;
      }
      sum += dist[t]; pairs++;
    }
  }
  return pairs === 0 ? 0 : sum / pairs;
}

/** 每個節點的離心率（到最遠節點的距離）；網路不連通時丟錯。 */
export function eccentricity(g: Graph): number[] {
  return Array.from({ length: g.n }, (_, s) => {
    const dist = bfsDistances(g, s);
    if (dist.some((d) => d < 0)) throw new Error('網路不連通，離心率沒有定義');
    return Math.max(...dist);
  });
}

/** 直徑：最遠的一對節點之間的距離；網路不連通時丟錯。 */
export function diameter(g: Graph): number {
  return g.n === 0 ? 0 : Math.max(...eccentricity(g));
}

/** 橋：拿掉後連通群數會增加的連結（Tarjan 演算法）。依 (u, v) 排序，u < v。 */
export function bridges(g: Graph): Edge[] {
  const disc = new Array<number>(g.n).fill(-1);
  const low = new Array<number>(g.n).fill(0);
  const out: Edge[] = [];
  let time = 0;
  for (let root = 0; root < g.n; root++) {
    if (disc[root] >= 0) continue;
    // 迭代式 DFS，避免大圖時遞迴過深
    const stack: { u: number; parent: number; i: number }[] = [{ u: root, parent: -1, i: 0 }];
    disc[root] = low[root] = time++;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const nbrs = g.adj[top.u];
      if (top.i < nbrs.length) {
        const v = nbrs[top.i++];
        if (v === top.parent) continue;
        if (disc[v] < 0) {
          disc[v] = low[v] = time++;
          stack.push({ u: v, parent: top.u, i: 0 });
        } else {
          low[top.u] = Math.min(low[top.u], disc[v]);
        }
      } else {
        stack.pop();
        if (top.parent >= 0) {
          low[top.parent] = Math.min(low[top.parent], low[top.u]);
          if (low[top.u] > disc[top.parent]) {
            out.push(top.parent < top.u ? [top.parent, top.u] : [top.u, top.parent]);
          }
        }
      }
    }
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export interface LocalBridge {
  u: number;
  v: number;
  /** 拿掉這條連結後 u、v 的距離；拿掉後不再連通則為 -1（也就是一座橋）。 */
  span: number;
}

/** 局部橋：兩端沒有共同朋友的連結，附上跨度（span）。對應 networkx 的 local_bridges(with_span=True)。 */
export function localBridges(g: Graph): LocalBridge[] {
  const out: LocalBridge[] = [];
  for (const [u, v] of edges(g)) {
    const nv = new Set(g.adj[v]);
    if (g.adj[u].some((w) => nv.has(w))) continue;
    out.push({ u, v, span: distanceWithoutEdge(g, u, v) });
  }
  return out;
}

function distanceWithoutEdge(g: Graph, s: number, t: number): number {
  const skip = edgeKey(s, t);
  const dist = new Array<number>(g.n).fill(-1);
  dist[s] = 0;
  const queue = [s];
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const v of g.adj[u]) {
      if (dist[v] >= 0 || edgeKey(u, v) === skip) continue;
      dist[v] = dist[u] + 1;
      if (v === t) return dist[v];
      queue.push(v);
    }
  }
  return -1;
}
