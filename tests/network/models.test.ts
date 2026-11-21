// 隨機模型無法和 networkx 逐位元比對（兩邊的隨機數產生器不同），
// 所以測確定性的極限情況、守恆量和統計性質。
import { describe, it, expect } from 'vitest';
import * as net from '../../src/lib/network';
import { seededRandom } from '../../src/lib/sim/random';
import { graphOf, loadFixture } from './fixtures';

describe('Watts–Strogatz', () => {
  it('任何 p 都保留連結數 nk/2，也沒有自環或重複連結', () => {
    for (const p of [0, 0.01, 0.1, 0.5, 1]) {
      const { graph } = net.wattsStrogatz(60, 6, p, seededRandom(1));
      expect(net.numEdges(graph)).toBe(180);
      graph.adj.forEach((a, i) => { expect(a).not.toContain(i); expect(new Set(a).size).toBe(a.length); });
    }
  });
  it('同一個種子結果相同', () => {
    expect(net.wattsStrogatz(60, 6, 0.1, seededRandom(3))).toEqual(net.wattsStrogatz(60, 6, 0.1, seededRandom(3)));
  });
  it('p = 0 的聚集係數等於 3(k−2)/4(k−1)', () => {
    expect(net.averageClustering(net.ringLattice(100, 6))).toBeCloseTo((3 * 4) / (4 * 5), 12);
  });
  it('小世界：p = 0.05 時距離大幅縮短，聚集係數仍接近格子', () => {
    const base = net.ringLattice(200, 8);
    const d0 = net.averageShortestPathLength(base), c0 = net.averageClustering(base);
    let d = 0, c = 0;
    for (let s = 0; s < 10; s++) {
      const g = net.wattsStrogatz(200, 8, 0.05, seededRandom(100 + s)).graph;
      d += net.averageShortestPathLength(g, { disconnected: 'reachable' }) / 10;
      c += net.averageClustering(g) / 10;
    }
    expect(d / d0).toBeLessThan(0.5);
    expect(c / c0).toBeGreaterThan(0.7);
  });
  it('shortcuts 都是圖上真的連結', () => {
    const { graph, shortcuts } = net.wattsStrogatz(60, 6, 0.2, seededRandom(9));
    expect(shortcuts.length).toBeGreaterThan(0);
    for (const [u, v] of shortcuts) expect(net.hasEdge(graph, u, v)).toBe(true);
  });
});

describe('Erdős–Rényi', () => {
  it('p = 0 與 p = 1', () => {
    expect(net.numEdges(net.erdosRenyi(30, 0, seededRandom(1)))).toBe(0);
    expect(net.numEdges(net.erdosRenyi(30, 1, seededRandom(1)))).toBe(435);
  });
  it('平均連結數接近 p·N(N−1)/2', () => {
    let m = 0;
    for (let s = 0; s < 50; s++) m += net.numEdges(net.erdosRenyi(100, 0.05, seededRandom(s))) / 50;
    expect(Math.abs(m - 247.5)).toBeLessThan(10);
  });
});

describe('SIR', () => {
  const f = loadFixture('karate');
  const g = graphOf(f);
  it('β = μ = 1 時感染時間等於 BFS 距離（與 networkx 距離一致）', () => {
    const r = net.sir(g, { beta: 1, mu: 1, seeds: [0], rng: seededRandom(1) });
    expect(r.infectedAt).toEqual(f.distances[0]);
    expect(r.counts.at(-1)).toEqual({ S: 0, I: 0, R: 34 });
  });
  it('不連通的圖：只感染種子所在的連通群', () => {
    const toy = loadFixture('toy');
    const r = net.sir(graphOf(toy), { beta: 1, mu: 1, seeds: [6], rng: seededRandom(1) });
    expect(r.infectedAt).toEqual(toy.distances[6]);
  });
  it('S + I + R 守恆、同種子可重現', () => {
    const run = () => net.sir(g, { beta: 0.3, mu: 0.2, seeds: [33], rng: seededRandom(42) });
    const r = run();
    for (const c of r.counts) expect(c.S + c.I + c.R).toBe(34);
    expect(r.counts.at(-1)!.I).toBe(0);
    expect(run()).toEqual(r);
  });
  it('β = 0 時只有種子生病', () => {
    const r = net.sir(g, { beta: 0, mu: 0.5, seeds: [0, 1], rng: seededRandom(5) });
    expect(r.infectedAt.filter((t) => t >= 0)).toHaveLength(2);
  });
  it('sirStateAt 與計數一致', () => {
    const r = net.sir(g, { beta: 0.4, mu: 0.3, seeds: [0], rng: seededRandom(8) });
    r.counts.forEach((c, t) => {
      const s = net.sirStateAt(r, t);
      expect({ S: s.filter((x) => x === 'S').length, I: s.filter((x) => x === 'I').length, R: s.filter((x) => x === 'R').length }).toEqual(c);
    });
  });
});

describe('門檻模型', () => {
  it('θ = 1 等於 BFS 擴散', () => {
    const f = loadFixture('florentine');
    const r = net.thresholdCascade(graphOf(f), { seeds: [0], theta: 1 });
    expect(r.adoptedAt).toEqual(f.distances[0]);
  });
  it('複雜傳染：格子上 θ = 2 傳得開，同度數的捷徑網路傳不開', () => {
    const lattice = net.ringLattice(60, 4);
    const seeds = [0, 1];
    expect(net.thresholdCascade(lattice, { seeds, theta: 2 }).adopters.at(-1)).toBe(60);
    // 全部重連（p = 1）：連結數相同，但兩位種子的朋友很少重疊
    for (let s = 0; s < 10; s++) {
      const random = net.wattsStrogatz(60, 4, 1, seededRandom(s)).graph;
      expect(net.thresholdCascade(random, { seeds, theta: 2 }).adopters.at(-1)).toBeLessThan(30);
    }
  });
  it('每人不同的門檻', () => {
    const g = net.fromEdges(3, [[0, 1], [1, 2], [0, 2]]);
    expect(net.thresholdCascade(g, { seeds: [0], theta: [0, 1, 2] }).adoptedAt).toEqual([0, 1, 2]);
  });
});
