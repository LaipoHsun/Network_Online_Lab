// 參數化小人產生器。規格見 docs/characters.md。
// 所有座標以 24 × 36 的 viewBox 撰寫；輸出 SVG 字串，可直接嵌入或交給 PixiJS 做成 texture。

export type Hair = 'short' | 'long' | 'ponytail' | 'bun' | 'curly' | 'buzz';
export type College = 'sci' | 'socsci' | 'lib' | 'eng' | 'med' | 'mgmt';
export type Accessory = 'none' | 'glasses' | 'headphones' | 'backpack' | 'cap' | 'scarf';
export type State = 'idle' | 'happy' | 'sick' | 'selected' | 'removed';

export interface CharacterParams {
  skin: 0 | 1 | 2 | 3;
  hair: Hair;
  hairColor: 0 | 1 | 2;
  college: College;
  accessory: Accessory;
  year: 1 | 2 | 3 | 4;
}

export const SKIN = ['#F3D7C1', '#E6B994', '#C98E66', '#8D5A3B'];
export const HAIR_COLOR = ['#1F1A17', '#4A3426', '#8A5A3C'];
export const HAIRS: Hair[] = ['short', 'long', 'ponytail', 'bun', 'curly', 'buzz'];
export const COLLEGES: College[] = ['sci', 'socsci', 'lib', 'eng', 'med', 'mgmt'];
export const ACCESSORIES: Accessory[] = ['none', 'glasses', 'headphones', 'backpack', 'cap', 'scarf'];
export const COLLEGE_LABEL: Record<College, string> = {
  sci: '理學院', socsci: '社會科學院', lib: '文學院', eng: '工學院／電資', med: '醫學院', mgmt: '管理學院',
};

// 衣服顏色走 CSS 變數，深淺主題自動切換
const collegeVar = (c: College) => `var(--college-${c})`;

const CX = 12; // 頭中心 x
const HY = 9;  // 頭中心 y
const HR = 7;  // 頭半徑

function hairBack(h: Hair, col: string): string {
  switch (h) {
    case 'long': return `<path d="M4.6 9 Q4 20 6 22 L18 22 Q20 20 19.4 9 Z" fill="${col}"/>`;
    case 'ponytail': return `<path d="M18.5 8 Q23.5 10 21.5 17 Q20 14 18 13 Z" fill="${col}"/>`;
    case 'bun': return `<circle cx="${CX}" cy="1.6" r="3" fill="${col}"/>`;
    default: return '';
  }
}

function hairFront(h: Hair, col: string): string {
  switch (h) {
    case 'short': return `<path d="M5 9 Q5 1.6 12 1.6 Q19 1.6 19 9 Q17 5.4 12 5.4 Q7.2 5.4 5 9 Z" fill="${col}"/>`;
    case 'long':
    case 'ponytail':
    case 'bun': return `<path d="M5 9.4 Q5 1.8 12 1.8 Q19 1.8 19 9.4 Q16.5 4.6 12.6 6 Q8 4.6 5 9.4 Z" fill="${col}"/>`;
    case 'curly': return [0, 1, 2, 3, 4].map(i => `<circle cx="${5.6 + i * 3.2}" cy="${3.6 + (i % 2) * 0.8}" r="2.4" fill="${col}"/>`).join('')
      + `<circle cx="4.8" cy="7" r="2" fill="${col}"/><circle cx="19.2" cy="7" r="2" fill="${col}"/>`;
    case 'buzz': return `<path d="M5.2 8 Q5.6 2.2 12 2.2 Q18.4 2.2 18.8 8 Q15 5.6 12 5.6 Q9 5.6 5.2 8 Z" fill="${col}" opacity="0.85"/>`;
  }
}

function accessoryBack(a: Accessory): string {
  return a === 'backpack' ? `<rect x="3" y="18" width="4.4" height="9" rx="1.6" fill="#6B5B4B"/>` : '';
}

function accessoryFront(a: Accessory, hairCol: string): string {
  switch (a) {
    case 'glasses': return `<g fill="none" stroke="#1D2729" stroke-width="0.8"><circle cx="9.4" cy="9.6" r="1.9"/><circle cx="14.6" cy="9.6" r="1.9"/><path d="M11.3 9.6 H12.7"/></g>`;
    case 'headphones': return `<path d="M4.6 10 Q4.6 1.4 12 1.4 Q19.4 1.4 19.4 10" fill="none" stroke="#2F3B3C" stroke-width="1.2"/><rect x="3.4" y="8.6" width="2.6" height="4" rx="1" fill="#2F3B3C"/><rect x="18" y="8.6" width="2.6" height="4" rx="1" fill="#2F3B3C"/>`;
    case 'cap': return `<path d="M4.8 7.6 Q5 1.4 12 1.4 Q19 1.4 19.2 7.6 Z" fill="#33506B"/><rect x="11" y="6.2" width="10.4" height="1.8" rx="0.9" fill="#33506B"/>`;
    case 'scarf': return `<rect x="6.6" y="15.4" width="10.8" height="2.6" rx="1.3" fill="#B64A3C"/><rect x="13" y="16.6" width="2.4" height="5" rx="1" fill="#B64A3C"/>`;
    case 'backpack': return `<path d="M8 17 L7 26" stroke="#6B5B4B" stroke-width="1.2"/>`;
    default: return '';
  }
}

