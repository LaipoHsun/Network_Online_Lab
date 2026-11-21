// 不同 Astro island 之間的溝通（公式卡 ⇄ 視覺區）。用 window 上的 CustomEvent，不需要共用狀態。
//
// - highlight：公式卡滑過某個符號 → 視覺區高亮對應元素（key = null 代表取消）
// - live：視覺區每個時段發出目前的即時數值 → 公式卡更新數字

export type HighlightDetail = { key: string | null; source?: string };
export type LiveDetail = { values: Record<string, number>; source?: string };

const HIGHLIGHT = 'nl:highlight';
const LIVE = 'nl:live';

// 最後一次的即時數值，讓晚一點才初始化的公式卡也拿得到
let lastLive: LiveDetail | null = null;

export function emitHighlight(key: string | null, source?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<HighlightDetail>(HIGHLIGHT, { detail: { key, source } }));
}

export function onHighlight(fn: (d: HighlightDetail) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<HighlightDetail>).detail);
  window.addEventListener(HIGHLIGHT, h);
  return () => window.removeEventListener(HIGHLIGHT, h);
}

export function emitLive(values: Record<string, number>, source?: string): void {
  if (typeof window === 'undefined') return;
  lastLive = { values, source };
  window.dispatchEvent(new CustomEvent<LiveDetail>(LIVE, { detail: lastLive }));
}

export function onLive(fn: (d: LiveDetail) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<LiveDetail>).detail);
  window.addEventListener(LIVE, h);
  if (lastLive) fn(lastLive);
  return () => window.removeEventListener(LIVE, h);
}
