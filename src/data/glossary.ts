// 術語表：中英對照、一句定義、第一次出現的章節（docs/design.md「術語表」）。
// 定義是 Claude 寫的初稿，待作者審定。

export interface Term { zh: string; en: string; def: string; chapter: number }

export const GLOSSARY: Record<string, Term> = {
  degree: { zh: '度', en: 'degree', def: '一個人有幾位朋友，也就是連到他的連結數。', chapter: 1 },
  clustering: { zh: '聚集係數', en: 'clustering coefficient', def: '你的朋友之間彼此也是朋友的比例；越高代表朋友圈越「收合」。', chapter: 3 },
  'small-world': { zh: '小世界', en: 'small world', def: '網路裡多數人很「聚集」，但任兩人之間平均只隔幾步。', chapter: 4 },
  'tie-strength': { zh: '連結強度', en: 'tie strength', def: '兩人關係的強弱，常用見面頻率、相處時間或通話時間來量。', chapter: 6 },
  'weak-tie': { zh: '弱連結', en: 'weak tie', def: '不常見面、不太熟的關係，例如只修過同一門課的學姊。', chapter: 6 },
  'strong-tie': { zh: '強連結', en: 'strong tie', def: '常常見面、彼此很熟的關係，例如室友、同系好友。', chapter: 6 },
  overlap: { zh: '鄰居重疊度', en: 'neighborhood overlap', def: '一條連結兩端的人，共同朋友佔兩人朋友圈的比例；0 代表沒有共同朋友。', chapter: 6 },
  bridge: { zh: '橋', en: 'bridge', def: '拿掉之後網路會分裂成兩塊的連結。', chapter: 6 },
  'local-bridge': { zh: '局部橋', en: 'local bridge', def: '兩端沒有共同朋友的連結；拿掉後兩人之間的距離會變長。', chapter: 6 },
  'giant-component': { zh: '最大連通群', en: 'giant component', def: '網路裡彼此都有路徑相連的最大一群人。', chapter: 6 },
  percolation: { zh: '滲流', en: 'percolation', def: '逐步拿掉連結時，網路在某個門檻突然從一整塊碎成很多小塊的現象。', chapter: 6 },
  'forbidden-triad': { zh: '禁止三角形', en: 'forbidden triad', def: 'Granovetter 的假設：如果 A 和 B、A 和 C 都很熟，B 和 C 之間至少會有弱連結。', chapter: 6 },
  'structural-hole': { zh: '結構洞', en: 'structural hole', def: 'Burt 的概念：兩群人之間沒有連結的空隙；站在空隙上的人能接觸到兩邊的資訊。', chapter: 6 },
  'social-capital': { zh: '社會資本', en: 'social capital', def: '透過人際關係取得的資源，例如資訊、信任與幫忙。', chapter: 6 },
};