function face(state: State): string {
  const eyes = `<circle cx="9.6" cy="9.8" r="0.9" fill="#1D2729"/><circle cx="14.4" cy="9.8" r="0.9" fill="#1D2729"/>`;
  const mouth = state === 'happy'
    ? `<path d="M10 12.2 Q12 14.2 14 12.2" fill="none" stroke="#1D2729" stroke-width="0.8" stroke-linecap="round"/>`
    : state === 'sick'
      ? `<path d="M10.4 13 Q12 12 13.6 13" fill="none" stroke="#1D2729" stroke-width="0.8" stroke-linecap="round"/>`
      : `<path d="M10.6 12.6 H13.4" stroke="#1D2729" stroke-width="0.8" stroke-linecap="round"/>`;
  return eyes + mouth;
}

function badge(state: State): string {
  if (state === 'sick') return `<g transform="translate(18 0)"><rect x="0" y="0" width="2" height="5" rx="1" fill="#FBFBF8" stroke="var(--ill)" stroke-width="0.5"/><circle cx="1" cy="5" r="1.4" fill="var(--ill)"/></g>`;
  if (state === 'happy') return `<path d="M20 1 l0.8 1.6 1.7 0.2 -1.3 1.2 0.4 1.7 -1.6 -0.9 -1.6 0.9 0.4 -1.7 -1.3 -1.2 1.7 -0.2 Z" fill="#E2B33C"/>`;
  return '';
}

/** 產生一個小人的 SVG（24 × 36）。 */
export function renderCharacter(p: CharacterParams, state: State = 'idle', opts: { size?: number; title?: string } = {}): string {
  const size = opts.size ?? 36;
  const hairCol = HAIR_COLOR[p.hairColor];
  const shirt = collegeVar(p.college);
  const sickFilter = state === 'sick' ? ' style="filter:saturate(0.6)"' : '';
  const ghost = state === 'removed' ? ' opacity="0.3"' : '';
  const glow = state === 'selected' ? `<ellipse cx="12" cy="22" rx="11.5" ry="13.5" fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.7"/>` : '';
  const lanyard = p.year === 1 ? `<path d="M9.6 16 L12 21 L14.4 16" fill="none" stroke="#FBFBF8" stroke-width="0.6"/><rect x="10.8" y="21" width="2.4" height="3" rx="0.4" fill="#FBFBF8"/>` : '';
  const w = (size * 24) / 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${w}" height="${size}" role="img"${ghost}>`
    + (opts.title ? `<title>${opts.title}</title>` : '')
    + glow
    + accessoryBack(p.accessory)
    + hairBack(p.hair, hairCol)
    + `<g${sickFilter}><path d="M6.4 17 Q12 14.6 17.6 17 L19.4 33 Q12 35 4.6 33 Z" fill="${shirt}"/></g>`
    + lanyard
    + `<rect x="7.4" y="32" width="3" height="3.4" rx="1.2" fill="#3A3F45"/><rect x="13.6" y="32" width="3" height="3.4" rx="1.2" fill="#3A3F45"/>`
    + `<circle cx="${CX}" cy="${HY}" r="${HR}" fill="${SKIN[p.skin]}"/>`
    + hairFront(p.hair, hairCol)
    + face(state)
    + accessoryFront(p.accessory, hairCol)
    + badge(state)
    + `</svg>`;
}

/** 網路視圖用的圓形頭像節點。 */
export function renderNode(p: CharacterParams, diameter = 24): string {
  const hairCol = HAIR_COLOR[p.hairColor];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${diameter}" height="${diameter}">`
    + `<circle cx="12" cy="12" r="11.5" fill="${collegeVar(p.college)}"/>`
    + `<g transform="translate(3 4) scale(0.75)"><circle cx="${CX}" cy="${HY}" r="${HR}" fill="${SKIN[p.skin]}"/>${hairFront(p.hair, hairCol)}</g>`
    + `</svg>`;
}

// 隨機數已搬到 src/lib/sim/random.ts；這裡保留匯出，舊的 import 不用改。
import { seededRandom } from '../sim/random';
export { seededRandom };

/** 依章節種子產生群眾角色。 */
export function randomCrowd(n: number, seed: number): CharacterParams[] {
  const r = seededRandom(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  return Array.from({ length: n }, () => ({
    skin: pick([0, 1, 2, 3] as const),
    hair: pick(HAIRS),
    hairColor: pick([0, 1, 2] as const),
    college: pick(COLLEGES),
    accessory: r() < 0.5 ? 'none' : pick(ACCESSORIES),
    year: pick([1, 2, 3, 4] as const),
  }));
}
