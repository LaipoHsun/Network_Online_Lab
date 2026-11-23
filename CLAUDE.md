# 網路實驗室 — 開發規則

這是一個中文互動網站，用台大學生的日常、會動的小人和真實研究資料，教大學生社會網路（network science）。

## 先讀
- `docs/design.md`：全站規格（讀者、設計原則、章節骨架（已改為七段，見該節開頭的作者修訂）、視覺語言、共用元件、技術架構、開發順序）。
- `docs/characters.md`：小人角色規格。程式在 `src/lib/sprites/character.ts`。
- `docs/campus-map.md`：校園地圖規格。
- `docs/chapters/<章>.md`：要做哪一章就讀哪一章。
- 規格和程式衝突時以規格為準；規格不清楚時停下來問，不要自己發明內容。

## 目前進度
- 階段 1（骨架）已完成：Astro + Svelte + MDX、設計 tokens、首頁課程地圖、九章佔位頁、角色產生器與 `/playground/characters`、GitHub Pages 部署流程。
- 階段 2（圖演算法庫）已完成：`src/lib/network`，期望值由 `data/scripts/networkx_expected.py` 產生到 `tests/fixtures/networkx/`；改了演算法或資料就重跑這支腳本（`python3 data/scripts/networkx_expected.py`）。
- 階段 3（共用元件）已完成初版：小人引擎與雙視圖（`src/components/engine/`，模擬邏輯在 `src/lib/sim/campus.ts`）、Predict、LogicChain、FormulaCard、RevealChart（`src/components/ui/`），展示頁 `/playground`。章節要用引擎時，在 `src/components/chapters/` 寫一個 Svelte 元件傳入劇本（Astro 不能傳函式給 island），寫法參考 `src/components/playground/EngineDemo.svelte`。
- 已定案（作者授權由 Claude 決定）：校園地圖採用目前這一版（`src/data/campus.json`、`CampusMap.svelte`；直向版由橫向縮放，之後可逐點手調）；`--ill` = 梅紫 #8E3B8C／深色 #B95FB5。
- 階段 4（第 6 章）初稿完成，待作者審定內文：章節版型（`src/layouts/Chapter.astro`、`src/components/chapter/`：八段進度條、Step 捲動雙欄、Term 術語、M 行內公式、NextQuestion）、內文 `src/content/chapters/06-weak-ties.mdx`（Claude 撰寫的初稿）、場景 `src/components/chapters/ch6/`、資料 `data/build/06-weak-ties/`（Onnela、Rajkumar 為由論文圖讀取，標 digitized）。
- 階段 5 第 1 章初稿完成，待作者審定內文：`src/content/chapters/01-degree.mdx`、場景 `src/components/chapters/ch1/`（宿營劇本、即時度分布、鄰接矩陣）、資料 `data/build/01-degree/`（Ugander 2011 Fig. 1(b) 為向量圖，直接讀座標，標 digitized）。引擎新增 `Script.days`（只跑幾天）與 DualView 的 `onselect`。
- 階段 5 第 3 章初稿完成，待作者審定內文：`src/content/chapters/03-triadic-closure.mdx`、場景 `src/components/chapters/ch3/`（宵夜劇本、C(t) 圖、自我網路）、資料 `data/build/03-triadic-closure/`（Kossinets & Watts 2006 Fig. 1B 為點陣圖，依標記位置讀取，標 digitized；Pew 2012 密度 0.12 取自原文）。引擎新增 `Script.beforeSlot` 與 `CampusSim.neighbors/hasTie`；Predict 曲線支援 `logY`。
- 階段 5 第 4、5 章初稿完成，待作者審定內文：第 4 章 `src/components/chapters/ch4/`（環狀格子 + Watts–Strogatz，60 人圈與 400 人曲線）、資料 `data/build/04-small-world/`（Milgram、Backstrom、Facebook 2016 皆取自原文；台灣人口取自內政部 114 年 12 月底）；第 5 章 `src/components/chapters/ch5/`（配置模型、兩種抽樣、流感哨兵）、資料 `data/build/05-friendship-paradox/`（Pew 取自原文；Christakis & Fowler 2010 Figure 3 左依顏色讀取，標 digitized）。
- 從 $effect 裡呼叫 emitLive 要包在 untrack 裡（公式卡的狀態會被算成依賴而無限循環）。
- 階段 5 第 2 章初稿完成，待作者審定內文：`src/components/chapters/ch2/`（四種焦點權重的校園劇本、二分圖 ⇄ 投影）、資料 `data/build/02-bipartite/`（Traud, Mucha & Porter 2012 附錄 Table A.1、A.2 的文字，100 校全部解析）。Predict 新增 `rank`（排序）題型，RevealChart 會在長條下標出讀者的名次。
- 2026-11 作者修訂章節結構（第 1–7 章都已套用）：七段、拿掉 ⑧；① 用 `src/components/chapter/SceneCard.astro`（靜態）；③ 只留一個主要場景（各章原本的場景 B、C 已從內文移除，元件檔還在）；⑥ 加上 `src/components/ui/PeopleUnits.astro`（資料由 `data/scripts/people_data.py` 從各章 data/build 換算）。
- 階段 5 第 7 章初稿完成，待作者審定內文：`src/components/chapters/ch7/`（四種眼鏡、佛羅倫斯家族網路）、資料 `data/build/07-centrality/`（中心性由 networkx 計算；Milgram 的 G 先生取自原文）。
- 下一步：作者審第 1–7 章內文；之後階段 5 其餘章節（順序 8 → 9）。

