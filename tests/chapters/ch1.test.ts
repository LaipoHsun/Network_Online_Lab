// 第 1 章劇本要長出的性質：沒有社交性差異時分布窄而對稱；差異越大，長尾越明顯、平均數與中位數拉開。
import { describe, it, expect } from 'vitest';
import { CampusSim, slotLabel } from '../../src/lib/sim/campus';
import { ch1Script, DAYS, N, PINYU, ROOMMATE, SPREADS } from '../../src/components/chapters/ch1/script';
import * as net from '../../src/lib/network';
import ugander from '../../data/build/01-degree/ugander_cdf.json';

function run(spread: number) {
  const sim = new CampusSim(ch1Script(spread));
  sim.seek(sim.totalSlots);
  const g = sim.graph();
  const k = g.adj.map((a) => a.length);
  const s = [...k].sort((a, b) => a - b);
  const mean = k.reduce((a, b) => a + b, 0) / k.length;
  const sd = Math.sqrt(k.reduce((a, b) => a + (b - mean) ** 2, 0) / k.length);
  return { sim, g, k, mean, median: (s[N / 2 - 1] + s[N / 2]) / 2, max: s.at(-1)!, sd };
}

describe('第 1 章劇本', () => {
  it('80 人、三天，品妤和室友一開始就認識', () => {
    const { sim, g } = run(0);
    expect(g.n).toBe(80);
    expect(sim.totalSlots).toBe(DAYS * 5);
    expect(net.hasEdge(g, PINYU, ROOMMATE)).toBe(true);
    expect(slotLabel(7, true)).toBe('第 2 天下午');
  });
  it('沒有差異：分布窄（標準差接近 √⟨k⟩），平均 ≈ 中位數，沒有人超過平均的 2 倍', () => {
    const r = run(SPREADS[0].value);
    expect(Math.abs(r.mean - r.median)).toBeLessThan(1);
    expect(r.sd).toBeLessThan(1.3 * Math.sqrt(r.mean));
    expect(r.max).toBeLessThan(2 * r.mean);
  });
  it('差異大：長尾出現，平均數高於中位數，最多的人是平均的 4 倍以上', () => {
    const r = run(SPREADS.at(-1)!.value);
    expect(r.mean).toBeGreaterThan(r.median + 1);
    expect(r.max).toBeGreaterThan(4 * r.mean);
    expect(r.k[ROOMMATE]).toBeGreaterThan(3 * r.k[PINYU]);
  });
  it('差異越大，標準差越大', () => {
    const sds = SPREADS.map((s) => run(s.value).sd);
    for (let i = 1; i < sds.length; i++) expect(sds[i]).toBeGreaterThan(sds[i - 1]);
  });
  it('握手定理：度的總和 = 2L', () => {
    const r = run(1);
    expect(r.k.reduce((a, b) => a + b, 0)).toBe(2 * net.numEdges(r.g));
  });
});

describe('第 1 章資料', () => {
  const d = ugander as any;
  it('每筆都有 source、標註 digitized', () => {
    expect(d.source.text).toBeTruthy();
    expect(d.digitized).toBe(true);
    expect(d.digitization.method.length).toBeGreaterThan(20);
    for (const p of d.series[0].points) expect(p.source).toBeTruthy();
  });
  it('累積分布單調遞增，且和論文文字一致：50% 落在中位數 99 附近、平均 190', () => {
    const pts = d.series[0].points as { x: number; y: number }[];
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y);
    const at100 = pts.find((p) => p.x === 100)!;
    expect(Math.abs(at100.y - 50)).toBeLessThan(1.5);
    expect(d.summary.median).toBe(99);
    expect(d.summary.mean).toBe(190);
    expect(d.summary.below_10).toBeGreaterThan(8);
    expect(d.summary.below_10).toBeLessThan(11);
  });
});
