# Phase 5b — Immich / LINE Bot 監控與告警

> Subagent prompt：Grafana dashboard + Prometheus 告警；**獨立於** Phase 4。

---

## 目標

Grafana dashboard + Prometheus 告警，覆蓋 Immich server 與 LINE bot SLO。

---

## 依賴

- **軟前置**：Phase 5a（備份失敗告警可與本階段合併）
- **可平行**：Phase 1 deploy 完成後（probe metrics 更完整）
- **獨立於**：Phase 4 SSD 遷移
- **建議**：Phase 3.5 gate PASS 後再 deploy 告警至 prod（避免噪音）

---

## Multi-task 可平行子任務

| ID | 任務 | 可平行 |
|----|------|--------|
| 5b-A | Immich server dashboard（assets、ML queue、disk） | ✅ |
| 5b-B | LINE bot dashboard（上傳成功率、搜尋延遲） | ✅ |
| 5b-C | Alertmanager 規則（backup failed、pod not ready） | 須 A/B 有 metric 名稱 |

---

## 路徑

- Immich server：`infra-bootstrap/60_apps/immich/immich-deployment.yaml`（`prometheus.io/scrape` port 8081）
- LINE bot：`immich-apps/deploy/helm/immich-line-bot/`（`/metrics`）
- Monitoring：`infra-bootstrap/70_monitoring/`
- Telegram：遵循 workspace 規則 — `bot_token_file` / `chat_id_file`，**勿** ConfigMap 明文 token
- SSOT vault：`Infra-CI` / `Monitoring-Telegram-Bot`

---

## 執行步驟

1. 用 Grafana MCP 或 Prometheus 查可用 metric（Immich `GET /metrics` port 8081）。
2. 建立 dashboard JSON 或 `patch_dashboard` 現有 board。
3. 告警：backup job failed、immich-server down、line-bot 5xx、上傳成功率 < 90%。
4. Telegram routing：與現有 Alertmanager 整合；smoke test 一條告警。
5. 更新 `BACKLOG.md` LINE Grafana / 7 天 SLO 項。
6. 可選：將 tier/reconcile JSON tail 納入未來 dashboard（見 `UX_PRODUCT_REVIEW.md` P2）。

---

## 驗收標準

- [ ] Dashboard 可 deep link（`generate_deeplink` 或文件記錄 UID）
- [ ] 測試告警 fire → Telegram 收到（smoke）
- [ ] 文件：哪個 panel 對應哪個 SLO
- [ ] `PROGRESS_TRACKING.md` Phase 5 監控項更新

---

## 禁止

- ConfigMap 存放 Telegram bot token
- 未經使用者確認建立會扣款的 incident 或 on-call 服務

---

## Handoff

- Dashboard UID / URL
- 告警規則檔案路徑（`infra-bootstrap/70_monitoring/`）
- Smoke test 時間戳與截圖/日誌摘要（可選）
