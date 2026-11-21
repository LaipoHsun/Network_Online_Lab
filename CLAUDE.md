# 網路實驗室 — 開發規則

這是一個中文互動網站，用台大學生的日常、會動的小人和真實研究資料，教大學生社會網路（network science）。

## 先讀
- `docs/design.md`：全站規格（讀者、設計原則、八段式章節骨架、視覺語言、共用元件、技術架構、開發順序）。
- `docs/characters.md`：小人角色規格。程式在 `src/lib/sprites/character.ts`。
- `docs/campus-map.md`：校園地圖規格。
- `docs/chapters/<章>.md`：要做哪一章就讀哪一章。
- 規格和程式衝突時以規格為準；規格不清楚時停下來問，不要自己發明內容。

## 目前進度
- 階段 1（骨架）已完成：Astro + Svelte + MDX、設計 tokens、首頁課程地圖、九章佔位頁、角色產生器與 `/playground/characters`、GitHub Pages 部署流程。
- 階段 2（圖演算法庫）已完成：`src/lib/network`，期望值由 `data/scripts/networkx_expected.py` 產生到 `tests/fixtures/networkx/`；改了演算法或資料就重跑這支腳本（`python3 data/scripts/networkx_expected.py`）。
- 下一步：階段 3「共用元件」（見 docs/design.md「給 Claude Code 的施工說明」）。

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
- `npm install`、`npm run dev`（http://localhost:4321）、`npm test`、`npm run build`。
- 資料：`python3 data/scripts/networkx_expected.py`（測試期望值與 data/raw）。

## 完成的定義
- `npm test` 和 `npm run build` 通過。
- 符合該章規格的驗收清單，並在 PR 描述中逐項列出。
- 附桌機和手機各一張截圖。
