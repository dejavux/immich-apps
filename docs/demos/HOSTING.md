# 家庭行程靜態站 · 部署選項

這些頁面是**純靜態** HTML／JS（無後端），可放在多種位置。

## 為什麼先前用 GitHub／jsDelivr？

| 考量 | GitHub Pages + jsDelivr | 自家 K8s cluster |
|------|-------------------------|------------------|
| 上線速度 | Push `main` 即更新，無需改 cluster | 需 Ingress、憑證、可能 ConfigMap／映像 |
| 分享連結 | 親友直接開 URL，不需 VPN | 通常要網域 +（建議）認證或內網 |
| 與 repo 同步 | 行程 JSON／地圖與程式碼同 PR 審查 | 需另建 CD 把 `docs/demos` 同步到靜態服務 |
| 私密性 | 公開 repo／公開 URL（勿放個資） | 可限制在 `*.3q.fi`、OAuth、或內網 |
| 與 Planner API | 分離；地圖不接雄獅 API | 可同源 `planner.3q.fi/tours/…`，日後接 API 較順 |

**結論：** 迭代家庭 demo、快速給親友連結時，GitHub 最省事。目前家庭站**暫定只用 GitHub**；若日後要改 cluster，見下文「Cluster 建議做法」。

Immich 相簿連結在 `family-tours-site.js` 的 `immich.url`（請改成實際 shared album）。

## 公開網址（目前）

- **首頁（行程列表）**  
  - jsDelivr: `https://cdn.jsdelivr.net/gh/dejavux/immich-apps@main/docs/demos/index.html`  
  - GitHub Pages: `https://dejavux.github.io/immich-apps/index.html`
- **峴港已確認團**  
  - `…/danang-lion-27sv125br1-map.html`（同目錄需能載入 `danang-lion-27sv125br1-tour-data.js`）

勿用 `htmlpreview.github.io` 包一層（常阻擋 Leaflet）。

## Cluster 建議做法（概要）

1. 將 `docs/demos/` 打包進靜態映像（nginx alpine）或掛載 volume。
2. Ingress 例如 `tours.3q.fi` → Service 80，TLS 用既有 cert-manager。
3. 可選：與 `family-planner` 同 namespace，僅內網或透過 Authelia／Forward Auth。
4. CI：在 `main` push 時 build & rollout（與現有 Tekton／deploy 流程並列）。

若你決定用 cluster，可在 repo 加 `deploy/k8s/family-tours-static/` manifest；地圖頁已用**相對路徑**載入 CSS／JS，換 host 不需改程式。

## 快取

- jsDelivr 跟 `@main` 有 CDN 快取，急著看新版可加 `?v=日期` 或暫用 `@<commit-sha>`。
- GitHub Pages 在 workflow `Publish demo static pages` 完成後更新。
