// 網路模型：規則環狀格子、Watts–Strogatz（第 4 章）、Erdős–Rényi 隨機網路（第 3、8 章對照組）。
// 隨機性一律由呼叫端傳入的 Rng 提供（seededRandom），不用 Math.random。
import { type Graph, fromEdges } from './graph';
import { type Rng, randInt } from '../sim/random';

/** 環狀格子：每人連到左右各 ⌊k/2⌋ 位鄰居（同 networkx watts_strogatz_graph(n, k, 0)）。 */
export function ringLattice(n: number, k: number): Graph {
  if (k >= n) throw new RangeError(`k=${k} 必須小於 n=${n}`);
  const es: [number, number][] = [];
  for (let j = 1; j <= k >> 1; j++) for (let u = 0; u < n; u++) es.push([u, (u + j) % n]);
  return fromEdges(n, es);
}

export interface WattsStrogatzResult {
  graph: Graph;
  /** 被重連的連結（重連後的新端點），給「午夜抽卡」的動畫標出捷徑用。 */
  shortcuts: [number, number][];
}

/**
 * Watts–Strogatz（1998）。演算法和 networkx 相同：依序檢查格子上的每條連結 (u, u+j)，
 * 以機率 p 把它的另一端換成一個隨機、尚未相連的人。連結總數不變。
 */
export function wattsStrogatz(n: number, k: number, p: number, rng: Rng): WattsStrogatzResult {
  if (k >= n) throw new RangeError(`k=${k} 必須小於 n=${n}`);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p=${p} 必須在 [0, 1]`);
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  const link = (a: number, b: number) => { nb[a].add(b); nb[b].add(a); };
  const unlink = (a: number, b: number) => { nb[a].delete(b); nb[b].delete(a); };
  for (let j = 1; j <= k >> 1; j++) for (let u = 0; u < n; u++) link(u, (u + j) % n);
  const shortcuts = new Map<string, [number, number]>();
  for (let j = 1; j <= k >> 1; j++) {
    for (let u = 0; u < n; u++) {
      const v = (u + j) % n;
      if (rng() >= p || !nb[u].has(v)) continue;
      if (nb[u].size >= n - 1) continue; // 已經認識所有人，無處可連
      let w: number;
      do { w = randInt(rng, n); } while (w === u || nb[u].has(w));
      unlink(u, v);
      link(u, w);
      shortcuts.delete(u < v ? `${u}-${v}` : `${v}-${u}`);
      shortcuts.set(u < w ? `${u}-${w}` : `${w}-${u}`, u < w ? [u, w] : [w, u]);
    }
  }
  const es: [number, number][] = [];
  nb.forEach((s, u) => s.forEach((v) => { if (u < v) es.push([u, v]); }));
  return { graph: fromEdges(n, es), shortcuts: [...shortcuts.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]) };
}

/** G(n, p) 隨機網路：每一對獨立地以機率 p 相連。 */
export function erdosRenyi(n: number, p: number, rng: Rng): Graph {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p=${p} 必須在 [0, 1]`);
  const es: [number, number][] = [];
  for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (rng() < p) es.push([u, v]);
  return fromEdges(n, es);
}
