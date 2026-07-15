# Backlog — 待辦與優先順序

**SSOT 進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)  
**最後更新**: 2026-07-15（影片 E2E · REDIS_URL · Qwen model 對齊 Instruct）  
**UX 檢視**: [UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md)

---

## 文件角色

| 文件 | 用途 |
| ------ | ------ |
| **PROGRESS_TRACKING** | Phase 級 checklist SSOT |
| **HOW_TO_PROCEED** | 本週 Sprint 該做什麼 |
| **BACKLOG（本檔）** | 細項、tech debt、未排進 Sprint 的候選 |

**已結案規格** → [60_completed/](../60_completed/) · **維運 runbook** → [20_guides/](../20_guides/)  
**Multi-task 派工** → [agent-prompts/README.md](./agent-prompts/README.md)

---

## 當前 Sprint（2026-07-05 · LIFF hub + 影片上傳 + 維運收尾）

| 軌道 | 任務 | 狀態 | 備註 |
| ------ | ------ | ------ | ------ |
| — | **Immich Enhancement** | ✅ 結案 | Phase 0–3.6 + 3.5（purge 豁免） |
| **LINE** | LIFF hub + Passkey | ✅ | PR #42 · `/liff/hub` · Rich Menu 帳戶設定 |
| **LINE** | video clip 上傳 | ✅ | `631e855` · **E2E 驗收通過**（使用者驗證 2026-07-15） |
| **LINE** | webhook 簽章修復 | ✅ | `cde1b58` |
| **LINE** | Qwen 搜尋 model 對齊 | ✅ | `QWEN_MODEL` → `Qwen/Qwen2.5-7B-Instruct`（使用者驗證 2026-07-15） |
| **Ops W1** | Phase 5a NFS + pg_dump | ✅ **PASS** | pg 2/2 · NFS Job ✅ · B2 已刪 |
| **Ops** | Phase 1 probes/Redis | ✅ **已 deploy** | probes + NetworkPolicy + Redis secret（2026-06-23） |
| **Ops W3** | Phase 5b monitoring | 🟡 **~95%** | immich-ops 有資料 · Telegram smoke 待確認 |
| **P2** | album reconcile | 📋 可選 | stale 27 / missing 123 |
| **Ops W2** | Mac library → delta **HDD** | 🟡 **~50%** | local **63G/146G** · icloud **17G/18G** |
| **Ops W4** | Phase 4 SSD 遷移 | ✅ **COMPLETE** | 2026-06-24 · postgres → `/nvme/immich-postgres` |

---

## 優先順序總覽

```text
🔴  立即     LIFF Passkey 實機
✅  結案     Immich Enhancement（Phase 0–3.6 + 3.5 豁免）
LINE         LIFF hub ✅ · video upload ✅ E2E · Qwen Instruct ✅ · REDIS_URL ✅
Ops W2       Mac → delta HDD rsync ~50%（63G/146G local · 17G/18G icloud）
Ops W3       Phase 5b 告警 + immich-ops Grafana（~95%）
P1  產品     上傳管道 UX · Web+LINE P0 驗收
P2  平台     LINE Grafana panel · Similar images
P3  AI       Qwen vision · Photo Edit BFF · LIFF 搜尋瀏覽 UI
```

---

## Phase 5a+ — Mac Photos Library → delta HDD（首輪 rsync 進行中）

**優先級**: P1  
**Runbook**: [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)  
**SSOT 路徑**: `delta.3q.fi:/mnt/volume1/nfs-models/photos-backup/mac-studio/`（`nfs-hdd` · ~12T；**非** NVMe `/home/nfs-storage`）

