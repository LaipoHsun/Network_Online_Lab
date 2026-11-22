// 第 3 章劇本：60 位大一新生的一學期。白天上課、中午吃飯，偶爾隨機認識人；
// 晚上有人揪宵夜，「帶朋友去」的機率就是三元閉合的強度：被帶去的朋友彼此本來不一定認識，
// 一起吃一頓就有機會變成朋友，於是三角形閉合。參照組「隨機遇到」帶去的是同樣多的陌生人。
// 規則只是為了示範「閉合 → 三角形多」，不對應任何研究數字。
import campus from '../../../data/campus.json';
import type { CampusLayout, Person, Script } from '../../../lib/sim/campus';
import { randomCrowd, type College } from '../../../lib/sprites/character';
import { seededRandom } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const SEED = 3;
export const WEEKS = 16;
export const PER_DEPT = 15;

interface Dept { dept: string; college: College; home: string }
export const DEPTS: Dept[] = [
  { dept: '物理', college: 'sci', home: 'sci' },
  { dept: '經濟', college: 'socsci', home: 'socsci' },
  { dept: '資工', college: 'eng', home: 'eng' },
  { dept: '外文', college: 'lib', home: 'liberal' },
];
export const N = DEPTS.length * PER_DEPT;

/** 承恩（物理一）是第 0 位；室友是第 1 位（物理系）；室友的高中同學是第 16 位（經濟系）。 */
export const CHENGEN = 0;
export const ROOMMATE = 1;
export const HS_FRIEND = PER_DEPT + 1;

/** 「宵夜怎麼揪」的四個檔位。bring = 每位朋友被帶去的機率；random = 改帶同樣多的陌生人（參照組）。 */
export const MODES = [
  { key: 'random', label: '隨機遇到（參照組）', bring: 0.4, random: true },
  { key: 'low', label: '很少帶朋友', bring: 0.1, random: false },
  { key: 'mid', label: '有時帶朋友', bring: 0.4, random: false },
  { key: 'high', label: '常常帶朋友', bring: 0.9, random: false },
] as const;

const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];
const GENERAL = ['library', 'liberal', 'sci', 'socsci'];
const SPOTS = ['cafeteria', 'gate', 'mrt', 'clubs', 'lake', 'gym'];
const DORMS = ['dorm_m', 'dorm_f'];
/** 每晚每個人「揪宵夜」的機率 */
const INITIATE = 0.03;
/** 一桌宵夜最多帶幾個人（不含揪的人） */
const MAX_BRING = 4;

export interface Ch3Person extends Person { dept: string; group: number }

export function makePeople(): Ch3Person[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(N, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hero = CHAPTERS[2].hero;
  const used = new Set<string>([hero.name]);
  return looks.map((look, i) => {
    const g = Math.floor(i / PER_DEPT), D = DEPTS[g];
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    used.add(name);
    const dorm = i === CHENGEN || i === ROOMMATE ? 'dorm_m' : pick(DORMS);
    if (i === CHENGEN) return { id: 'chengen', name: hero.name, dept: hero.dept, college: hero.look.college, year: 1, dorm, look: hero.look, group: g };
    return { id: `s${i}`, name, dept: D.dept + '一', college: D.college, year: 1 as const, dorm, look: { ...look, college: D.college, year: 1 as const }, group: g };
  });
}

export function ch3Script(modeIdx: number): Script & { people: Ch3Person[] } {
  const layout = (campus as unknown as Record<string, CampusLayout>).landscape;
  const people = makePeople();
  const mode = MODES[modeIdx];
  // 今晚誰去哪個宵夜攤（beforeSlot 在每晚決定）
  let tonight = new Map<number, string>();
  let view: { neighbors(i: number): number[]; hasTie(a: number, b: number): boolean } | null = null;
  const mutual = (a: number, b: number) => (view ? view.neighbors(a).filter((c) => view!.hasTie(b, c)).length : 0);
  const idx = new Map(people.map((p, i) => [p.id, i]));
  return {
    people, layout, seed: SEED, weeks: WEEKS, quietLocations: DORMS,
    // 承恩和室友同寢；室友和他的高中同學本來就認識（第 ① 段的故事）
    initialTies: [[CHENGEN, ROOMMATE], [ROOMMATE, HS_FRIEND]],
    beforeSlot(t, rng, sim) {
      view = sim;
      tonight = new Map();
      if (t.period !== 3) return;
      const order = people.map((_, i) => i);
      let spot = 0;
      // 第 ① 段的故事：第一週週四，室友揪宵夜，帶了承恩和自己的高中同學
      if (t.week === 0 && t.day === 3 && !mode.random) {
        const where = SPOTS[spot++];
        for (const j of [ROOMMATE, CHENGEN, HS_FRIEND]) tonight.set(j, where);
      }
      for (const i of order) {
        if (tonight.has(i) || rng() >= INITIATE) continue;
        const where = SPOTS[spot++ % SPOTS.length];
        tonight.set(i, where);
        const friends = sim.neighbors(i);
        if (mode.random) {
          // 參照組：帶去的人數和「帶朋友」一樣多，但人是隨機挑的
          let m = 0;
          for (let f = 0; f < friends.length && m < MAX_BRING; f++) if (rng() < mode.bring) m++;
          for (let tries = 0; m > 0 && tries < 200; tries++) {
            const j = Math.floor(rng() * people.length);
            if (j !== i && !tonight.has(j)) { tonight.set(j, where); m--; }
          }
        } else {
          let m = 0;
          for (const j of friends) {
            if (m >= MAX_BRING) break;
            if (!tonight.has(j) && rng() < mode.bring) { tonight.set(j, where); m++; }
          }
        }
      }
    },
    where(p, i, t, rng) {
      const q = p as Ch3Person;
      if (t.period === 3) return tonight.get(i) ?? q.dorm!;
      if (t.day >= 5 || t.period === 4) return q.dorm!;
      if (t.period === 0) return DEPTS[q.group].home;
      if (t.period === 1) return rng() < 0.5 ? 'cafeteria' : DEPTS[q.group].home;
      return GENERAL[Math.floor(rng() * GENERAL.length)];
    },
    meetProbability(a, b, loc, t) {
      // 一起吃一頓宵夜：有共同朋友的人比較聊得來（信任、也不好意思不理對方），共同朋友越多越容易變熟
      if (t.period === 3) return Math.min(0.9, 0.3 + 0.2 * mutual(idx.get(a.id)!, idx.get(b.id)!));
      const A = a as Ch3Person, B = b as Ch3Person;
      if (t.period === 0) return A.group === B.group ? 0.0012 : 0; // 系上必修
      if (loc.id === 'cafeteria') return 0.0003;                 // 中午小福
      return 0.001;                                             // 通識課
    },
  };
}
