// 傳播：離散時間 SIR（簡單傳染）與門檻模型（複雜傳染），第 9 章。
import type { Graph } from './graph';
import type { Rng } from '../sim/random';

export interface SirOptions {
  /** 每一步，每位感染者以機率 β 傳染每位易感的朋友。 */
  beta: number;
  /** 每一步，每位感染者以機率 μ 康復（在當步傳染之後）。 */
  mu: number;
  /** 第 0 步就感染的人。 */
  seeds: readonly number[];
  rng: Rng;
  /** 最多跑幾步，預設 10000。 */
  maxSteps?: number;
}

export interface Counts { S: number; I: number; R: number }

export interface SirResult {
  /** 被感染的步數；從未感染為 -1。 */
  infectedAt: number[];
  /** 康復的步數；從未康復為 -1。 */
  recoveredAt: number[];
  /** counts[t] 是第 t 步結束時的 S、I、R 人數（t = 0 是初始狀態）。 */
  counts: Counts[];
}

/**
 * 同步更新的 SIR。第 t 步：第 t−1 步結束時的每位感染者，各自以機率 β 傳染每位易感的朋友；
 * 接著這些感染者各自以機率 μ 康復。當步新感染的人從下一步才開始傳染。
 * β = μ = 1 時，感染時間恰好等於到種子的 BFS 距離。
 */
export function sir(g: Graph, opts: SirOptions): SirResult {
  const { beta, mu, rng } = opts;
  const maxSteps = opts.maxSteps ?? 10000;
  const infectedAt = new Array<number>(g.n).fill(-1);
  const recoveredAt = new Array<number>(g.n).fill(-1);
  let infected = [...new Set(opts.seeds)];
  for (const s of infected) infectedAt[s] = 0;
  let S = g.n - infected.length, R = 0;
  const counts: Counts[] = [{ S, I: infected.length, R }];
  for (let t = 1; t <= maxSteps && infected.length > 0; t++) {
    const fresh: number[] = [];
    for (const u of infected) {
      for (const v of g.adj[u]) {
        if (infectedAt[v] < 0 && rng() < beta) { infectedAt[v] = t; fresh.push(v); }
      }
    }
    const still: number[] = [];
    for (const u of infected) {
      if (rng() < mu) { recoveredAt[u] = t; R++; } else still.push(u);
    }
    S -= fresh.length;
    infected = still.concat(fresh);
    counts.push({ S, I: infected.length, R });
  }
  return { infectedAt, recoveredAt, counts };
}

/** 第 t 步結束時每個人的狀態（給動畫用）。 */
export function sirStateAt(result: SirResult, t: number): ('S' | 'I' | 'R')[] {
  return result.infectedAt.map((ti, i) => {
    if (ti < 0 || ti > t) return 'S';
    const tr = result.recoveredAt[i];
    return tr >= 0 && tr <= t ? 'R' : 'I';
  });
}

export interface ThresholdOptions {
  /** 一開始就採用的人。 */
  seeds: readonly number[];
  /** 門檻 θ：至少要有幾位朋友已採用才會跟進。可給單一數字或每人一個值。 */
  theta: number | readonly number[];
  /** 最多跑幾步，預設 N。 */
  maxSteps?: number;
}

export interface ThresholdResult {
  /** 採用的步數；沒採用為 -1。 */
  adoptedAt: number[];
  /** adopters[t] 是第 t 步結束時的累計採用人數。 */
  adopters: number[];
}

/**
 * 遞進式門檻模型（複雜傳染）：x_i(t+1) = 1[ x_i(t) = 1 或 Σ_j A_ij x_j(t) ≥ θ_i ]。
 * 同步更新；一旦採用就不會退出。確定性，不需要隨機數。
 */
export function thresholdCascade(g: Graph, opts: ThresholdOptions): ThresholdResult {
  const theta = (i: number) => (typeof opts.theta === 'number' ? opts.theta : opts.theta[i]);
  const maxSteps = opts.maxSteps ?? g.n;
  const adoptedAt = new Array<number>(g.n).fill(-1);
  for (const s of opts.seeds) adoptedAt[s] = 0;
  let total = adoptedAt.filter((t) => t >= 0).length;
  const adopters = [total];
  for (let t = 1; t <= maxSteps; t++) {
    const fresh: number[] = [];
    for (let i = 0; i < g.n; i++) {
      if (adoptedAt[i] >= 0) continue;
      let c = 0;
      for (const j of g.adj[i]) if (adoptedAt[j] >= 0) c++;
      if (c >= theta(i)) fresh.push(i);
    }
    if (fresh.length === 0) break;
    for (const i of fresh) adoptedAt[i] = t;
    total += fresh.length;
    adopters.push(total);
  }
  return { adoptedAt, adopters };
}
