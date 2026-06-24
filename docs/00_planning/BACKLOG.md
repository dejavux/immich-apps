# Backlog — 待辦與優先順序

**SSOT 進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)  
**最後更新**: 2026-06-24（5a PASS · Grafana RBAC 修復 · Phase 4 批准）  
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

## 當前 Sprint（2026-06-22 · 增強專案已結案）

| 軌道 | 任務 | 狀態 | 備註 |
| ------ | ------ | ------ | ------ |
| — | **Immich Enhancement** | ✅ 結案 | Phase 0–3.6 + 3.5（purge 豁免） |
| **Ops W1** | Phase 5a NFS + pg_dump | ✅ **PASS** | pg 2/2 · NFS Job ✅ · B2 已刪 |
| **Ops** | Phase 1 probes/Redis | ✅ **已 deploy** | probes + NetworkPolicy · Redis item 待建 |
| **Ops W3** | Phase 5b monitoring | 🟡 **~95%** | RBAC 修復 · immich-ops 有資料 · smoke 已重送 |
| **P2** | album reconcile | 📋 可選 | stale 27 / missing 123 |
| **Ops W2** | Mac library → delta NFS | 📋 **Q3 延後** | prep 可平行 · 見下方建議 |
| **Ops W4** | Phase 4 SSD 遷移 | ✅ **COMPLETE** | 2026-06-24 · postgres → `/nvme/immich-postgres` |

---

## 優先順序總覽

```text
✅  結案     Immich Enhancement（Phase 0–3.6 + 3.5 豁免）
Ops W1       Phase 5a ✅ PASS（pg 2/2 · NFS ✅）
Ops W2       Mac .photoslibrary → delta NFS（Q3 · prep 可平行 · 執行延後）
Ops W3       Phase 5b 告警 + immich-ops Grafana（RBAC 修復 · ~95%）
Ops W4       Phase 4 SSD ✅ COMPLETE 2026-06-24
Observability  fuqi 儀表板併入 monitoring 或獨立子網域 → OBSERVABILITY_ROADMAP.md
P2  可選     album reconcile · Similar images · LINE V1.1 vision
```

---

## Phase 5a+ — Mac Photos Library → delta NFS（Q3 · 建議延後）

**優先級**: P1（5a PASS ✅）  
**目標視窗**: Q3 2026（**執行**；prep 可立即開始）  
**前置**: Phase 5a **PASS**（2026-06-24）· Phase 4 完成後再跑首輪全量 rsync  
**Runbook**: [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)

**建議（2026-06-24）**：**不要**現在直接開跑每週 rsync；與 Phase 4 停機窗錯開。可平行做 delta export 路徑、配額、`rsync --dry-run`、LaunchAgent plist 草稿。

- [ ] delta NFS export 路徑與配額（`delta.3q.fi`）
- [ ] `local-archive` `originals/` rsync LaunchAgent（週次，錯開週日 04:00 data-backup）
- [ ] `icloud-primary` `originals/` rsync（同上）
- [ ] 還原演練：抽樣檔案 checksum 對照
- [ ] 文件化於 PROGRESS_TRACKING Phase 5a+

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

> **釐清**：2026-06-22 [agent-prompts/](./agent-prompts/) 派工文件已 commit；**2026-06-22** manifest deploy 至 cluster（probes、NetworkPolicy、CronJob、PrometheusRule）。5a gate 仍 PARTIAL（B2 + pg 2/2 排程）。

### Phase 1 — 基礎設施強化（prompt ✅ · 執行 ✅ deploy）

→ [agent-prompts/phase-1-hardening.md](./agent-prompts/phase-1-hardening.md)

- [x] 基線：Immich K8s · GPU ML · 1Password · MetalLB · Caddy
- [x] probes（server/postgres/redis/ml）— 2026-06-22 deploy
- [x] NetworkPolicy（`immich` namespace）
- [x] `immich-configmap.yaml` 文檔化（legacy nginx，未掛載）
- [ ] Redis/Valkey 密碼（`Immich-Redis` 1Password item 待建）

### Phase 5 — Backup（prompt ✅ · 執行 🟡 PARTIAL）

→ [agent-prompts/phase-5a-backup.md](./agent-prompts/phase-5a-backup.md) · [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

- [x] v2.7.5 升級時 **手動** pg_dump 一次（非自動化）
- [x] pg_dump CronJob（每日）+ 本機 PVC 備份驗證（93MB gzip）
- [x] 還原 runbook + 演練（`asset` count 13759 = prod）
- [x] pg_dump CronJob + NFS rsync CronJob（PR #174）
- [x] `Immich-B2-Backup` 已刪（改 NFS）
- [ ] 連續 2 次**排程** pg Success（**1/2**；下次 06-24 03:00）
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
- [ ] deep link 驗證 `https://grafana.3q.fi/d/immich-ops`（✅ PromQL 有資料 2026-06-24）
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

## LINE Bot V1.1（P2/P3 · **Defer**）

> 📋 CLIP Smart Search 已可用；Grafana metrics 端點就緒，dashboard 可隨時接

- [ ] Qwen vision 繁中描述（P3）
- [ ] Grafana dashboard + 7 天 SLO（P2）

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
- [x] 搜尋結果「查看更多」deep link 至 Immich（人物頁 or `/search?query=` · PR #25）

### Immich Web（驗收導向）

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
| 專案結案 · purge 豁免 · Ops 狀態釐清 | 2026-06-22 |
| LINE 搜尋地點/anyDate/追問（PR #26–#28） | 2026-06-19 |
| iCloud 災難復原 + 相簿 638/638 + 日期 450 筆（PR #24） | 2026-06-18 |
| Phase 3.6 歸檔 + reconcile runbook 整理 | 2026-06-17 |
| Reconcile M3.1 + diagnose CLI（PR #21） | 2026-06-17 |
| infra-bootstrap Immich v2.7.5 K8s `588ee55` | 2026-06-13 |
| Phase 3 Photo Sync 全量 + 增量 | 2026-06-13 |
