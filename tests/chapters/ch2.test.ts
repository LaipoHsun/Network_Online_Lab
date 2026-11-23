// 第 2 章：朋友在焦點裡產生；調高某個焦點的權重，朋友就更集中在那個焦點。
import { describe, it, expect } from 'vitest';
import { CampusSim } from '../../src/lib/sim/campus';
import { ch2Script, sharedFocusShares, type Weights } from '../../src/components/chapters/ch2/script';
import traud from '../../data/build/02-bipartite/traud_assortativity.json';

function run(w: Weights) {
  const s = ch2Script(w);
  const sim = new CampusSim(s);
  sim.seek(sim.totalSlots);
  const ties = sim.currentTies();
  const all: { a: number; b: number }[] = [];
  for (let a = 0; a < s.people.length; a++) for (let b = a + 1; b < s.people.length; b++) all.push({ a, b });
  return { ties, sh: sharedFocusShares(s.people, ties), base: sharedFocusShares(s.people, all) };
}

describe('第 2 章劇本', () => {
  it('預設權重：同宿舍同一層的朋友最多（語涵的故事），且遠高於隨機', () => {
    const { sh, base } = run({ dorm: 1, dept: 1, club: 1, course: 1 });
    expect(sh.dorm).toBeGreaterThan(sh.dept);
    expect(sh.dorm).toBeGreaterThan(3 * base.dorm);
  });
  it('把系所調強、宿舍調弱：同系的朋友比例超過同宿舍', () => {
    const { sh } = run({ dorm: 0.5, dept: 2, club: 1, course: 1 });
    expect(sh.dept).toBeGreaterThan(sh.dorm);
  });
  it('只剩通識課：幾乎所有朋友都來自同一門通識', () => {
    const { sh } = run({ dorm: 0, dept: 0, club: 0, course: 2 });
    expect(sh.course).toBeGreaterThan(0.85);
  });
  it('權重全部為 0：沒有人變成朋友（只剩小福偶遇）', () => {
    const { ties } = run({ dorm: 0, dept: 0, club: 0, course: 0 });
    expect(ties.length).toBeLessThan(20);
  });
});

describe('第 2 章資料', () => {
  const d = traud as any;
  it('取自 Table A.2：100 校；年級 > 宿舍 > 主修 > 高中', () => {
    expect(d.digitized).toBe(false);
    const ys = d.series[0].points.map((p: any) => p.y);
    expect(d.series[0].points.map((p: any) => p.x)).toEqual(['年級', '宿舍', '主修', '高中']);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
    for (const p of d.series[0].points) expect(p.source).toBeTruthy();
  });
  it('年級在 92 校最強、宿舍在 8 校；Caltech 762 人、Penn 41,536 人', () => {
    expect(d.facts.top_counts['年級']).toBe(92);
    expect(d.facts.top_counts['宿舍']).toBe(8);
    expect(d.facts.residence_top_schools).toContain('Caltech');
    expect(d.facts.residence_top_schools).toContain('Rice');
    expect(d.facts.smallest).toMatchObject({ name: 'Caltech', nodes: 762 });
    expect(d.facts.largest).toMatchObject({ name: 'Penn', nodes: 41536 });
  });
});
