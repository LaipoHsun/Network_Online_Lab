// 第 4 章：格子的距離和 N 成正比；少數捷徑讓距離大降、聚集係數幾乎不變（小世界）。
import { describe, it, expect } from 'vitest';
import { CURVE_PS, K, N, networkAt, P_LEVELS, stats, wsCurve } from '../../src/components/chapters/ch4/model';
import dist from '../../data/build/04-small-world/small_world_distances.json';
import tw from '../../data/build/04-small-world/taiwan_estimate.json';

describe('第 4 章模型', () => {
  it('p = 0 是環狀格子：每人 K 位朋友，C = 3(K−2)/(4(K−1))，⟨d⟩ 接近 N/(2K)', () => {
    const { graph } = networkAt(0);
    for (const a of graph.adj) expect(a.length).toBe(K);
    const s = stats(graph);
    expect(s.C).toBeCloseTo((3 * (K - 2)) / (4 * (K - 1)), 6);
    expect(Math.abs(s.d - N / (2 * K))).toBeLessThan(0.6);
  });
  it('p 越大，捷徑越多、距離越短（整體趨勢）', () => {
    const ds = P_LEVELS.map((p) => stats(networkAt(p).graph).d);
    expect(ds.at(-1)!).toBeLessThan(ds[0] / 2);
    expect(stats(networkAt(0.05).graph).d).toBeLessThan(ds[0] - 2);
  });
  it('小世界區間：p = 0.01 時距離已掉到一半以下，聚集係數還在九成以上', () => {
    const c = wsCurve([0.01, 1]);
    expect(c[0].d).toBeLessThan(0.5);
    expect(c[0].C).toBeGreaterThan(0.9);
    expect(c[1].C).toBeLessThan(0.1);
    expect(CURVE_PS[0]).toBeCloseTo(0.001, 6);
    expect(CURVE_PS.at(-1)).toBe(1);
  });
});

describe('第 4 章資料', () => {
  it('三個距離都有 source；Milgram 是中間人 5.2 + 1', () => {
    const pts = (dist as any).series[0].points;
    for (const p of pts) expect(p.source).toBeTruthy();
    expect(pts.map((p: any) => p.y)).toEqual([6.2, 4.74, 4.57]);
    expect((dist as any).facts.milgram_completed).toBe(64);
  });
  it('台灣估算 ≈ ln N / ln 1000 ≈ 2.5，人口多十倍只多約 0.33 步', () => {
    const f = (tw as any).facts;
    expect(f.population).toBe(23299132);
    expect(f.estimate).toBeCloseTo(Math.log(f.population) / Math.log(1000), 2);
    expect(f.extra_per_10x).toBeCloseTo(0.33, 2);
  });
});
