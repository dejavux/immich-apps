# 行程 Map View — 工具選型（2027 寒假 pilot）

| 工具 | Map 網頁 | 分日路線 | 地標 | 成本 | 與 Family Memories 對齊 |
|------|----------|----------|------|------|---------------------------|
| **Leaflet + OpenStreetMap** | 單一 HTML 即可 | 自訂圖層／按日切換 | Marker + Polyline | 免費、免 key | ◎ 先驗證 UX，日後可遷入 `apps/recall` |
| **MapLibre GL JS** | 需 bundler 或 CDN | 同 Leaflet | 樣式較漂亮 | 免費 vector 圖資 | ○ Phase C map 可升級 |
| **Google Maps JS** | 需 API key + 計費 | Directions API 可算路 | 完整 POI | 有免費額度 | △ 跟團實際車線與 Google 可能不一致 |
| **Mapbox GL** | 需 token | 強 | 強 | 免費 tier | ○ 與 MapLibre 類似 |
| **uMap / Google My Maps** | 免寫程式 | 手動分層 | 手動 pin | 免費 | △ 難與 Planner `extract_tour` 自動串 |

**本 pilot 採用**：[`danang-lion-baseline-map.html`](danang-lion-baseline-map.html) — Leaflet，資料來自雄獅基準團 extract 之 **5 日動線**（跟團實際順序以領隊為準，座標為景點代表點）。

**開啟方式**：下載 HTML 後用瀏覽器開啟；或日後由 recall 靜態托管。
