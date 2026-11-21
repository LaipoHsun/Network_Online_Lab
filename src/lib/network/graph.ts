// 無向、無權重的簡單圖。節點編號 0..n-1，鄰居串列由小到大排好，所有函式都是純函式。

export type Edge = readonly [number, number];

export interface Graph {
  readonly n: number;
  /** adj[i] 是 i 的鄰居，由小到大排序、不重複、不含自己。 */
  readonly adj: readonly (readonly number[])[];
  /** 節點名稱（可選），例如家族名或角色 id。 */
  readonly labels?: readonly string[];
}

/** 由連結串列建圖。重複的連結與自環會被忽略。 */
export function fromEdges(n: number, edges: Iterable<readonly [number, number]>, labels?: readonly string[]): Graph {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`n 必須是非負整數，收到 ${n}`);
  if (labels && labels.length !== n) throw new RangeError(`labels 長度 ${labels.length} 和 n=${n} 不符`);
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (const [u, v] of edges) {
    if (!(u >= 0 && u < n && v >= 0 && v < n) || !Number.isInteger(u) || !Number.isInteger(v)) {
      throw new RangeError(`連結 (${u}, ${v}) 超出節點範圍 0..${n - 1}`);
    }
    if (u === v) continue;
    sets[u].add(v);
    sets[v].add(u);
  }
  const adj = sets.map((s) => [...s].sort((a, b) => a - b));
  return labels ? { n, adj, labels: [...labels] } : { n, adj };
}

/** 空圖（n 個孤立點）。 */
export function emptyGraph(n: number, labels?: readonly string[]): Graph {
  return fromEdges(n, [], labels);
}

/** 所有連結，每條一次，u < v，依 (u, v) 排序。 */
export function edges(g: Graph): Edge[] {
  const out: Edge[] = [];
  for (let u = 0; u < g.n; u++) for (const v of g.adj[u]) if (u < v) out.push([u, v]);
  return out;
}

export function numEdges(g: Graph): number {
  let s = 0;
  for (const a of g.adj) s += a.length;
  return s / 2;
}

export function degree(g: Graph, i: number): number {
  return g.adj[i].length;
}

export function hasEdge(g: Graph, u: number, v: number): boolean {
  const a = g.adj[u];
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] === v) return true;
    if (a[mid] < v) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}

/** 連結的正規化鍵，給 Map / Set 用。 */
export function edgeKey(u: number, v: number): string {
  return u < v ? `${u}-${v}` : `${v}-${u}`;
}

/** 回傳拿掉指定連結後的新圖。 */
export function removeEdges(g: Graph, remove: Iterable<readonly [number, number]>): Graph {
  const drop = new Set<string>();
  for (const [u, v] of remove) drop.add(edgeKey(u, v));
  return fromEdges(g.n, edges(g).filter(([u, v]) => !drop.has(edgeKey(u, v))), g.labels);
}

/** 回傳加上指定連結後的新圖。 */
export function addEdges(g: Graph, add: Iterable<readonly [number, number]>): Graph {
  return fromEdges(g.n, [...edges(g), ...add], g.labels);
}

/** 拿掉指定節點（連同它的連結）。節點編號不變，被拿掉的節點變成孤立點。 */
export function isolateNodes(g: Graph, nodes: Iterable<number>): Graph {
  const gone = new Set(nodes);
  return fromEdges(g.n, edges(g).filter(([u, v]) => !gone.has(u) && !gone.has(v)), g.labels);
}

/** 由 nodes 誘導出的子圖，節點重新編號為 0..k-1；回傳新圖與「新編號 → 原編號」對照。 */
export function subgraph(g: Graph, nodes: readonly number[]): { graph: Graph; original: number[] } {
  const original = [...new Set(nodes)].sort((a, b) => a - b);
  const index = new Map(original.map((v, i) => [v, i]));
  const es: [number, number][] = [];
  for (const u of original) for (const v of g.adj[u]) {
    if (u < v && index.has(v)) es.push([index.get(u)!, index.get(v)!]);
  }
  const labels = g.labels ? original.map((v) => g.labels![v]) : undefined;
  return { graph: fromEdges(original.length, es, labels), original };
}
