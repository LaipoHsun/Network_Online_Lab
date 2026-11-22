// 第 5 章：沒有社交性差異時悖論消失；差異越大，朋友的平均朋友數 ⟨k²⟩/⟨k⟩ 比 ⟨k⟩ 多越多。
import { describe, it, expect } from 'vitest';
import {
  configurationModel, degreeSequence, friendMeans, networkAt, paradoxStats, sampleEdgeEnds, sampleNodes,
  sentinelCurves, sentinelSetup, SPREADS,
} from '../../src/components/chapters/ch5/model';
import { seededRandom } from '../../src/lib/sim/random';
import share from '../../data/build/05-friendship-paradox/pew_paradox_share.json';
import counts from '../../data/build/05-friendship-paradox/pew_friend_counts.json';
import flu from '../../data/build/05-friendship-paradox/christakis_flu.json';

describe('第 5 章模型', () => {
  it('沒有差異：每人剛好 4 位朋友（簡單圖），悖論消失', () => {
    const g = networkAt(0);
    for (const a of g.adj) { expect(a.length).toBe(4); expect(new Set(a).size).toBe(4); }
    const s = paradoxStats(g);
    expect(s.variance).toBe(0);
    expect(s.share).toBe(0);
  });
  it('⟨k²⟩/⟨k⟩ = ⟨k⟩ + σ²/⟨k⟩，且等於「每條連結端點」的平均朋友數', () => {
    const g = networkAt(SPREADS[3].value);
    const s = paradoxStats(g);
    expect(s.friendMean).toBeCloseTo(s.mean + s.variance / s.mean, 9);
    const ends = g.adj.flatMap((nb) => nb.map((j) => g.adj[j].length));
    expect(ends.reduce((a, b) => a + b, 0) / ends.length).toBeCloseTo(s.friendMean, 9);
  });
  it('差異越大，悖論越嚴重；差異「中」以上，七成以上的人是藍色', () => {
    const stats = SPREADS.map((s) => paradoxStats(networkAt(s.value)));
    for (let i = 1; i < stats.length; i++) expect(stats[i].friendMean / stats[i].mean).toBeGreaterThan(stats[i - 1].friendMean / stats[i - 1].mean);
    expect(stats[2].share).toBeGreaterThan(0.7);
    expect(stats[3].share).toBeGreaterThan(0.7);
  });
  it('抽連結端點比抽人，抽到的朋友數平均多很多', () => {
    const g = networkAt(SPREADS[3].value);
    const rng = seededRandom(1);
    const m = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const a = m(sampleNodes(g, 2000, rng).map((i) => g.adj[i].length));
    const b = m(sampleEdgeEnds(g, 2000, rng).map((i) => g.adj[i].length));
    expect(b).toBeGreaterThan(1.8 * a);
  });
  it('配置模型保留朋友數序列（沒有自環、重邊時）', () => {
    const rng = seededRandom(3);
    const ks = degreeSequence(30, 0, 4, rng);
    const g = configurationModel(ks, rng);
    expect(g.adj.map((a) => a.length)).toEqual(ks);
    expect(friendMeans(g).every((v) => v === 4)).toBe(true);
  });
  it('流感哨兵：朋友組的朋友比較多，也比較早被感染', () => {
    const st = sentinelSetup();
    const md = (grp: number[]) => grp.reduce((s, i) => s + st.g.adj[i].length, 0) / grp.length;
    expect(md(st.friendGroup)).toBeGreaterThan(md(st.randomGroup));
    const c = sentinelCurves(st, 80, 1, 40);
    const reach = (xs: number[]) => xs.findIndex((v) => v >= 0.25);
    expect(reach(c.friend)).toBeLessThan(reach(c.random));
  });
});

describe('第 5 章資料', () => {
  it('Pew 2012 的數字與原文一致', () => {
    expect((share as any).series[0].points[0].y).toBe(84);
    expect((counts as any).series[0].points.map((p: any) => p.y)).toEqual([245, 359]);
    expect((counts as any).facts.top10_threshold).toBe(780);
  });
  it('Christakis & Fowler：原文數字、由圖讀取有標註；朋友組的曲線大多走在前面', () => {
    const d = flu as any;
    expect(d.facts.lead_days).toBe(13.9);
    expect(d.facts.lead_ci).toEqual([9.9, 16.6]);
    expect(d.facts.total_n).toBe(d.facts.random_n + d.facts.friends_n);
    expect(d.digitized).toBe(true);
    const [fr, rd] = d.series;
    const at = (s: any, x: number) => s.points.filter((p: any) => p.x <= x).at(-1)?.y ?? 0;
    let ahead = 0, total = 0;
    for (let x = 10; x <= 70; x += 2) { total++; if (at(fr, x) >= at(rd, x)) ahead++; }
    expect(ahead / total).toBeGreaterThan(0.8);
  });
});
