// 第 7 章模型：40 位同學分在四個圈子（系學會、籃球隊、吉他社、系上同學），圈內熟、圈外少。
// 學長同時在系學會、籃球隊和吉他社都有朋友：朋友不是最多，卻站在圈子之間（介數最高）。
// 籃球隊長認識全隊和一些系上同學：朋友最多（度最高），而且朋友也都很熱門（特徵向量高）。
// 純函式，給元件與測試共用。規則只是示範，不對應研究數字。
import { betweennessCentrality, closenessCentrality, degreeCentrality, eigenvectorCentrality, fromEdges, type Graph } from '../../../lib/network';
import { randomCrowd, type CharacterParams, type College } from '../../../lib/sprites/character';
import { seededRandom } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const SEED = 7;
export const N = 40;
export const CIRCLES = ['系學會', '籃球隊', '吉他社', '系上同學'] as const;
const PER = 10;
/** 學長（政治四）：系學會成員，同時在籃球隊、吉他社都有朋友 */
export const SENIOR = 0;
/** 籃球隊長：朋友最多的人 */
export const CAPTAIN = 10;
/** 子軒（政治二）：系上同學 */
export const ZIXUAN = 30;

const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];
const COLLEGE: College[] = ['socsci', 'eng', 'lib', 'socsci'];

export interface P7 { name: string; role: string; circle: number; look: CharacterParams }

export function makePeople(): P7[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(N, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hero = CHAPTERS[6].hero;
  const used = new Set<string>([hero.name]);
  return looks.map((look, i) => {
    const circle = Math.floor(i / PER);
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    used.add(name);
    if (i === ZIXUAN) return { name: hero.name, role: hero.dept, circle, look: hero.look };
    const role = i === SENIOR ? '政治四學長' : i === CAPTAIN ? '籃球隊長' : CIRCLES[circle];
    return { name, role, circle, look: { ...look, college: COLLEGE[circle], accessory: i === SENIOR ? 'glasses' : look.accessory } };
  });
}

export function makeNetwork(): Graph {
  const rng = seededRandom(SEED * 13);
  const es = new Set<string>();
  const add = (a: number, b: number) => { if (a !== b) es.add(a < b ? `${a}-${b}` : `${b}-${a}`); };
  // 圈內：每對以 0.35 的機率是朋友，再串成一圈保證圈內連通
  for (let c = 0; c < CIRCLES.length; c++) {
    const m = Array.from({ length: PER }, (_, k) => c * PER + k);
    for (let x = 0; x < PER; x++) {
      add(m[x], m[(x + 1) % PER]);
      for (let y = x + 2; y < PER; y++) if (rng() < 0.35) add(m[x], m[y]);
    }
  }
  // 籃球隊長認識全隊，加上三位系上同學
  for (let k = 11; k < 20; k++) add(CAPTAIN, k);
  for (const k of [31, 33, 36]) add(CAPTAIN, k);
  // 學長：系學會之外，在籃球隊、吉他社、系上同學各有兩三位朋友
  for (const k of [12, 15, 21, 24, 27, 32, 35]) add(SENIOR, k);
  // 少數其他跨圈的連結
  add(8, 38); add(26, 34);
  const edges = [...es].map((k) => k.split('-').map(Number) as [number, number]);
  return fromEdges(N, edges);
}

export type Measure = 'degree' | 'closeness' | 'betweenness' | 'eigenvector';
export const MEASURES: { key: Measure; label: string; flow: string }[] = [
  { key: 'degree', label: '度', flow: '誰的朋友最多：對話框最多的人' },
  { key: 'closeness', label: '接近', flow: '從誰出發，消息最快傳遍所有人' },
  { key: 'betweenness', label: '介數', flow: '最多人之間的最短路徑都經過誰' },
  { key: 'eigenvector', label: '特徵向量', flow: '一再轉傳之後，熱度累積在誰身上' },
];

export function centralities(g: Graph): Record<Measure, number[]> {
  return {
    degree: degreeCentrality(g),
    closeness: closenessCentrality(g),
    betweenness: betweennessCentrality(g),
    eigenvector: eigenvectorCentrality(g),
  };
}

/** 依中心性由高到低的名次（1 起算，同分同名次） */
export function rankOf(values: number[], i: number): number {
  return 1 + values.filter((v) => v > values[i] + 1e-12).length;
}

export function topOf(values: number[]): number {
  return values.reduce((b, v, i) => (v > values[b] ? i : b), 0);
}

/** 給第 ② 段的預測元件（Predict kind="node"）用：連結與名字 */
export const NET_EDGES: [number, number][] = (() => {
  const g = makeNetwork();
  const out: [number, number][] = [];
  g.adj.forEach((nb, a) => nb.forEach((b) => { if (a < b) out.push([a, b]); }));
  return out;
})();
export const NET_LABELS: string[] = makePeople().map((p) => `${p.name}（${p.role}）`);
