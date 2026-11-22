// 第 1 章劇本：80 位新生的三天迎新宿營（搬到校園地圖上演）。
// 10 個小隊、每隊 8 人；早上小隊活動、中午小福、下午大地遊戲（小隊輪流換場地，和別隊混在一起）、
// 晚上體育館晚會、前兩晚夜遊。同場的兩人以 base × (s_a + s_b) / 2 的機率加好友。
// s_i 是「社交性」：spread = 0 時人人一樣；spread 越大，越像少數交際花帶出長尾。
// 規則只是為了示範「異質性 → 右偏」，不對應任何研究數字。
import campus from '../../../data/campus.json';
import type { CampusLayout, Person, Script } from '../../../lib/sim/campus';
import { randomCrowd, type College } from '../../../lib/sprites/character';
import { seededRandom } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const SEED = 1;
export const DAYS = 3;
export const SQUADS = 10;
export const PER_SQUAD = 8;
export const N = SQUADS * PER_SQUAD;

/** 品妤是第 0 位；室友（同寢、很愛交朋友）是第 1 位。 */
export const PINYU = 0;
export const ROOMMATE = 1;
export const ROOMMATE_NAME = '林芷晴';

/** 「社交性差異」滑桿的四個檔位（社交性取對數後的標準差） */
export const SPREADS = [
  { value: 0, label: '沒有差異' },
  { value: 0.5, label: '小' },
  { value: 1, label: '中' },
  { value: 1.5, label: '大' },
] as const;

const DEPTS: { dept: string; college: College }[] = [
  { dept: '經濟', college: 'socsci' }, { dept: '社工', college: 'socsci' }, { dept: '政治', college: 'socsci' },
  { dept: '資工', college: 'eng' }, { dept: '化工', college: 'eng' }, { dept: '物理', college: 'sci' },
  { dept: '數學', college: 'sci' }, { dept: '歷史', college: 'lib' }, { dept: '外文', college: 'lib' },
  { dept: '醫學', college: 'med' }, { dept: '會計', college: 'mgmt' }, { dept: '財金', college: 'mgmt' },
];
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];

// 早上小隊活動：兩隊共用一個場地；下午大地遊戲：小隊每天換場地
const MORNING = ['socsci', 'sci', 'eng', 'liberal', 'clubs'];
const AFTERNOON = ['lake', 'gym', 'library', 'liberal', 'sci'];
const DORMS = ['dorm_m', 'dorm_f'];

export interface Ch1Person extends Person {
  squad: number;
  /** 社交性的對數尺度（標準常態）；實際社交性 = exp(spread·z) 再除以全體平均 */
  z: number;
}

/** Box–Muller：用 seededRandom 產生標準常態 */
function normal(rng: () => number): number {
  const u = Math.max(1e-12, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makePeople(): Ch1Person[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(N, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hero = CHAPTERS[0].hero;
  const used = new Set<string>([hero.name, ROOMMATE_NAME]);
  return looks.map((look, i) => {
    const squad = i % SQUADS; // 品妤和室友分在不同小隊
    const z = normal(rng);
    const dorm = pick(DORMS);
    if (i === PINYU) {
      return { id: 'pinyu', name: hero.name, dept: hero.dept, college: hero.look.college, year: 1, dorm: 'dorm_f', look: hero.look, squad, z: -0.35 };
    }
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    // 室友：規格沒有名字，暫定「林芷晴」（待作者確認）
    if (i === ROOMMATE) name = ROOMMATE_NAME;
    used.add(name);
    const d = i === ROOMMATE ? DEPTS[1] : pick(DEPTS);
    return {
      id: i === ROOMMATE ? 'roommate' : `f${i}`, name, dept: d.dept + '一', college: d.college, year: 1 as const,
      dorm: i === ROOMMATE ? 'dorm_f' : dorm,
      look: { ...look, college: d.college, year: 1 as const, ...(i === ROOMMATE ? { hair: 'long' as const } : {}) },
      squad, z: i === ROOMMATE ? 2.3 : z,
    };
  });
}

/** 依社交性差異產生劇本。spread 只影響加好友的機率，日程完全一樣。 */
export function ch1Script(spread: number): Script & { people: Ch1Person[]; sociability: number[] } {
  const layout = (campus as unknown as Record<string, CampusLayout>).landscape;
  const people = makePeople();
  const raw = people.map((p) => Math.exp(spread * p.z));
  const mean = raw.reduce((s, v) => s + v, 0) / raw.length;
  const soc = raw.map((v) => v / mean);
  const idx = new Map(people.map((p, i) => [p.id, i]));
  return {
    people, sociability: soc, layout, seed: SEED, weeks: 1, days: DAYS, quietLocations: DORMS,
    // 品妤和室友住同一間寢室，宿營前就認識
    initialTies: [[PINYU, ROOMMATE]],
    where(p, _i, t) {
      const q = p as Ch1Person;
      switch (t.period) {
        case 0: return MORNING[Math.floor(q.squad / 2)];
        case 1: return 'cafeteria';
        case 2: return AFTERNOON[(q.squad + t.day * 3) % AFTERNOON.length];
        case 3: return 'gym';
        default: return t.day < DAYS - 1 && q.squad % 2 === t.day % 2 ? 'lake' : q.dorm!;
      }
    },
    meetProbability(a, b, loc, t) {
      const A = a as Ch1Person, B = b as Ch1Person;
      // 同小隊最容易熟；小福和晚會人多，兩兩之間機率低；大地遊戲、夜遊和別隊混在一起
      const base = A.squad === B.squad ? 0.04
        : loc.id === 'cafeteria' ? 0.009
        : t.period === 3 ? 0.011
        : 0.03;
      // 兩人的社交性取平均：愛交朋友的人會主動加別人，所以平均朋友數不太受 spread 影響
      return Math.min(1, base * (soc[idx.get(A.id)!] + soc[idx.get(B.id)!]) / 2);
    },
  };
}
