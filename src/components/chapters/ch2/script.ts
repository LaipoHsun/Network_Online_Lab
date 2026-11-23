// 第 2 章劇本：70 位學生、一學期。每人屬於一個宿舍樓層、一個系（和年級）、0–2 個社團、0–2 門通識課。
// 朋友只在「焦點」（Feld 1981）裡產生：同一堂必修、同一層宿舍、同一個社團、同一門通識。
// 四個焦點權重乘上基本機率，讀者調整它們，看朋友圈被哪個焦點主導。規則只是示範，不對應研究數字。
import campus from '../../../data/campus.json';
import type { CampusLayout, Person, Script } from '../../../lib/sim/campus';
import { randomCrowd, type College } from '../../../lib/sprites/character';
import { seededRandom } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const SEED = 2;
export const WEEKS = 14;
export const N = 70;

export const DEPTS: { dept: string; college: College; home: string }[] = [
  { dept: '社會', college: 'socsci', home: 'socsci' },
  { dept: '化學', college: 'sci', home: 'sci' },
  { dept: '電機', college: 'eng', home: 'eng' },
  { dept: '中文', college: 'lib', home: 'liberal' },
];
export const CLUBS = ['吉他社', '羽球社', '攝影社', '服務隊'];
export const COURSES = [
  { name: '通識：經濟學與生活', loc: 'library', days: [0, 2], size: 30 },
  { name: '體育：游泳', loc: 'gym', days: [1, 3], size: 18 },
];
export const FLOORS = 4;
/** 焦點權重的四個檔位 */
export const LEVELS = [
  { value: 0, label: '0' }, { value: 0.5, label: '弱' }, { value: 1, label: '中' }, { value: 2, label: '強' },
] as const;
export type FocusKey = 'dorm' | 'dept' | 'club' | 'course';
export const FOCI: { key: FocusKey; label: string }[] = [
  { key: 'dorm', label: '宿舍' }, { key: 'dept', label: '系所' }, { key: 'club', label: '社團' }, { key: 'course', label: '通識課' },
];

const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];

export interface Ch2Person extends Person {
  deptIdx: number;
  floor: number;
  clubIdx: number[];
  courses: number[];
}

/** 語涵（社會二）是第 0 位。 */
export const YUHAN = 0;

export function makePeople(): Ch2Person[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(N, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hero = CHAPTERS[1].hero;
  const used = new Set<string>([hero.name]);
  const order = Array.from({ length: N }, (_, i) => i);
  // 通識課名額：隨機挑人
  const shuffled = (xs: number[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const courseMembers = COURSES.map((c) => new Set(shuffled(order).slice(0, c.size)));
  return looks.map((look, i) => {
    const deptIdx = i % DEPTS.length;
    const D = DEPTS[deptIdx];
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    used.add(name);
    const year = (i === YUHAN ? 2 : 1 + Math.floor(rng() * 4)) as 1 | 2 | 3 | 4;
    const dorm = rng() < 0.5 ? 'dorm_m' : 'dorm_f';
    const floor = Math.floor(rng() * FLOORS);
    const nClubs = rng() < 0.3 ? 0 : rng() < 0.7 ? 1 : 2;
    const clubIdx = shuffled([0, 1, 2, 3]).slice(0, nClubs);
    const courses = COURSES.map((_, c) => c).filter((c) => courseMembers[c].has(i));
    const base = { deptIdx, floor, clubIdx, courses, dorm, year };
    if (i === YUHAN) return { id: 'yuhan', name: hero.name, dept: hero.dept, college: hero.look.college, look: hero.look, ...base, dorm: 'dorm_f' };
    return { id: `b${i}`, name, dept: D.dept + ['一', '二', '三', '四'][year - 1], college: D.college, look: { ...look, college: D.college, year }, ...base };
  });
}

export type Weights = Record<FocusKey, number>;

export function ch2Script(w: Weights): Script & { people: Ch2Person[] } {
  const layout = (campus as unknown as Record<string, CampusLayout>).landscape;
  const people = makePeople();
  return {
    people, layout, seed: SEED, weeks: WEEKS,
    where(p, _i, t, rng) {
      const q = p as Ch2Person;
      if (t.day >= 5) return t.period === 2 && rng() < 0.3 ? 'cafeteria' : q.dorm!;
      switch (t.period) {
        case 0: return DEPTS[q.deptIdx].home;
        case 1: return rng() < 0.5 ? 'cafeteria' : DEPTS[q.deptIdx].home;
        case 2: {
          const c = q.courses.find((c) => COURSES[c].days.includes(t.day));
          return c !== undefined ? COURSES[c].loc : DEPTS[q.deptIdx].home;
        }
        case 3: return q.clubIdx.some((k) => k === t.day % CLUBS.length) ? 'clubs' : q.dorm!;
        default: return q.dorm!;
      }
    },
    meetProbability(a, b, loc, t) {
      const A = a as Ch2Person, B = b as Ch2Person;
      if (loc.id === 'dorm_m' || loc.id === 'dorm_f') return w.dorm * (A.floor === B.floor ? 0.004 : 0.00005);
      if (loc.id === 'clubs') return A.clubIdx.some((k) => B.clubIdx.includes(k) && k === t.day % CLUBS.length) ? w.club * 0.02 : 0;
      if (t.period === 2 && (loc.id === 'library' || loc.id === 'gym')) return w.course * 0.0025;
      if (t.period <= 2 && loc.id === DEPTS[A.deptIdx].home && A.deptIdx === B.deptIdx) return w.dept * (A.year === B.year ? 0.005 : 0.0003);
      if (loc.id === 'cafeteria') return 0.0002;
      return 0;
    },
  };
}

/** 學期末的朋友裡，有多少比例和自己共享每一種焦點（同一條連結可以同時算進好幾種）。 */
export function sharedFocusShares(people: Ch2Person[], ties: { a: number; b: number }[]) {
  const same = {
    dorm: (A: Ch2Person, B: Ch2Person) => A.dorm === B.dorm && A.floor === B.floor,
    dept: (A: Ch2Person, B: Ch2Person) => A.deptIdx === B.deptIdx,
    year: (A: Ch2Person, B: Ch2Person) => A.year === B.year,
    club: (A: Ch2Person, B: Ch2Person) => A.clubIdx.some((k) => B.clubIdx.includes(k)),
    course: (A: Ch2Person, B: Ch2Person) => A.courses.some((c) => B.courses.includes(c)),
  };
  const out = {} as Record<keyof typeof same, number>;
  for (const k of Object.keys(same) as (keyof typeof same)[]) {
    out[k] = ties.length ? ties.filter((t) => same[k](people[t.a], people[t.b])).length / ties.length : 0;
  }
  return out;
}
