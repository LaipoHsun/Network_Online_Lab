// 群眾角色：由章節種子產生，同一個種子每次都一樣（docs/characters.md「其餘群眾角色」）。
import { type CharacterParams, type College, randomCrowd } from '../sprites/character';
import type { Person } from './campus';
import { type Rng, seededRandom } from './random';

// 常見姓氏與名字用字，只用來組出「像真的台大生」的假名字，不對應任何真實人物
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '妤', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰'];

/** 本站代表系所（docs/characters.md 學院色表）。 */
export const DEPTS: Record<College, string[]> = {
  sci: ['物理'],
  socsci: ['經濟', '政治', '社會', '社工'],
  lib: ['中文', '歷史'],
  eng: ['資工', '電機'],
  med: ['醫學'],
  mgmt: ['資管', '財金'],
};

const YEAR_CHAR = ['一', '二', '三', '四'] as const;

function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

export interface CrowdOptions {
  /** 宿舍地點 id，每人隨機分到一個 */
  dorms?: string[];
  /** 社團名稱，每人參加 0–2 個 */
  clubs?: string[];
}

/** 產生 n 位群眾。外觀沿用 randomCrowd(n, seed)，名字、系所、宿舍、社團另用同一個種子產生。 */
export function makeCrowd(n: number, seed: number, opts: CrowdOptions = {}): Person[] {
  const looks: CharacterParams[] = randomCrowd(n, seed);
  const rng = seededRandom(seed ^ 0x5eed);
  const used = new Set<string>();
  return looks.map((look, i) => {
    let name = '';
    for (let tries = 0; tries < 20 && (!name || used.has(name)); tries++) name = pick(rng, SURNAMES) + pick(rng, GIVEN) + pick(rng, GIVEN);
    used.add(name);
    const dept = pick(rng, DEPTS[look.college]);
    const clubs = opts.clubs?.length ? opts.clubs.filter(() => rng() < 1.5 / opts.clubs!.length).slice(0, 2) : [];
    return {
      id: `p${i}`,
      name,
      dept: dept + YEAR_CHAR[look.year - 1],
      college: look.college,
      year: look.year,
      dorm: opts.dorms?.length ? pick(rng, opts.dorms) : undefined,
      clubs,
      look,
    };
  });
}
