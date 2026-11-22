// 第 5 章模型：依「社交性差異」產生朋友數序列，再用配置模型（configuration model）隨機配對成網路。
// 差異為 0 時每個人朋友數完全一樣（隨機 4-正則圖），友誼悖論消失；差異越大，悖論越嚴重。
// 純函式，給元件與測試共用。
import { fromEdges, sir, type Graph } from '../../../lib/network';
import { randomCrowd, type CharacterParams, type College } from '../../../lib/sprites/character';
import { seededRandom, type Rng } from '../../../lib/sim/random';
import { CHAPTERS } from '../../../data/chapters';

export const N = 40;
export const KBAR = 4;
export const SEED = 5;

/** 「社交性差異」：朋友數取對數後的標準差 */
export const SPREADS = [
  { value: 0, label: '沒有差異' },
  { value: 0.5, label: '小' },
  { value: 0.9, label: '中' },
  { value: 1.3, label: '大' },
] as const;

const COLLEGES: College[] = ['socsci', 'sci', 'lib', 'eng', 'med', 'mgmt'];
const DEPT_OF: Record<College, string> = { socsci: '社工', sci: '化學', lib: '哲學', eng: '機械', med: '藥學', mgmt: '國企' };
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '周'];
const GIVEN = ['宇', '庭', '翔', '筑', '柏', '安', '芸', '哲', '瑋', '萱', '睿', '涵', '恩', '晴', '彥', '凱', '昕', '承', '琪', '冠', '婷', '育', '辰', '均'];

export interface P5Person { name: string; dept: string; look: CharacterParams }
/** 家瑄（社工一）是第 0 位 */
export const JIAXUAN = 0;

export function makePeople(n = N): P5Person[] {
  const rng = seededRandom(SEED);
  const looks = randomCrowd(n, SEED);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const hero = CHAPTERS[4].hero;
  const used = new Set<string>([hero.name]);
  return looks.map((look, i) => {
    let name = '';
    while (!name || used.has(name)) name = pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
    used.add(name);
    if (i === JIAXUAN) return { name: hero.name, dept: hero.dept, look: hero.look };
    const c = COLLEGES[i % COLLEGES.length];
    return { name, dept: DEPT_OF[c] + ['一', '二', '三', '四'][look.year - 1], look: { ...look, college: c } };
  });
}