- [x] delta 路徑決策（NVMe → HDD · 與 Immich data backup 同 tier）
- [x] dry-run（local-archive **146G** · icloud-primary **18G**）
- [x] delta HDD 遠端目錄 + `chown light0`（2026-06-25）
- [x] `mac-library-backup-rsync.sh` + LaunchAgent plist 草稿（週六 02:00）
- [x] `DELTA_BASE` 改 HDD + runbook 更新（PR #31 · `c41f09d`）
- [x] `make verify-line-bot` / `verify-deploy` 腳本（PR #31）
- [x] NVMe 舊 partial copy 清理（~48G 釋放 · 2026-06-25）
- [x] LaunchAgent `com.immich.mac-library-backup` 已 `launchctl load`
- [ ] 首輪 rsync Complete（local **63G/146G** · icloud **17G/18G** · 2026-06-29 `du` 複查無變）
- [ ] 還原演練 checksum 抽樣

**不取代**：Immich `/data/upload` → NFS 週備份（已 deploy）。

---

## Observability 整合（延後 · 獨立）

見 [OBSERVABILITY_ROADMAP.md](../20_guides/infra/monitoring/OBSERVABILITY_ROADMAP.md) — 現況維持 **by-app** PrometheusRule + Grafana panel；全平台 SSOT 最後統一。

---

- [x] conservative orphan cleanup · album scope reconcile（PR #19）
- [x] API upload + bulk date fix · PR #19 `39f8a66`
- [x] 週日 LaunchAgent dry-run reconcile
- [x] M3 fswatch watch（PR #20 `d803a19`）
- [x] 本機 apply **+17** orphan（2026-06-17 · 擴大 scope）
- [x] M3.1 PR：`photos_db_libraries` · `include_mac_uploads` · `grace_days: 0`（PR #21）
- [x] Phase 3.6 歸檔（PR #22）
- [x] `immich-reconcile-diagnose.sh`（asset id → mac_ref 狀態）
- [x] reconcile dry-run orphan **0**（2026-06-22；purge 後若再出現 orphan 再 apply）

**維運**：tier 搬移不刪 Immich；purge 前 reconcile skip；見 [20_OPERATIONS.md](./photo-sync/delete-reconcile/20_OPERATIONS.md)

---

## Similar images（P2 · Optional）

**規格**: [photo-sync/similar-images/10_REQUIREMENTS.md](./photo-sync/similar-images/10_REQUIREMENTS.md)  
**Runbook**: [SIMILAR_IMAGES_EVAL.md](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)

- [ ] 啟用 Duplicate Detection · 等 ML job 完成
- [ ] Ground truth 20 組 + recall/precision
- [ ] 決策：內建足夠 vs 建 `similar-images-audit.py`

**背景**：`audit-local-duplicates` 顯示 ~1506 hash-miss（Photos 重編碼）；需 **visual similarity** 非 checksum。

---

## Immich Ops（Phase 1 / 4 / 5 — 獨立 backlog）

> **釐清**：2026-06-22 agent-prompts 派工；cluster deploy 完成（probes、NetworkPolicy、CronJob、PrometheusRule）。Phase 5a **PASS**（2026-06-24）。

### Phase 1 — 基礎設施強化（prompt ✅ · 執行 ✅ deploy）

→ [agent-prompts/phase-1-hardening.md](./agent-prompts/phase-1-hardening.md)

- [x] 基線：Immich K8s · GPU ML · 1Password · MetalLB · Caddy
- [x] probes（server/postgres/redis/ml）— 2026-06-22 deploy
- [x] NetworkPolicy（`immich` namespace）
- [x] `immich-configmap.yaml` 文檔化（legacy nginx，未掛載）
- [x] Redis/Valkey 密碼 + `Immich-Redis` 1Password item + rollout（2026-06-23）

### Phase 5 — Backup（prompt ✅ · 執行 ✅ PASS）

