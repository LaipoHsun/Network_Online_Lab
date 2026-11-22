// 第 4 章模型：60 位學生按系所圍成一圈，每人只認識左右各 K/2 位（環狀格子）；
// 「午夜抽卡」= Watts–Strogatz 重連：每條連結以機率 p 把一端換成隨機的人。
// 純函式，給元件與測試共用。演算法在 src/lib/network（已與 networkx 比對）。
import { averageClustering, averageShortestPathLength, ringLattice, wattsStrogatz, type Graph } from '../../../lib/network';
import { randomCrowd, type CharacterParams, type College } from '../../../lib/sprites/character';
import { seededRandom } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const N = 60;
export const K = 4;
export const SEED = 4;

/** 「抽卡成功率」的檔位（重連機率 p） */
export const P_LEVELS = [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1] as const;

const DEPTS: { dept: string; college: College }[] = [
  { dept: '資工', college: 'eng' }, { dept: '醫學', college: 'med' }, { dept: '經濟', college: 'socsci' },
  { dept: '外文', college: 'lib' }, { dept: '物理', college: 'sci' }, { dept: '會計', college: 'mgmt' },
];
const PER = N / DEPTS.length;
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];

export interface RingPerson { name: string; dept: string; college: College; look: CharacterParams }

/** 宜蓁（資工三）是第 0 位；系所沿著圓圈排，每系 10 人。 */
export const YIZHEN = 0;

export function makePeople(): RingPerson[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(N, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hero = CHAPTERS[3].hero;
  const used = new Set<string>([hero.name]);
  return looks.map((look, i) => {
    const d = DEPTS[Math.floor(i / PER)];
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    used.add(name);
    if (i === YIZHEN) return { name: hero.name, dept: hero.dept, college: hero.look.college, look: hero.look };
    return { name, dept: d.dept + ['一', '二', '三', '四'][look.year - 1], college: d.college, look: { ...look, college: d.college } };
  });
}

export function deptOf(i: number): string { return DEPTS[Math.floor(i / PER)].dept; }

/** 某個 p 的網路（固定種子：同一個 p 每次都一樣）。 */
export function networkAt(p: number, seed = SEED): { graph: Graph; shortcuts: [number, number][] } {
  if (p === 0) return { graph: ringLattice(N, K), shortcuts: [] };
  // 每個 p 用同一個種子：p 越大，被抽到的連結大致只會越來越多
  return wattsStrogatz(N, K, p, seededRandom(seed));
}

export function stats(g: Graph): { d: number; C: number } {
  return { d: averageShortestPathLength(g, { disconnected: 'reachable' }), C: averageClustering(g) };
}

/** 曲線圖用比較大的網路（400 人、每人認識 10 位），形狀比 60 人清楚，和 Watts–Strogatz 原論文同一類。 */
export const CURVE_N = 400;
export const CURVE_K = 10;

/** ⟨d⟩(p)/⟨d⟩(0) 與 C(p)/C(0)，每個 p 平均 runs 次。 */
export function wsCurve(ps: readonly number[], runs = 8, n = CURVE_N, k = CURVE_K): { p: number; d: number; C: number }[] {
  const base = stats(ringLattice(n, k));
  return ps.map((p) => {
    let d = 0, C = 0;
    for (let r = 0; r < runs; r++) {
      const s = stats(wattsStrogatz(n, k, p, seededRandom(7919 * (r + 1) + Math.round(p * 1e6))).graph);
      d += s.d; C += s.C;
    }
    return { p, d: d / runs / base.d, C: C / runs / base.C };
  });
}

/** 曲線圖用的 p 網格（對數間距 0.001–1） */
export const CURVE_PS = Array.from({ length: 16 }, (_, i) => +(10 ** (-3 + (3 * i) / 15)).toPrecision(3));
