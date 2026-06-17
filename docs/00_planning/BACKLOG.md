# Backlog — 待辦與優先順序

**SSOT 進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)  
**最後更新**: 2026-06-17（整體 review · P4/P5/V1.1 明確 defer）

---

## 文件角色

| 文件 | 用途 |
|------|------|
| **PROGRESS_TRACKING** | Phase 級 checklist SSOT |
| **HOW_TO_PROCEED** | 本週 Sprint 該做什麼 |
| **BACKLOG（本檔）** | 細項、tech debt、未排進 Sprint 的候選 |

**已結案規格** → [60_completed/](../60_completed/) · **維運 runbook** → [20_guides/](../20_guides/)

---

## 當前 Sprint（2026-06-17）

| 軌道 | 任務 | 狀態 | 負責 |
|------|------|------|------|
| **P0** | Web UI + LINE 人工 E2E | 🟡 進行中 | 人工 |
| **P1** | Phase 3.5 Phase B bulk 收尾 | 🟡 import/verify/delete | 本機 + Photos |
| **P1** | Reconcile M3.1 PR + purge 後 reconcile | 🟡 patch 待 PR | 本機 |
| **P2** | Similar images 內建驗證 | 📋 待跑 runbook | 本機 |

---

## 優先順序總覽

```text
P0  並行     人工 E2E 驗收
P1  本週     Phase B bulk 收尾 · reconcile M3.1 PR · Recently Deleted purge
P2  空檔     reconcile diagnose 工具 · Similar images eval
P2  Q3       Phase 5 B2 備份 · Phase 4 SSD · LINE V1.1 Grafana
P3  有空再做 Photo Edit AI · trashed=1 即 absent 決策
```

---

## Phase 3.6 — delete reconcile

- [x] conservative orphan cleanup · album scope reconcile（PR #19）
- [x] API upload + bulk date fix · PR #19 `39f8a66`
- [x] 週日 LaunchAgent dry-run reconcile
- [x] M3 fswatch watch（PR #20 `d803a19`）
- [x] 本機 apply **+17** orphan（2026-06-17 · 擴大 scope）
- [ ] **M3.1 PR**：`photos_db_libraries` · `include_mac_uploads` · `grace_days: 0`
- [x] `immich-reconcile-diagnose.sh`（asset id → mac_ref 狀態）
- [ ] purge Recently Deleted 後再 reconcile（6/16 四張等待中）

**維運**：tier 搬移不刪 Immich；purge 前 reconcile skip；見 [20_OPERATIONS.md](./photo-sync/delete-reconcile/20_OPERATIONS.md)

---

## Phase 3.5 — tier policy（P1 · Phase B）

**規格**: [photo-sync/tier-policy/](./photo-sync/tier-policy/)

### 已完成

- [x] M1 PoC + spot-check（577 local → **100%** Immich SHA1 dup）
- [x] M2 跨 library 研究 → [20_CROSS_LIBRARY_MOVE_RESEARCH.md](./photo-sync/tier-policy/20_CROSS_LIBRARY_MOVE_RESEARCH.md)
- [x] M3 bulk export/import **1615/1615** verify（2026-06-14）
- [x] 人工刪 source → Recently Deleted
- [x] runbook [TIER_POLICY.md](../20_guides/photo-sync/runbooks/TIER_POLICY.md)
- [x] `tier-policy-monitor-ismissing.sh` · `tier-policy-download-missing.sh`（Phase B）

### 進行中（Phase B）

- [x] `tier-policy-download-missing.sh` 全量 eligible（4280/4281 · 2026-06-15）
- [x] bulk export **75 batch**（2026-06-15）
- [ ] bulk import 收尾（含 fail retry · verify-staging）
- [ ] `tier-policy-delete-source` 本輪完成
- [ ] Recently Deleted **永久清除**（第一輪 1615 + 本輪合計）
- [ ] immich-sync dry-run **0 new**

### 待辦

- [ ] rollback 實測文件
- [ ] LaunchAgent / cron 排程（tier 全量完成後）

---

## Similar images（P2 · Optional）

**規格**: [photo-sync/similar-images/10_REQUIREMENTS.md](./photo-sync/similar-images/10_REQUIREMENTS.md)  
**Runbook**: [SIMILAR_IMAGES_EVAL.md](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)

- [ ] 啟用 Duplicate Detection · 等 ML job 完成
- [ ] Ground truth 20 組 + recall/precision
- [ ] 決策：內建足夠 vs 建 `similar-images-audit.py`

**背景**：`audit-local-duplicates` 顯示 ~1506 hash-miss（Photos 重編碼）；需 **visual similarity** 非 checksum。

---

## Phase 5 — Backup（P2 · **Defer Q3**）

> 📋 Phase 3.5 結案後再開始

- [ ] pg_dump CronJob（K8s · namespace `immich`）
- [ ] B2 bucket + 1Password 憑證
- [ ] 還原 runbook（年度演練）

---

## Phase 4 — Storage 優化（P2 · **Defer Q3**）

> 📋 需停機計畫；Immich 資料已在 HDD，非緊急

- [ ] PostgreSQL → SSD 遷移計畫 + downtime
- [ ] `/data/upload` 遷移策略

---

## LINE Bot V1.1（P2/P3 · **Defer**）

> 📋 CLIP Smart Search 已可用；Grafana metrics 端點就緒，dashboard 可隨時接

- [ ] Qwen vision 繁中描述（P3）
- [ ] Grafana dashboard + 7 天 SLO（P2）

---

## Optional — Photo Edit + AI（P3 · **Defer**）

→ [photo-edit/10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md)

---

## 維運 / Tech Debt（P3 · **Defer**）

- [ ] fswatch debounce / ignore
- [ ] audit-local-duplicates cron
- [ ] Grafana Immich server dashboard
- [ ] rollback 實測文件（tier）

---

## 最近完成

| 項目 | 完成日 |
|------|--------|
| Phase 3.5 M3 第一輪 1615 export/import | 2026-06-14 |
| tier-policy bulk 腳本 PR #18 | 2026-06-14 |
| infra-bootstrap Immich v2.7.5 K8s `588ee55` | 2026-06-13 |
| Phase 3 Photo Sync 全量 + 增量 | 2026-06-13 |
| docs 目錄重整 PR #14 | 2026-06-13 |
