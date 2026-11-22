// 第 6 章劇本要長出的結構：圈內強、跨圈弱。這些性質是場景 A、B 能講故事的前提。
import { describe, it, expect } from 'vitest';
import { CampusSim } from '../../src/lib/sim/campus';
import { ch6Script, SENIOR, XIAOYU } from '../../src/components/chapters/ch6/script';
import * as net from '../../src/lib/network';
import granovetter from '../../data/build/06-weak-ties/granovetter_contact_frequency.json';
import onnelaW from '../../data/build/06-weak-ties/onnela_removal_weight.json';
import rajkumar from '../../data/build/06-weak-ties/rajkumar_mutual_friends.json';

const script = ch6Script();
const sim = new CampusSim(script);
sim.seek(sim.totalSlots);
const ties = sim.currentTies();
const g = sim.graph();
const median = [...ties.map((t) => t.weight)].sort((a, b) => a - b)[Math.floor(ties.length / 2)];
const lccAfter = (order: 'weak' | 'strong', f: number) => {
  const seq = [...ties].sort((a, b) => a.weight - b.weight);
  if (order === 'strong') seq.reverse();
  const keep = seq.slice(Math.round(f * seq.length));
  return net.largestComponentFraction(net.fromEdges(g.n, keep.map((t) => [t.a, t.b] as [number, number])));
};

describe('第 6 章劇本', () => {
  it('70 人、學期末連成一塊，小瑜和學姊從一開始就認識', () => {
    expect(g.n).toBe(70);
    expect(net.isConnected(g)).toBe(true);
    expect(net.hasEdge(g, XIAOYU, SENIOR)).toBe(true);
  });
  it('圈內連結比跨圈連結強', () => {
    const grp = (i: number) => script.people[i].group;
    const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    expect(mid(ties.filter((t) => grp(t.a) === grp(t.b)).map((t) => t.weight)))
      .toBeGreaterThan(2 * mid(ties.filter((t) => grp(t.a) !== grp(t.b)).map((t) => t.weight)));
  });
  it('場景 A：只走強連結時，職缺從資工圈到不了小瑜；也走弱連結就到得了', () => {
    const strong = net.fromEdges(g.n, ties.filter((t) => t.weight >= median).map((t) => [t.a, t.b] as [number, number]));
    expect(net.bfsDistances(strong, SENIOR + 3)[XIAOYU]).toBe(-1);
    expect(net.bfsDistances(g, SENIOR + 3)[XIAOYU]).toBeGreaterThan(0);
  });
  it('場景 B：先剪弱的會崩解，先剪強的只會慢慢縮小', () => {
    expect(lccAfter('weak', 0.6)).toBeLessThan(0.4);
    expect(lccAfter('strong', 0.6)).toBeGreaterThan(0.7);
  });
});

describe('第 6 章資料', () => {
  it('每筆都有 source；Granovetter 三個比例加起來是 100%', () => {
    for (const d of [granovetter, onnelaW, rajkumar] as any[]) {
      expect(d.source.text).toBeTruthy();
      for (const s of d.series) for (const p of s.points) expect(p.source).toBeTruthy();
    }
    const sum = (granovetter as any).series[0].points.reduce((s: number, p: any) => s + p.y, 0);
    expect(sum).toBeCloseTo(100.1, 1); // 原文 16.7 + 55.6 + 27.8（四捨五入）
  });
  it('由圖讀取的資料有標註 digitized 與方法', () => {
    for (const d of [onnelaW, rajkumar] as any[]) {
      expect(d.digitized).toBe(true);
      expect(d.digitization.method.length).toBeGreaterThan(20);
    }
  });
  it('Rajkumar 的點呈倒 U：高峰在中間，兩端較低', () => {
    const pts = (rajkumar as any).series[0].points as { x: number; y: number }[];
    const peak = pts.reduce((b, p) => (p.y > b.y ? p : b));
    expect(peak.x).toBeGreaterThan(5);
    expect(peak.x).toBeLessThan(15);
    expect(pts[0].y).toBeLessThan(peak.y);
    expect(pts.at(-1)!.y).toBeLessThan(peak.y);
  });
});
