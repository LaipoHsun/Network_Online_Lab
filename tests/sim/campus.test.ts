import { describe, it, expect } from 'vitest';
import campus from '../../src/data/campus.json';
import {
  CampusSim, type CampusLayout, pointAlong, roadRoute, slotLabel, slotTime, spotIn, walkRoute, SLOT_MINUTES,
} from '../../src/lib/sim/campus';
import { makeCrowd } from '../../src/lib/sim/people';
import { demoScript } from '../../src/components/playground/demoScript';
import { numEdges } from '../../src/lib/network';

const layouts = campus as unknown as Record<'landscape' | 'portrait', CampusLayout>;

describe('校園配置', () => {
  it.each(['landscape', 'portrait'] as const)('%s：所有地點的道路節點都存在，且彼此連通', (o) => {
    const L = layouts[o];
    const ids = L.locations.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of L.locations) for (const b of L.locations) expect(roadRoute(L, a.road, b.road).length).toBeGreaterThan(0);
  });
  it('地點和規格一致（docs/campus-map.md 的 16 個地點）', () => {
    expect(layouts.landscape.locations.map((l) => l.id).sort()).toEqual(
      ['bell', 'boulevard', 'cafeteria', 'clubs', 'dorm_f', 'dorm_m', 'eng', 'gate', 'gym', 'lake', 'liberal', 'library', 'mrt', 'sci', 'socsci', 'zhoushan'].sort());
    expect(layouts.portrait.width).toBe(700);
    expect(layouts.portrait.height).toBe(1000);
  });
  it('站位在地點內、而且固定', () => {
    for (const loc of layouts.landscape.locations) {
      const p = spotIn(loc, 'p1');
      expect(p.x).toBeGreaterThanOrEqual(loc.rect.x); expect(p.x).toBeLessThanOrEqual(loc.rect.x + loc.rect.w);
      expect(p.y).toBeGreaterThanOrEqual(loc.rect.y); expect(p.y).toBeLessThanOrEqual(loc.rect.y + loc.rect.h);
      expect(spotIn(loc, 'p1')).toEqual(p);
    }
  });
  it('pointAlong 走在折線上', () => {
    const r = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(pointAlong(r, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(r, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlong(r, 0.75)).toEqual({ x: 10, y: 5 });
    expect(pointAlong(r, 1)).toEqual({ x: 10, y: 10 });
  });
  it('walkRoute 從起點站位走到終點站位', () => {
    const L = layouts.landscape;
    const a = L.locations.find((l) => l.id === 'dorm_m')!, b = L.locations.find((l) => l.id === 'library')!;
    const r = walkRoute(L, a, b, 'p3');
    expect(r[0]).toEqual(spotIn(a, 'p3'));
    expect(r.at(-1)).toEqual(spotIn(b, 'p3'));
  });
});

describe('時間', () => {
  it('slotTime 與標籤', () => {
    expect(slotTime(0)).toEqual({ slot: 0, week: 0, day: 0, period: 0 });
    expect(slotTime(36)).toEqual({ slot: 36, week: 1, day: 0, period: 1 });
    expect(slotLabel(36)).toBe('第 2 週 週一中午');
  });
});

describe('CampusSim', () => {
  it('同一個種子結果完全相同', () => {
    const a = new CampusSim(demoScript(60)), b = new CampusSim(demoScript(60));
    a.seek(200); b.seek(200);
    expect(a.currentTies()).toEqual(b.currentTies());
    expect(a.history).toEqual(b.history);
  });
  it('往回拖時間軸等於從頭重播', () => {
    const s = new CampusSim(demoScript(60));
    s.seek(300); s.seek(120);
    const fresh = new CampusSim(demoScript(60));
    fresh.seek(120);
    expect(s.currentTies()).toEqual(fresh.currentTies());
  });
  it('連結只增不減，權重是相處時間的整數倍', () => {
    const s = new CampusSim(demoScript(80));
    let prev = 0;
    for (let w = 1; w <= 6; w++) {
      s.seek(w * 35);
      const m = numEdges(s.graph());
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
    expect(prev).toBeGreaterThan(0);
    for (const t of s.currentTies()) expect(t.weight % SLOT_MINUTES).toBe(0);
  });
  it('機率為 0 時沒有人認識；只在同一地點才會認識', () => {
    const base = demoScript(30);
    const none = new CampusSim({ ...base, meetProbability: () => 0 });
    none.seek(100);
    expect(none.currentTies()).toEqual([]);
    const sure = new CampusSim({ ...base, meetProbability: () => 1 });
    const r = sure.step()!;
    for (const [a, b] of r.newTies) expect(r.at[a]).toBe(r.at[b]);
  });
  it('initialTies 一開始就存在', () => {
    const s = new CampusSim({ ...demoScript(10), initialTies: [[0, 1]] });
    expect(s.currentTies()).toEqual([{ a: 0, b: 1, since: -1, weight: 0 }]);
  });
  it('不存在的地點會丟錯', () => {
    const s = new CampusSim({ ...demoScript(5), where: () => 'nowhere' });
    expect(() => s.step()).toThrow();
  });
  it('跑到學期末會停', () => {
    const s = new CampusSim({ ...demoScript(5), weeks: 1 });
    s.seek(1000);
    expect(s.slot).toBe(35);
    expect(s.step()).toBeNull();
  });
});

describe('群眾', () => {
  it('可重現、名字不重複、系所對得上學院', () => {
    const a = makeCrowd(100, 7, { dorms: ['dorm_m'] });
    expect(a).toEqual(makeCrowd(100, 7, { dorms: ['dorm_m'] }));
    expect(new Set(a.map((p) => p.name)).size).toBeGreaterThan(95);
    for (const p of a) expect(p.college).toBe(p.look.college);
  });
});
