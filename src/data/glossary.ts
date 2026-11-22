// 術語表：中英對照、一句定義、第一次出現的章節（docs/design.md「術語表」）。
// 定義是 Claude 寫的初稿，待作者審定。

export interface Term { zh: string; en: string; def: string; chapter: number }

export const GLOSSARY: Record<string, Term> = {
  degree: { zh: '度', en: 'degree', def: '一個人有幾位朋友，也就是連到他的連結數。', chapter: 1 },
  network: { zh: '網路', en: 'network', def: '一群節點（人）和節點之間的連結（關係）。數學上也叫做圖（graph）。', chapter: 1 },
  'adjacency-matrix': { zh: '鄰接矩陣', en: 'adjacency matrix', def: 'N × N 的表格：第 i 列第 j 行是 1 代表 i 和 j 是朋友，0 代表不是。', chapter: 1 },
  'average-degree': { zh: '平均度', en: 'average degree', def: '所有人的度的平均，等於 2L / N（L 是連結數，N 是人數）。', chapter: 1 },
  'degree-distribution': { zh: '度分布', en: 'degree distribution', def: '朋友數為 k 的人佔全體的比例 p_k，畫成圖就是「有多少人有幾位朋友」。', chapter: 1 },
  handshake: { zh: '握手定理', en: 'handshaking lemma', def: '每條連結被兩端各算一次，所以所有人的度加起來等於連結數的兩倍。', chapter: 1 },
  density: { zh: '密度', en: 'density', def: '實際的連結數除以「所有人兩兩之間都連起來」時的連結數。', chapter: 1 },
  sparse: { zh: '稀疏', en: 'sparse', def: '平均度遠小於人數，密度接近 0：每個人只認識全體中極少的一部分。', chapter: 1 },
  hub: { zh: '樞紐', en: 'hub', def: '朋友數遠多於一般人的少數節點。', chapter: 1 },
  clustering: { zh: '聚集係數', en: 'clustering coefficient', def: '你的朋友之間彼此也是朋友的比例；越高代表朋友圈越「收合」。', chapter: 3 },
  projection: { zh: '投影', en: 'bipartite projection', def: '把「人—活動」的二分網路，變成「參加過同一個活動的人彼此相連」的網路。', chapter: 2 },
  'triadic-closure': { zh: '三元閉合', en: 'triadic closure', def: '有共同朋友的兩個人，比較容易變成朋友，於是「兩條邊」補成一個三角形。', chapter: 3 },
  'focal-closure': { zh: '焦點閉合', en: 'focal closure', def: '一起參加同一個活動（同一門課、同一個社團）的兩個人，比較容易變成朋友。', chapter: 3 },
  triangle: { zh: '三角形', en: 'triangle', def: '三個人兩兩都是朋友。', chapter: 3 },
  triad: { zh: '連通三元組', en: 'connected triple', def: '一個人和他的兩位朋友（不管那兩位朋友認不認識）。一個三角形含有三個連通三元組。', chapter: 3 },
  transitivity: { zh: '遷移性', en: 'transitivity', def: '全網路的三角形數 × 3，除以連通三元組數；又叫全域聚集係數。', chapter: 3 },
  closure: { zh: '封閉性', en: 'closure', def: 'Coleman 的概念：彼此都認識的緊密圈子，容易建立規範和信任。', chapter: 3 },
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
