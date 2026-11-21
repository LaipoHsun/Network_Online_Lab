// /playground 用的示範劇本。規則只是為了展示引擎，不對應任何章節或研究數字。
import campus from '../../data/campus.json';
import type { CampusLayout, Person, Script } from '../../lib/sim/campus';
import { makeCrowd } from '../../lib/sim/people';
import { CHAPTERS } from '../../data/chapters';
import type { College } from '../../lib/sprites/character';

const CLASSROOM: Record<College, string> = {
  sci: 'sci', eng: 'eng', lib: 'liberal', socsci: 'socsci', med: 'sci', mgmt: 'socsci',
};
const DORMS = ['dorm_m', 'dorm_f'];

export function demoScript(n: number, seed = 2026, orientation: 'landscape' | 'portrait' = 'landscape'): Script {
  const layout = (campus as unknown as Record<string, CampusLayout>)[orientation];
  // 前 9 位是各章主角，其餘是群眾
  const heroes: Person[] = CHAPTERS.slice(0, Math.min(9, n)).map((c, i) => ({
    id: `hero${c.n}`, name: c.hero.name, dept: c.hero.dept, college: c.hero.look.college, year: c.hero.look.year,
    dorm: DORMS[i % 2], clubs: i % 3 === 0 ? ['熱音社'] : [], look: c.hero.look,
  }));
  const crowd = makeCrowd(Math.max(0, n - heroes.length), seed, { dorms: DORMS, clubs: ['熱音社', '登山社', '辯論社'] });
  const people = [...heroes, ...crowd];
  return {
    people, layout, seed, weeks: 18,
    where(p, _i, t, rng) {
      const weekend = t.day >= 5;
      switch (t.period) {
        case 0: return weekend ? (rng() < 0.3 ? 'lake' : p.dorm!) : CLASSROOM[p.college];
        case 1: return rng() < 0.75 ? 'cafeteria' : 'library';
        case 2: {
          const r = rng();
          if (weekend) return r < 0.4 ? 'gym' : r < 0.7 ? 'library' : 'boulevard';
          return r < 0.5 ? CLASSROOM[p.college] : r < 0.8 ? 'library' : 'liberal';
        }
        case 3: return p.clubs?.length && rng() < 0.6 ? 'clubs' : rng() < 0.3 ? 'gym' : 'cafeteria';
        default: return p.dorm!;
      }
    },
    meetProbability(a, b, loc, _t, present) {
      // 每個時段每人期望新認識約 0.006 × 加成 位，學期末平均度約落在 5–10
      const boost = (a.college === b.college ? 2 : 1) * (loc.id === 'clubs' ? 3 : 1);
      return Math.min(1, (0.012 * boost) / present);
    },
  };
}
