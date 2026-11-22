// 第 6 章劇本：70 位學生分成五個系所圈，再由社團、服務學習課、偶爾在小福吃飯交叉連起來。
// 系內天天見面 → 強連結；服務學習課、社團每週一次、小福偶遇 → 弱連結。
// 規則只是為了讓「圈內強、跨圈弱」的結構自然長出來，不對應任何研究數字。
import campus from '../../../data/campus.json';
import type { CampusLayout, Person, Script } from '../../../lib/sim/campus';
import { randomCrowd, type College } from '../../../lib/sprites/character';
import { seededRandom } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const SEED = 6;
export const WEEKS = 18;

interface Group { dept: string; college: College; home: string }
export const GROUPS: Group[] = [
  { dept: '經濟', college: 'socsci', home: 'socsci' },
  { dept: '資工', college: 'eng', home: 'eng' },
  { dept: '物理', college: 'sci', home: 'sci' },
  { dept: '歷史', college: 'lib', home: 'liberal' },
  { dept: '醫學', college: 'med', home: 'library' },
];
export const PER_GROUP = 14;
export const CLUBS = ['熱音社', '登山社', '桌遊社'];
const DORMS = ['dorm_m', 'dorm_f'];

const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];
const YEAR = ['一', '二', '三', '四'];

/** 主角小瑜（經濟三）是第 0 位；學姊（資工四）是資工圈的第 0 位。 */
export const XIAOYU = 0;
export const SENIOR = PER_GROUP;

export interface Ch6Person extends Person {
  group: number;
  /** 有修服務學習課 */
  service: boolean;
}

export function makePeople(): Ch6Person[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(GROUPS.length * PER_GROUP, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const used = new Set<string>(['小瑜', '筱涵']);
  const hero = CHAPTERS[5].hero;
  return looks.map((look, i) => {
    const g = Math.floor(i / PER_GROUP), k = i % PER_GROUP, G = GROUPS[g];
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    const year = (1 + Math.floor(rng() * 4)) as 1 | 2 | 3 | 4;
    // 每個圈有兩位修服務學習課；社團各圈都有人參加
    const service = k < 2;
    const club = rng() < 0.3 ? [pick(CLUBS)] : [];
    const dorm = pick(DORMS);
    if (i === XIAOYU) {
      return { id: 'xiaoyu', name: hero.name, dept: hero.dept, college: hero.look.college, year: hero.look.year, dorm, clubs: [], look: hero.look, group: g, service: true };
    }
    if (i === SENIOR) {
      used.add(name);
      return { id: 'senior', name: '筱涵', dept: '資工四', college: 'eng' as College, year: 4 as const, dorm, clubs: club,
        look: { ...look, college: 'eng' as College, year: 4 as const, hair: 'long' as const, accessory: 'none' as const }, group: g, service: true };
    }
    used.add(name);
    return { id: `p${i}`, name, dept: G.dept + YEAR[year - 1], college: G.college, year, dorm, clubs: club, look: { ...look, college: G.college, year }, group: g, service };
  });
}

export function ch6Script(): Script & { people: Ch6Person[] } {
  const layout = (campus as unknown as Record<string, CampusLayout>).landscape;
  const people = makePeople();
  return {
    people, layout, seed: SEED, weeks: WEEKS, quietLocations: DORMS,
    // 小瑜和學姊是大一服務學習課認識的（第 ① 段的故事）
    initialTies: [[XIAOYU, SENIOR]],
    where(p, _i, t, rng) {
      const q = p as Ch6Person, home = GROUPS[q.group].home;
      if (t.day >= 5) return t.period === 2 && rng() < 0.2 ? 'lake' : q.dorm!;
      switch (t.period) {
        case 0: return home;
        case 1: return rng() < 0.75 ? home : 'cafeteria';
        case 2: return q.service && t.day === 2 ? 'gym' : rng() < 0.7 ? home : 'library';
        case 3: {
          if (q.clubs?.length && t.day === 3) return 'clubs';
          const r = rng();
          return r < 0.5 ? q.dorm! : r < 0.75 ? 'cafeteria' : home;
        }
        default: return q.dorm!;
      }
    },
    meetProbability(a, b, loc) {
      const A = a as Ch6Person, B = b as Ch6Person;
      if (A.group === B.group) return loc.id === GROUPS[A.group].home ? 0.004 : 0.002;
      if (loc.id === 'gym') return 0.08;    // 服務學習課
      if (loc.id === 'clubs') return 0.03;  // 社團
      return 0.0004;                        // 小福、圖書館的偶遇
    },
  };
}
