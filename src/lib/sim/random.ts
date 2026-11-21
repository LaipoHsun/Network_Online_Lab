/** 可重現的隨機數（mulberry32）。模擬與角色都用它，不用 Math.random。 */
export type Rng = () => number;

export function seededRandom(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 ≤ k < n 的整數。 */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates，就地洗牌並回傳同一個陣列。 */
export function shuffle<T>(rng: Rng, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