function normal(rng: Rng): number {
  const u = Math.max(1e-12, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 朋友數序列：平均約 kbar、對數標準差 spread，最少 1 位，總和為偶數。 */
export function degreeSequence(n: number, spread: number, kbar: number, rng: Rng): number[] {
  const z = Array.from({ length: n }, () => normal(rng));
  const ks = z.map((v) => Math.max(1, Math.min(n - 1, Math.round(kbar * Math.exp(spread * v - (spread * spread) / 2)))));
  if (ks.reduce((s, k) => s + k, 0) % 2) ks[ks.indexOf(Math.max(...ks))] -= 1;
  return ks;
}

/** 配置模型：把每個人的「半邊」隨機配對。先嘗試得到沒有自環、重邊的配對；不行就刪掉自環和重邊。 */
export function configurationModel(ks: number[], rng: Rng, tries = 300): Graph {
  const n = ks.length;
  let best: [number, number][] = [];
  for (let t = 0; t < tries; t++) {
    const stubs: number[] = [];
    ks.forEach((k, i) => { for (let j = 0; j < k; j++) stubs.push(i); });
    for (let i = stubs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [stubs[i], stubs[j]] = [stubs[j], stubs[i]]; }
    const seen = new Set<number>();
    const es: [number, number][] = [];
    let ok = true;
    for (let i = 0; i + 1 < stubs.length; i += 2) {
      const a = Math.min(stubs[i], stubs[i + 1]), b = Math.max(stubs[i], stubs[i + 1]);
      const key = a * n + b;
      if (a === b || seen.has(key)) { ok = false; continue; }
      seen.add(key);
      es.push([a, b]);
    }
    if (es.length > best.length) best = es;
    if (ok) return fromEdges(n, es);
  }
  return fromEdges(n, best);
}

/** 某個社交性差異下的網路（固定種子）。 */
export function networkAt(spread: number, n = N, kbar = KBAR, seed = SEED): Graph {
  const rng = seededRandom(seed * 101 + Math.round(spread * 100));
  return configurationModel(degreeSequence(n, spread, kbar, rng), rng);
}

/** 每個人「朋友的平均朋友數」（沒有朋友的人為 null）。 */
export function friendMeans(g: Graph): (number | null)[] {
  return g.adj.map((nb) => (nb.length ? nb.reduce((s, j) => s + g.adj[j].length, 0) / nb.length : null));
}

export interface ParadoxStats {
  /** ⟨k⟩ */ mean: number;
  /** σ² */ variance: number;
  /** ⟨k²⟩/⟨k⟩：隨機挑一條連結的一端，那個人的平均朋友數 */ friendMean: number;
  /** 朋友數「嚴格少於」自己朋友平均的人所佔比例（只算有朋友的人） */ share: number;
}

export function paradoxStats(g: Graph): ParadoxStats {
  const ks = g.adj.map((a) => a.length);
  const n = ks.length;
  const mean = ks.reduce((s, k) => s + k, 0) / n;
  const m2 = ks.reduce((s, k) => s + k * k, 0) / n;
  const fm = friendMeans(g);
  const have = fm.map((v, i) => (v === null ? null : ks[i] < v - 1e-9)).filter((v) => v !== null);
  return { mean, variance: m2 - mean * mean, friendMean: m2 / mean, share: have.filter(Boolean).length / Math.max(1, have.length) };
}

/** 兩種抽樣：隨機挑一個人、隨機挑一條連結再取它的一端。回傳被抽到的人。 */
export function sampleNodes(g: Graph, count: number, rng: Rng): number[] {
  return Array.from({ length: count }, () => Math.floor(rng() * g.n));
}
export function sampleEdgeEnds(g: Graph, count: number, rng: Rng): number[] {
  const ends: number[] = [];
  g.adj.forEach((nb, i) => nb.forEach(() => ends.push(i))); // 每個人出現 k_i 次 = 每條連結的兩端
  return Array.from({ length: count }, () => ends[Math.floor(rng() * ends.length)]);
}

// ---------------------------------------------------------------- 場景 C：流感哨兵

export const FLU = { n: 600, kbar: 6, spread: 1.0, group: 60, beta: 0.12, mu: 0.25 } as const;

/** 一個大網路，從裡面抽出隨機組，以及「隨機組每人提名一位朋友」的朋友組。 */
export function sentinelSetup(seed = 9) {
  const rng = seededRandom(seed);
  const g = configurationModel(degreeSequence(FLU.n, FLU.spread, FLU.kbar, rng), rng);
  const randomGroup: number[] = [];
  while (randomGroup.length < FLU.group) {
    const i = Math.floor(rng() * g.n);
    if (g.adj[i].length && !randomGroup.includes(i)) randomGroup.push(i);
  }
  const friendGroup = randomGroup.map((i) => g.adj[i][Math.floor(rng() * g.adj[i].length)]);
  return { g, randomGroup, friendGroup };
}

/** 跑 runs 場流感（每場從 3 個隨機的人開始），回傳每一步兩組「累積感染比例」的平均。只算有擴散開來的流行。 */
export function sentinelCurves(setup: ReturnType<typeof sentinelSetup>, runs: number, seed: number, steps = 60) {
  const { g, randomGroup, friendGroup } = setup;
  const rng = seededRandom(seed);
  const acc = { random: new Array(steps + 1).fill(0), friend: new Array(steps + 1).fill(0) };
  let used = 0;
  for (let r = 0; r < runs; r++) {
    const seeds = [0, 1, 2].map(() => Math.floor(rng() * g.n));
    const res = sir(g, { beta: FLU.beta, mu: FLU.mu, seeds, rng, maxSteps: steps });
    const total = res.infectedAt.filter((t) => t >= 0).length;
    if (total < g.n * 0.1) continue; // 沒有流行起來的不算
    used++;
    for (const [key, grp] of [['random', randomGroup], ['friend', friendGroup]] as const) {
      for (const i of grp) {
        const t = res.infectedAt[i];
        if (t >= 0) for (let s = t; s <= steps; s++) acc[key][s] += 1 / grp.length;
      }
    }
  }
  const div = Math.max(1, used);
  return { random: acc.random.map((v) => v / div), friend: acc.friend.map((v) => v / div), runs: used };
}
