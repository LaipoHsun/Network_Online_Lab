import { fromEdges, type Graph } from '../../src/lib/network';
import karate from '../fixtures/networkx/karate.json';
import florentine from '../fixtures/networkx/florentine.json';
import toy from '../fixtures/networkx/toy.json';
import wattsStrogatz from '../fixtures/networkx/watts_strogatz.json';

export type Fixture = Record<string, any> & { labels: string[]; n: number; edges: [number, number][] };

const FIXTURES: Record<string, unknown> = { karate, florentine, toy, watts_strogatz: wattsStrogatz };

/** 讀 data/scripts/networkx_expected.py 產生的期望值。 */
export function loadFixture(name: string): Fixture {
  if (!(name in FIXTURES)) throw new Error(`沒有 ${name} 的 fixture`);
  return FIXTURES[name] as Fixture;
}

export function graphOf(f: Fixture): Graph {
  return fromEdges(f.n, f.edges, f.labels);
}

/** 群串列的正規形式，方便比較（群內排序、群之間依最小成員排序）。 */
export function canonical(communities: number[][]): number[][] {
  return communities.map((c) => [...c].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
}
