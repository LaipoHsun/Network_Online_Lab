import type { CharacterParams } from '../lib/sprites/character';

export interface Chapter {
  n: number;
  slug: string;
  title: string;      // 場景問句
  concept: string;    // 概念名（中英）
  prereq: string[];
  minutes: number;
  status: 'planned' | 'in-progress' | 'done';
  hero: { name: string; dept: string; look: CharacterParams };
}

// 主角外觀與 docs/characters.md 的「固定角色表」一致
export const CHAPTERS: Chapter[] = [
  { n: 1, slug: '01-degree', title: '迎新週：你加了多少 LINE 好友？', concept: '度與度分布（degree distribution）', prereq: [], minutes: 20, status: 'in-progress',
    hero: { name: '品妤', dept: '經濟一', look: { skin: 1, hair: 'bun', hairColor: 0, college: 'socsci', accessory: 'none', year: 1 } } },
  { n: 2, slug: '02-bipartite', title: '宿舍、系所還是年級：你的朋友從哪裡來？', concept: '二分網路與投影（bipartite projection）', prereq: ['度'], minutes: 20, status: 'in-progress',
    hero: { name: '語涵', dept: '社會二', look: { skin: 0, hair: 'long', hairColor: 1, college: 'socsci', accessory: 'scarf', year: 2 } } },
  { n: 3, slug: '03-triadic-closure', title: '室友的朋友：為什麼朋友圈會「收合」？', concept: '三元閉合與聚集係數（clustering coefficient）', prereq: ['度', '投影'], minutes: 25, status: 'in-progress',
    hero: { name: '承恩', dept: '物理一', look: { skin: 2, hair: 'short', hairColor: 0, college: 'sci', accessory: 'glasses', year: 1 } } },
  { n: 4, slug: '04-small-world', title: 'Dcard 午夜抽卡：為什麼世界這麼小？', concept: '小世界（small world）', prereq: ['度', '聚集係數'], minutes: 25, status: 'in-progress',
    hero: { name: '宜蓁', dept: '資工三', look: { skin: 1, hair: 'ponytail', hairColor: 2, college: 'eng', accessory: 'headphones', year: 3 } } },
  { n: 5, slug: '05-friendship-paradox', title: '為什麼你的朋友好像都比你受歡迎？', concept: '友誼悖論（friendship paradox）', prereq: ['度分布'], minutes: 20, status: 'in-progress',
    hero: { name: '家瑄', dept: '社工一', look: { skin: 3, hair: 'curly', hairColor: 0, college: 'socsci', accessory: 'backpack', year: 1 } } },
  { n: 6, slug: '06-weak-ties', title: '暑期實習，是誰介紹的？', concept: '弱連結的力量（strength of weak ties）', prereq: ['聚集係數', '小世界'], minutes: 30, status: 'in-progress',
    hero: { name: '小瑜', dept: '經濟三', look: { skin: 2, hair: 'short', hairColor: 1, college: 'socsci', accessory: 'backpack', year: 3 } } },
  { n: 7, slug: '07-centrality', title: '系學會的消息，為什麼都經過他？', concept: '中心性（centrality）', prereq: ['距離', '橋'], minutes: 25, status: 'planned',
    hero: { name: '子軒', dept: '政治二', look: { skin: 1, hair: 'buzz', hairColor: 0, college: 'socsci', accessory: 'cap', year: 2 } } },
  { n: 8, slug: '08-communities', title: '社團吵架分成兩派：演算法猜得到誰站哪邊嗎？', concept: '社群偵測與模組度（modularity）', prereq: ['度', '聚集係數', '介數中心性'], minutes: 25, status: 'planned',
    hero: { name: '定遠', dept: '歷史三', look: { skin: 0, hair: 'curly', hairColor: 1, college: 'lib', accessory: 'glasses', year: 3 } } },
  { n: 9, slug: '09-contagion', title: '期末流感和晨跑習慣：為什麼病毒和行為傳得不一樣？', concept: '簡單與複雜傳染（complex contagion）', prereq: ['小世界', '友誼悖論', '聚集係數'], minutes: 30, status: 'planned',
    hero: { name: '欣妍', dept: '醫學二', look: { skin: 2, hair: 'ponytail', hairColor: 0, college: 'med', accessory: 'none', year: 2 } } },
];

export const SEASONS = [
  { n: 1, title: '第一季：社會網路', note: '從朋友圈開始，九章。' },
  { n: 2, title: '第二季：合作網路', note: '網路怎麼長大：偏好依附、團隊與高階互動。' },
  { n: 3, title: '第三季：移動網路', note: '空間網路、重力模型、通勤與流動。' },
];
