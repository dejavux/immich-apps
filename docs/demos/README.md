# Demo static pages · 家庭行程

| 檔案 | 說明 |
|------|------|
| [index.html](./index.html) | **家庭行程首頁**（列出已確認／比價團） |
| [family-tours.css](./family-tours.css) | 共用 header／footer／首頁版型 |
| [family-tours-site.js](./family-tours-site.js) | 行程列表、封面圖、Immich 連結設定 |
| [family-tours-ui.js](./family-tours-ui.js) | 首頁渲染、倒數、footer |
| [danang-lion-27sv125br1-map.html](./danang-lion-27sv125br1-map.html) | **已確認參團** 27SV125BR1-T · 含航班／自費／POI 詳情 |
| [danang-lion-27sv125br1-tour-data.js](./danang-lion-27sv125br1-tour-data.js) | 上列地圖的擴充資料（同目錄載入） |
| [danang-lion-baseline-map.html](./danang-lion-baseline-map.html) | 比價用示意（JX1／星宇） |
| [HOSTING.md](./HOSTING.md) | GitHub vs cluster 部署說明 |

## 公開網址（`main`）

- **首頁**  
  - jsDelivr: `https://cdn.jsdelivr.net/gh/dejavux/immich-apps@main/docs/demos/index.html`  
  - GitHub Pages: `https://dejavux.github.io/immich-apps/index.html`
- **峴港已確認團地圖**  
  - `…/danang-lion-27sv125br1-map.html`（同目錄需能載入 `family-tours.css` 與 `tour-data.js`）

勿用 `htmlpreview.github.io` 包一層（常阻擋 Leaflet）。

PR 預覽：將 jsDelivr 的 `@main` 改為 `@<branch>`。
