// localStorage 包裝：讀不到（私密模式、被封鎖）時網站照樣可用（docs/design.md「本地存檔」）。

const PREFIX = 'network-lab:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* 存不了就算了 */ }
}

export function remove(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* 同上 */ }
}

/** 預測元件的答案。 */
export type PredictAnswer =
  | { kind: 'number'; value: number; at: number }
  | { kind: 'curve'; xs: number[]; ys: number[]; at: number }
  | { kind: 'node'; node: number; label?: string; at: number }
  | { kind: 'split'; labels: string[]; values: number[]; at: number }
  | { kind: 'skipped'; at: number };

export const predictKey = (id: string) => `predict:${id}`;

export function loadPrediction(id: string): PredictAnswer | null {
  return load<PredictAnswer | null>(predictKey(id), null);
}

export function savePrediction(id: string, answer: PredictAnswer): void {
  save(predictKey(id), answer);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nl:predict', { detail: { id, answer } }));
}

export function clearPrediction(id: string): void {
  remove(predictKey(id));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nl:predict', { detail: { id, answer: null } }));
}

/** 監聽某個預測被送出或清除（同一頁的揭曉圖要即時更新）。 */
export function onPrediction(id: string, fn: (a: PredictAnswer | null) => void): () => void {
  const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d.id === id) fn(d.answer); };
  window.addEventListener('nl:predict', h);
  return () => window.removeEventListener('nl:predict', h);
}
