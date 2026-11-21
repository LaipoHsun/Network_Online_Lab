// 每個函式在空手道社、佛羅倫斯婚姻網路、以及一張不連通的小圖上，和 networkx 的結果逐一比對。
// 期望值由 data/scripts/networkx_expected.py 產生。
import { describe, it, expect } from 'vitest';
import * as net from '../../src/lib/network';
import { canonical, graphOf, loadFixture } from './fixtures';

const DIGITS = 10;

function expectClose(actual: number[], expected: number[], digits = DIGITS) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((a, i) => expect(a, `index ${i}`).toBeCloseTo(expected[i], digits));
}

describe.each(['karate', 'florentine', 'toy'])('%s 與 networkx 一致', (name) => {
  const f = loadFixture(name);
  const g = graphOf(f);

  it('基本結構', () => {
    expect(g.n).toBe(f.n);
    expect(net.edges(g)).toEqual(f.edges);
    expect(net.numEdges(g)).toBe(f.edges.length);
  });

  describe('度', () => {
    it('degrees', () => expect(net.degrees(g)).toEqual(f.degree));
    it('degreeHistogram', () => expect(net.degreeHistogram(g)).toEqual(f.degree_histogram));
    it('degreeDistribution 加總為 1', () => {
      const p = net.degreeDistribution(g);
      expectClose(p, f.degree_histogram.map((c: number) => c / f.n));
      expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    });
    it('averageDegree', () => expect(net.averageDegree(g)).toBeCloseTo(f.average_degree, DIGITS));
    it('density', () => expect(net.density(g)).toBeCloseTo(f.density, DIGITS));
    it('degreeMoments', () => {
      const m = net.degreeMoments(g);
      const ds: number[] = f.degree;
      expect(m.mean).toBeCloseTo(f.average_degree, DIGITS);
      expect(m.meanSquare).toBeCloseTo(ds.reduce((s, d) => s + d * d, 0) / f.n, DIGITS);
      expect(m.variance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('路徑與距離', () => {
    it('bfsDistances / allPairsDistances', () => {
      expect(net.allPairsDistances(g)).toEqual(f.distances);
      expect(net.bfsDistances(g, 0)).toEqual(f.distances[0]);
    });
    it('bfsLayers 與距離一致', () => {
      net.bfsLayers(g, 0).forEach((layer, d) => layer.forEach((v) => expect(f.distances[0][v]).toBe(d)));
    });
    it('shortestPath 長度等於距離，而且每一步都是連結', () => {
      for (let s = 0; s < g.n; s++) for (let t = 0; t < g.n; t++) {
        const p = net.shortestPath(g, s, t);
        if (f.distances[s][t] < 0) { expect(p).toBeNull(); continue; }
        expect(p!.length - 1).toBe(f.distances[s][t]);
        expect(p![0]).toBe(s); expect(p![p!.length - 1]).toBe(t);
        for (let i = 1; i < p!.length; i++) expect(net.hasEdge(g, p![i - 1], p![i])).toBe(true);
      }
    });
    it('connectedComponents', () => {
      expect(canonical(net.connectedComponents(g))).toEqual(canonical(f.connected_components));
      expect(net.isConnected(g)).toBe(f.is_connected);
      expect(net.largestComponentSize(g)).toBe(Math.max(...f.connected_components.map((c: number[]) => c.length)));
    });
    it('averageShortestPathLength / diameter', () => {
      if (f.is_connected) {
        expect(net.averageShortestPathLength(g)).toBeCloseTo(f.average_shortest_path_length, DIGITS);
        expect(net.diameter(g)).toBe(f.diameter);
      } else {
        expect(() => net.averageShortestPathLength(g)).toThrow();
        expect(() => net.diameter(g)).toThrow();
        // 'reachable'：只平均到得了的配對
        let sum = 0, pairs = 0;
        f.distances.forEach((row: number[], s: number) => row.forEach((d, t) => { if (s !== t && d > 0) { sum += d; pairs++; } }));
        expect(net.averageShortestPathLength(g, { disconnected: 'reachable' })).toBeCloseTo(sum / pairs, DIGITS);
      }
    });
    it('bridges', () => expect(net.bridges(g)).toEqual(f.bridges));
    it('localBridges（含 span）', () => {
      expect(net.localBridges(g).map((b) => [b.u, b.v, b.span])).toEqual(f.local_bridges);
    });
  });

  describe('聚集', () => {
    it('triangles', () => expect(net.triangles(g)).toEqual(f.triangles));
    it('clustering', () => expectClose(net.clustering(g), f.clustering));
    it('averageClustering', () => expect(net.averageClustering(g)).toBeCloseTo(f.average_clustering, DIGITS));
    it('transitivity', () => expect(net.transitivity(g)).toBeCloseTo(f.transitivity, DIGITS));
    it('neighborhoodOverlap', () => {
      const got = net.edgeOverlaps(g);
      expect(got.map((e) => [e.u, e.v])).toEqual(f.neighborhood_overlap.map((e: number[]) => [e[0], e[1]]));
      expectClose(got.map((e) => e.overlap), f.neighborhood_overlap.map((e: number[]) => e[2]));
    });
  });

  describe('中心性', () => {
    it('degreeCentrality', () => expectClose(net.degreeCentrality(g), f.degree_centrality));
    it('closenessCentrality', () => expectClose(net.closenessCentrality(g), f.closeness_centrality));
    it('betweennessCentrality（正規化與原始值）', () => {
      expectClose(net.betweennessCentrality(g), f.betweenness_centrality);
      expectClose(net.betweennessCentrality(g, { normalized: false }), f.betweenness_centrality_raw);
    });
    it('edgeBetweennessCentrality', () => {
      const got = net.edgeBetweennessCentrality(g);
      expect(got.map((e) => [e.u, e.v])).toEqual(f.edge_betweenness_centrality.map((e: number[]) => [e[0], e[1]]));
      expectClose(got.map((e) => e.value), f.edge_betweenness_centrality.map((e: number[]) => e[2]));
    });
    it.runIf(f.is_connected)('eigenvectorCentrality', () => {
      expectClose(net.eigenvectorCentrality(g, { tol: 1e-13, maxIter: 100000 }), f.eigenvector_centrality, 8);
    });
    it.runIf(f.is_connected)('katzCentrality', () => {
      expectClose(net.katzCentrality(g, { alpha: 0.1, tol: 1e-13, maxIter: 100000 }), f.katz_centrality, 8);
    });
  });

  describe('社群', () => {
    it('modularity：全部一群、每人一群、greedy 分法', () => {
      for (const key of ['all_in_one', 'singletons', 'greedy']) {
        const { partition, Q } = f.modularity[key];
        expect(net.modularity(g, net.membershipFromCommunities(g.n, partition)), key).toBeCloseTo(Q, DIGITS);
      }
    });
    it('louvain：Q 不低於 networkx 50 個種子的最小值，且結果可重現', () => {
      for (let seed = 0; seed < 20; seed++) {
        const r = net.louvain(g, { seed });
        expect(r.modularity).toBeCloseTo(net.modularity(g, r.membership), 12);
        expect(r.modularity).toBeGreaterThanOrEqual(f.louvain_Q.min - 1e-9);
        expect(r.modularity).toBeLessThanOrEqual(f.louvain_Q.max + 0.02);
      }
      expect(net.louvain(g, { seed: 7 })).toEqual(net.louvain(g, { seed: 7 }));
    });
    it.runIf(f.girvan_newman_first_split)('girvanNewman 第一次分裂', () => {
      const [first] = net.girvanNewman(g, 1);
      expect(canonical(first.communities)).toEqual(canonical(f.girvan_newman_first_split));
    });
  });

  describe.runIf(f.threshold)('門檻模型（與 Python 參考實作一致）', () => {
    for (const c of (f.threshold ?? []) as { seeds: number[]; theta: number; adopt_time: number[] }[]) {
      it(`種子 ${c.seeds.join(',')}，θ = ${c.theta}`, () => {
        expect(net.thresholdCascade(g, { seeds: c.seeds, theta: c.theta }).adoptedAt).toEqual(c.adopt_time);
      });
    }
  });
});

describe('空手道社：真實分裂', () => {
  const f = loadFixture('karate');
  const g = graphOf(f);
  it('club 分法的模組度', () => {
    expect(net.modularity(g, net.membershipFromCommunities(g.n, f.club_split.partition))).toBeCloseTo(f.club_split.Q, DIGITS);
  });
});

describe('Watts–Strogatz 與 networkx 一致', () => {
  const f = loadFixture('watts_strogatz');
  it('p = 0 的環狀格子連結完全相同', () => {
    expect(net.edges(net.ringLattice(20, 4))).toEqual(f.ring_n20_k4);
    expect(net.edges(net.wattsStrogatz(20, 4, 0, () => 0.5).graph)).toEqual(f.ring_n20_k4);
  });
  it('n = 60、k = 6 的格子：聚集係數與平均距離', () => {
    const g = net.ringLattice(60, 6);
    expect(net.averageClustering(g)).toBeCloseTo(f.ring_n60_k6_clustering, DIGITS);
    expect(net.averageShortestPathLength(g)).toBeCloseTo(f.ring_n60_k6_avg_path, DIGITS);
  });
});
