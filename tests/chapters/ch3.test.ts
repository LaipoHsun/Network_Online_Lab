// 第 3 章劇本要長出的性質：帶朋友去宵夜（三元閉合）越常，聚集係數比同樣連結數的隨機網路高越多；
// 參照組（隨機帶人）則接近隨機網路。
import { describe, it, expect } from 'vitest';
import { CampusSim } from '../../src/lib/sim/campus';
import { ch3Script, CHENGEN, HS_FRIEND, MODES, N, ROOMMATE } from '../../src/components/chapters/ch3/script';
import * as net from '../../src/lib/network';
import ratio from '../../data/build/03-triadic-closure/kossinets_closure_ratio.json';
import kw from '../../data/build/03-triadic-closure/kossinets_mutual_acquaintances.json';
import pew from '../../data/build/03-triadic-closure/pew_friend_density.json';

function run(i: number) {
  const sim = new CampusSim(ch3Script(i));
  sim.seek(sim.totalSlots);
  const g = sim.graph();
  const L = net.numEdges(g);
  return { sim, g, C: net.averageClustering(g), R: (2 * L) / (N * (N - 1)) };
}
const res = MODES.map((_, i) => run(i));
const idx = (k: string) => MODES.findIndex((m) => m.key === k);

describe('第 3 章劇本', () => {
  it('60 人；承恩、室友、室友的高中同學的關係', () => {
    expect(res[0].g.n).toBe(60);
    for (const r of res) expect(net.hasEdge(r.g, CHENGEN, ROOMMATE)).toBe(true);
    // 帶朋友的三種設定裡，承恩和室友的高中同學在學期中變成朋友（第 ① 段的故事）
    for (const k of ['low', 'mid', 'high']) expect(net.hasEdge(res[idx(k)].g, CHENGEN, HS_FRIEND)).toBe(true);
  });
  it('帶朋友越常，C 相對於隨機網路越高', () => {
    const ratios = ['low', 'mid', 'high'].map((k) => res[idx(k)].C / res[idx(k)].R);
    expect(ratios[1]).toBeGreaterThan(ratios[0]);
    expect(ratios[2]).toBeGreaterThan(ratios[1]);
    expect(ratios[2]).toBeGreaterThan(3);
  });
  it('參照組（隨機帶人）的 C 比「常常帶朋友」接近隨機網路', () => {
    const r = res[idx('random')], h = res[idx('high')];
    expect(r.C / r.R).toBeLessThan(h.C / h.R / 2);
  });
  it('neighbors / hasTie 和 graph() 一致', () => {
    const { sim, g } = res[idx('mid')];
    for (let i = 0; i < N; i++) {
      expect([...sim.neighbors(i)].sort((a, b) => a - b)).toEqual([...g.adj[i]].sort((a, b) => a - b));
      for (const j of g.adj[i]) expect(sim.hasTie(i, j)).toBe(true);
    }
  });
});

describe('第 3 章資料', () => {
  it('每筆都有 source、由圖讀取的資料有標註', () => {
    for (const d of [ratio, kw] as any[]) {
      expect(d.source.text).toBeTruthy();
      expect(d.digitized).toBe(true);
      expect(d.digitization.method.length).toBeGreaterThan(20);
      for (const s of d.series) for (const p of s.points) expect(p.source).toBeTruthy();
    }
    expect((pew as any).facts.mean_density).toBe(0.12);
  });
  it('機率隨共同朋友數上升；沒有共同課程時，1 位共同朋友約高出兩個數量級', () => {
    for (const s of (kw as any).series) {
      const ys = s.points.map((p: any) => p.y);
      for (let i = 1; i < ys.length - 1; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] * 0.95);
    }
    const r1 = (ratio as any).series[0].points.find((p: any) => p.x === 1).y;
    expect(r1).toBeGreaterThan(30);
    expect(r1).toBeLessThan(300);
  });
  it('共同朋友六位以上，有沒有共同課程差不到兩倍（論文 p. 89 的敘述）', () => {
    const [cls, none] = (kw as any).series;
    for (let k = 6; k <= 10; k++) expect(cls.points[k].y / none.points[k].y).toBeLessThan(2);
  });
});
