# Backlog — 待辦與優先順序

**SSOT 進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)  
**最後更新**: 2026-06-15

---

## 文件角色

| 文件 | 用途 |
|------|------|
| **PROGRESS_TRACKING** | Phase 級 checklist SSOT |
| **HOW_TO_PROCEED** | 本週 Sprint 該做什麼 |
| **BACKLOG（本檔）** | 細項、tech debt、未排進 Sprint 的候選 |

**已結案規格** → [60_completed/](../60_completed/) · **維運 runbook** → [20_guides/](../20_guides/)

---

## 當前 Sprint（2026-06-15）

| 軌道 | 任務 | 狀態 | 負責 |
|------|------|------|------|
| **P0** | Web UI + LINE 人工 E2E | 🟡 進行中 | 人工 |
| **P1** | Phase 3.5 Phase B bulk（~2665 張） | 🟢 **可開跑** | 本機 + Photos |
| **P2** | Similar images 內建驗證 | 📋 待跑 runbook | 本機 |
| **—** | infra-bootstrap Immich v2.7.5 K8s | ✅ `588ee55` 已 merge | — |

---

## 優先順序總覽

```text
P0  並行     人工 E2E 驗收
P1  本週     Phase 3.5 Phase B bulk export/import/delete（download gate ✅）
P2  空檔     Similar images eval（Duplicate Detection vs 自建工具）
P2  Q3       Phase 5 B2 備份 · Phase 4 SSD · LINE V1.1 Grafana
P3  有空再做 Photo Edit AI · fswatch debounce
```

---

## Phase 3.6 — delete reconcile（✅ 2026-06-15）

- [x] conservative orphan cleanup · album scope reconcile
- [x] API upload + bulk date fix · PR #19 `39f8a66`
- [x] 週日 LaunchAgent dry-run reconcile

**維運**：tier 搬移不刪 Immich；apply 僅 dry-run 確認後手動。

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
- [ ] `eligible_ismissing` **1 → 0**（最後 1 張；bulk 可並行或略等）
- [ ] Phase B bulk export/import/delete（~**2665** 新張 = 4280 − 1615）
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

## Phase 5 — Backup（P2）

- [ ] pg_dump CronJob（K8s · namespace `immich`）
- [ ] B2 bucket + 1Password 憑證
- [ ] 還原 runbook（年度演練）

---

## Phase 4 — Storage 優化（P2）

- [ ] PostgreSQL → SSD 遷移計畫 + downtime
- [ ] `/data/upload` 遷移策略

---

## LINE Bot V1.1（P2）

- [ ] Qwen vision 繁中描述
- [ ] Grafana dashboard + 7 天 SLO

---

## Optional — Photo Edit + AI（P3）

→ [photo-edit/10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md)

---

## 維運 / Tech Debt（P3）

- [ ] fswatch debounce / ignore
- [ ] audit-local-duplicates cron
- [ ] Grafana Immich server dashboard

---

## 最近完成

| 項目 | 完成日 |
|------|--------|
| Phase 3.5 M3 第一輪 1615 export/import | 2026-06-14 |
| tier-policy bulk 腳本 PR #18 | 2026-06-14 |
| infra-bootstrap Immich v2.7.5 K8s `588ee55` | 2026-06-13 |
| Phase 3 Photo Sync 全量 + 增量 | 2026-06-13 |
| docs 目錄重整 PR #14 | 2026-06-13 |
