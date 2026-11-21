# 網路實驗室（AI Network Online Lab）

用台大學生的日常生活、會動的小人和真實研究資料，讓大學生讀懂社會網路的數學結構與它在經濟學、社會學上的意義。

## 開始
```bash
npm install
npm run dev      # http://localhost:4321
npm test
npm run build
```

## 文件
- `docs/design.md`：設計書（全站規格）
- `docs/characters.md`：小人角色
- `docs/campus-map.md`：校園地圖
- `docs/chapters/`：九章逐章規格
- `CLAUDE.md`：給 Claude Code 的開發規則

## 部署
推到 GitHub 的 `main` 分支後，`.github/workflows/deploy.yml` 會自動建置並部署到 GitHub Pages。第一次使用前，到 repo 的 Settings → Pages 把 Source 設為「GitHub Actions」。
