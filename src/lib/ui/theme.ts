// 從 tokens.css 讀出目前主題的顏色（給 PixiJS、canvas 這類讀不到 CSS 變數的地方用）。
// 只在瀏覽器裡呼叫。

export const TOKEN_NAMES = [
  '--bg', '--panel', '--ink', '--muted', '--line', '--accent', '--accent-soft', '--signal', '--signal-soft',
  '--college-sci', '--college-socsci', '--college-lib', '--college-eng', '--college-med', '--college-mgmt',
  '--map-grass', '--map-road', '--map-walk', '--map-water', '--map-building', '--map-roof', '--map-tree',
] as const;

export type ThemeColors = Record<string, string>;

export function readTheme(el: Element = document.documentElement): ThemeColors {
  const cs = getComputedStyle(el);
  const out: ThemeColors = {};
  for (const name of TOKEN_NAMES) out[name] = cs.getPropertyValue(name).trim() || '#888888';
  return out;
}

/** 主題改變（系統深淺色或 data-theme）時呼叫 fn；回傳取消函式。 */
export function onThemeChange(fn: () => void): () => void {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const handler = () => fn();
  mq.addEventListener('change', handler);
  const mo = new MutationObserver(handler);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => { mq.removeEventListener('change', handler); mo.disconnect(); };
}

/** 是否開啟 prefers-reduced-motion。 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 把 SVG 字串裡的 var(--x) 換成實際顏色（SVG 烘成圖片後就讀不到 CSS 變數了）。 */
export function resolveVars(svg: string, colors: ThemeColors): string {
  return svg.replace(/var\((--[\w-]+)\)/g, (_, name: string) => colors[name] ?? '#888888');
}
