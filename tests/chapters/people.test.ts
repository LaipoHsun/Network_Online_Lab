// 第 ⑥ 段的小人圖：每章一份，每一組都有 source，小人數加總等於該列的總數。
import { describe, it, expect } from 'vitest';

const files = import.meta.glob('../../data/build/*/people_*.json', { eager: true, import: 'default' }) as Record<string, any>;
const TOTALS: Record<string, number[]> = {
  '01-degree': [100], '02-bipartite': [100], '03-triadic-closure': [1, 100], '04-small-world': [74],
  '05-friendship-paradox': [100], '06-weak-ties': [54], '07-centrality': [64],
};

describe('小人圖資料', () => {
  it('第 1–7 章各有一份', () => {
    const chapters = Object.keys(files).map((p) => p.split('/').at(-2)!);
    for (const c of Object.keys(TOTALS)) expect(chapters).toContain(c);
  });
  for (const [path, d] of Object.entries(files)) {
    const ch = path.split('/').at(-2)!;
    it(`${ch}：有 source、每組有 source、總數正確`, () => {
      expect(d.kind).toBe('people');
      expect(d.source.text).toBeTruthy();
      d.rows.forEach((r: any, i: number) => {
        for (const g of r.groups) { expect(g.source).toBeTruthy(); expect(Number.isInteger(g.count)).toBe(true); }
        expect(r.groups.reduce((s: number, g: any) => s + g.count, 0)).toBe(TOTALS[ch][i]);
      });
    });
  }
});