## 內容
- 不要自己寫或改任何研究數字。所有數字來自 `data/build/*.json`，每筆都有 `source`。
- MDX 內文由作者負責；你只能改排版和元件引用，修改文字前要先問。
- 用繁體中文（台灣），術語首次出現時中英並列。
- 校園地圖是示意插畫：不描摹官方地圖、不用校徽或官方標誌。

## 程式
- 圖演算法只放在 `src/lib/network`，純函式、無 DOM，每個都要有測試，並與 networkx 的結果比對。
- 模擬只用 `seededRandom`（`src/lib/sim/random.ts`），不用 `Math.random`。
- 顏色、字體、間距只用 `src/styles/tokens.css` 的 token。
- 互動元件必須：鍵盤可操作、支援 prefers-reduced-motion、在 375px 寬可用。
- 所有套件版本寫死在 lockfile；TypeScript 維持 6.x（@astrojs/svelte 尚不支援 7）。

## 指令
- `npm install`、`npm run dev`（http://localhost:4321；Astro 7 會在背景常駐，用 `npx astro dev stop` 停止）、`npm test`、`npm run build`。
- 資料：`python3 data/scripts/networkx_expected.py`（測試期望值與 data/raw）、`python3 data/scripts/playground_data.py`（/playground 的揭曉圖資料）、`python3 data/scripts/ch6_data.py --onnela <pdf> --rajkumar <pdf>`（第 6 章）、`python3 data/scripts/ch1_data.py --ugander <pdf>`（第 1 章）、`python3 data/scripts/ch3_data.py --kossinets <pdf> [--overlay <png>]`（第 3 章）、`python3 data/scripts/ch4_data.py`（第 4 章）、`python3 data/scripts/ch5_data.py --christakis-fig <jpg>`（第 5 章）、`python3 data/scripts/ch2_data.py --traud <pdf>`（第 2 章）、`python3 data/scripts/ch7_data.py`（第 7 章）、`python3 data/scripts/people_data.py`（各章第 ⑥ 段的小人圖，最後跑）；PDF 不放進 repo，來源見各腳本開頭。

## 完成的定義
- `npm test` 和 `npm run build` 通過。
- 符合該章規格的驗收清單，並在 PR 描述中逐項列出。
- 附桌機和手機各一張截圖。