→ [agent-prompts/phase-5a-backup.md](./agent-prompts/phase-5a-backup.md) · [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

- [x] v2.7.5 升級時 **手動** pg_dump 一次（非自動化）
- [x] pg_dump CronJob（每日）+ 本機 PVC 備份驗證（93MB gzip）
- [x] 還原 runbook + 演練（`asset` count 13759 = prod）
- [x] pg_dump CronJob + NFS rsync CronJob（PR #174）
- [x] `Immich-B2-Backup` 已刪（改 NFS）
- [x] 連續 2 次**排程** pg Success（`29702580` · `29704020`）
- [x] NFS data Job Complete（`immich-data-backup-nfs-test-1782176320` · **157.8G** · 7h34m）

### Phase 4 — Storage SSD（✅ COMPLETE 2026-06-24）

→ [STORAGE_MIGRATION.md](../20_guides/infra/runbooks/STORAGE_MIGRATION.md)

- [x] 4-prep-A：lama NVMe/HDD 盤點
- [x] 4-prep-B：runbook
- [x] Postgres → `/nvme/immich-postgres`（470M rsync · `asset` 13763）
- [ ] thumbs → NVMe（可選 · 未執行）

### Phase 5b — Monitoring（prompt ✅ · 執行 🟡 PARTIAL）

→ [agent-prompts/phase-5b-monitoring.md](./agent-prompts/phase-5b-monitoring.md) · [IMMICH_DASHBOARD_SPEC.md](../20_guides/infra/monitoring/IMMICH_DASHBOARD_SPEC.md)

- [x] PrometheusRule（backup failed · pod not ready · LINE bot 5xx）
- [x] Dashboard 規格文件
- [x] Dashboard JSON（UID `immich-ops`）in ConfigMap
- [x] cluster apply + rollout（2026-06-23）
- [x] deep link 驗證 `https://grafana.3q.fi/d/immich-ops`（PromQL 有資料 2026-06-24）
- [ ] Telegram smoke test 告警（已重送 3 條 · 待確認）

---

## Phase 3.5 — tier policy（✅ 結案）

**規格**: [photo-sync/tier-policy/](./photo-sync/tier-policy/)

### 已完成

- [x] M1–M3 bulk · Phase B download/import · 災難復原 · 相簿 638/638
- [x] reconcile orphan **0** · staging **0**
- [x] purge/還原 → **豁免**（family shared，2026-06-22）

### 可選 P2

- [ ] album reconcile stale/missing → 0/0
- [ ] rollback 實測文件 · tier LaunchAgent/cron

## LINE Bot V1.1+（P1–P3）

> 📋 CLIP Smart Search 已可用；LIFF hub 已上線（帳戶設定 / Passkey）

- [x] **LIFF hub + Passkey**（PR #42）— `/liff/hub` · Safari 外部瀏覽器 · unlock grant 8h
- [x] Rich Menu 四欄含「帳戶設定」
- [x] **video clip 上傳**（`631e855`）— `line-video` source · **E2E 驗收通過**（使用者驗證 2026-07-15）
- [x] `REDIS_URL` — Passkey grant 跨 pod（P2；使用者驗證 2026-07-15）
- [ ] Qwen vision 繁中描述（P3）
- [ ] Grafana dashboard + 7 天 SLO（P2）
- [ ] **LIFF 搜尋瀏覽 UI**（P3 defer）— hub 已覆蓋設定；全功能瀏覽器內搜尋待評估

---

## Optional — Photo Edit + AI（P3 · **Defer**）

→ [photo-edit/10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md)

---

## UX / 產品體驗（P1–P2）

> 完整檢視：[UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md)

### LINE Bot

- [x] Rich Menu：找照片 · 上傳教學 · 使用說明（`setup-rich-menu.sh` · 2026-06-18）
- [x] 部署 LINE Bot（welcome · Quick Reply）· PR #25 · 2026-06-18
- [x] 首次對話 welcome 訊息（follow event → WELCOME_MESSAGE · 已上線）
- [x] 人物消歧 Quick Reply（buildPersonQuickReply · 已上線）
- [x] 上傳成功 Flex 單張預覽（hero 縮圖 + 在 Immich 查看按鈕 · PR #25）
- [x] 搜尋前確認 flow · 空結果 Quick Reply · 上傳進度/失敗 Flex（PR #32）
- [x] 「找照片」help Quick Reply 範例（PR #33）
- [x] 口語「小光和老婆在歐洲」· 關係詞過濾 · 歐洲 sceneQuery（PR #34）
- [x] Denmark / 丹麥 country metadata filter + `normalizeCountryForImmich`（`d272c21`）
- [x] 搜尋 parser P0：人物+情緒（哭）· `N年前` 相對日期 · 中文數字 · Disney 場景 + EXIF 過濾（2026-06-29）
- [x] 情緒篩選 MVP（哭/笑/開心）· 多輪「只要哭的」· 搜尋重測（小蕊哭／2年前／Disney）· OA icon 上傳（2026-06-29 · PR #39）
- [x] Rich Menu 中文標籤（找照片／上傳教學／使用說明）· `generate-rich-menu.py`（2026-06-30）
- [x] Rich Menu **帳戶設定**（四欄 · LIFF settings URI）
- [x] **video clip** 轉傳上傳 Immich（`631e855` · 2026-07-05）

---

## Repo 盤點（bottom-up · 2026-06-28）

| 層 | 路徑 | 現況 |
| ------ | ------ | ------ |
| **LINE Bot** | `src/line-bot/`（20 TS） | webhook · Qwen 搜尋 · fallback parser · imageSet 上傳 · Rich Menu · media proxy · 108 tests |
| **共用** | `src/shared/` | `immich-client` · date-range · upload-timestamps · OpenAPI types |
| **Photo Sync** | `scripts/photo-sync/`（~35 腳本） | sync · tier policy · reconcile · audit · LaunchAgent 範例 |
| **部署** | `deploy/helm` + `deploy/manifests` | line-bot Helm · server PVC/Deployment · 1Password items |
| **CI/CD** | `ci/tekton/` | PR L0 · BuildKit release · `make release` |
| **Cluster** | `immich` namespace | server v2.7.5 · postgres NVMe · LINE Bot **`631e855`** |

**程式 vs 文件落差**（已在本輪修正）：

- §2.7 監控仍寫「Grafana 待建」→ 實際 `immich-ops` 已上線
- L3 結案表寫「cluster 0%」→ Phase 4/5a 已 deploy
- Denmark fix 已 commit 未 release

---

## 下一階段路線圖（2026-07-05）

### P0 — 本週（驗收 + 維運）

| # | 項目 | 類型 | 說明 |
| --- | ------ | ------ | ------ |
| 1 | 影片 clip E2E | LINE | ✅ 使用者驗證 2026-07-15 |
| 2 | LIFF Passkey 實機 | LINE | Rich Menu 帳戶設定 → Safari Face ID → 返回已解鎖 |
| 3 | Qwen model 對齊 Instruct | Infra | ✅ `QWEN_MODEL` → `Qwen/Qwen2.5-7B-Instruct`（使用者驗證 2026-07-15） |
| 4 | Ops W2 rsync 收尾 | Ops | 63G→146G · checksum 抽樣 |
| 5 | Phase 5b Telegram smoke | Ops | 確認 3 條告警送達 |

### P1 — 產品體驗（2–4 週）

| # | 項目 | 類型 | 狀態 | 說明 |
| --- | ------ | ------ | ------ | ------ |
| 6 | 上傳管道 onboarding | UX | 📋 | welcome / Rich Menu 區分照片·原檔·影片；見 [UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md) |
| 7 | Web + LINE E2E 驗收 | UX | 📋 | 兩相簿時間軸 · 人物 alias · Smart Search 對照 |
| 8 | `REDIS_URL` for Passkey | Infra | ✅ | 使用者驗證 2026-07-15 |
| 9 | 國名對照自動化 | Feature | ✅ | CLDR 264 筆 + runtime alias |
| 10 | Carousel bubble 中繼資料 | UX | ✅ | 地點/人物副標 |

### P2 — 平台與資料品質（Q3）

| # | 項目 | 類型 | 狀態 | 說明 |
| --- | ------ | ------ | ------ | ------ |
| 11 | Immich 升級路徑 | Infra | 📋 Defer | v2.7.5 → 下一穩定版 |
| 12 | Similar images eval | Feature | 📋 Defer | Duplicate Detection + ground truth |
| 13 | album reconcile | Data | 📋 Defer | stale 27 / missing 123 |
| 14 | LINE Bot Grafana panel | Observability | 📋 Defer | `/metrics` + 7 天 SLO |
| 15 | thumbs → NVMe | Infra | 📋 Defer | 可選 |

### P3 — AI / 新場景（評估）

| # | 項目 | 類型 | 狀態 | 說明 |
| --- | ------ | ------ | ------ | ------ |
| 16 | 照片館對話助理 | AI Agent | 📋 Defer | 多輪記憶 + session store |
| 17 | Qwen vision 繁中描述 | AI | 📋 Defer | 上傳後場景描述 |
| 18 | LIFF 搜尋瀏覽 UI | UX | 📋 Defer | hub 已上線；完整瀏覽器內搜尋 |
| 19 | Photo Edit BFF | Feature | 📋 Defer | 去背/增強 |
| 20 | `make tier-next` wizard | Ops UX | 📋 Defer | tier 狀態建議下一步 |

---

### Immich Web（驗收導向）

- [x] 搜尋結果「查看更多」deep link 至 Immich（人物頁 or `/search?query=` · PR #25）
- [ ] P0：兩相簿時間軸 + EXIF 抽查
- [ ] 人物命名與 LINE alias 對齊驗收

### 維運者

- [x] `tier-policy-status.sh` 單頁狀態摘要
- [x] `photos_gui_ops.py` purge 多路徑（View 選單 · Erase Deleted Items）— 待實測
- [ ] 互動式 `make tier-next` 建議下一步（P2）

---

## 維運 / Tech Debt（P3 · **Defer**）

- [ ] fswatch debounce / ignore
- [ ] audit-local-duplicates cron
- [ ] Grafana Immich server dashboard
- [ ] rollback 實測文件（tier）

---

## 最近完成

| 項目 | 完成日 |
| ------ | -------- |
| LINE video clip 上傳（`631e855`） | 2026-07-05 |
| LIFF hub + Passkey（PR #42）· webhook 簽章修復 | 2026-07-04 |
| photo-sync allowlist orphan trash（PR #41） | 2026-07-02 |
| Rich Menu 中文標籤修復（CJK 字型 · generate-rich-menu.py） | 2026-06-30 |
| 聖彼得堡 CITY_LOOKUP + carousel 不誤標地點 + Rich Menu 可見橫幅 | 2026-06-29 |
| Carousel 副標 withExif + Rich Menu 圖片修復（117 tests） | 2026-06-29 |
| P1 國名 CLDR 自動化 + carousel 中繼資料 + 處理中 N/M（115 tests） | 2026-06-29 |
| Denmark country filter + normalizeCountryForImmich（`d272c21`） | 2026-06-28 |
| LINE 搜尋 UX PR #32–#34（確認 flow · help QR · 歐洲口語） | 2026-06-25 |
| Phase 4 postgres NVMe · Phase 5a PASS | 2026-06-24 |
| 專案結案 · purge 豁免 · Ops 狀態釐清 | 2026-06-22 |
| LINE 搜尋地點/anyDate/追問（PR #26–#28） | 2026-06-19 |
| iCloud 災難復原 + 相簿 638/638 + 日期 450 筆（PR #24） | 2026-06-18 |
| Phase 3.6 歸檔 + reconcile runbook 整理 | 2026-06-17 |
| Reconcile M3.1 + diagnose CLI（PR #21） | 2026-06-17 |
| infra-bootstrap Immich v2.7.5 K8s `588ee55` | 2026-06-13 |
| Phase 3 Photo Sync 全量 + 增量 | 2026-06-13 |
