# Phase 3.6 — Delete Reconcile

**歸檔日期**: 2026-06-17  
**後續**: M3.1 PR 待 merge → `photos_db_libraries` · `include_mac_uploads` · `grace_days: 0`  
**維運 runbook**: [20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md](../../20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md)

---

## 交付摘要

Conservative Immich orphan cleanup — Mac 雙 library 都無該 SHA1 才 trash。

| 指標 | 結果 |
|------|------|
| 累計 orphan trashed | **501**（484 + 17） |
| 最終 dry-run | `orphan_candidates: 0` · `skipped_still_on_mac: 5277` |
| LaunchAgent 週日 dry-run | ✅ 安裝 |
| M3 fswatch watch | ✅ PR #20 |

## 文件索引

| 文件 | 說明 |
|------|------|
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | **Phase 3.6 完整規格（凍結）** |
| [RECONCILE_OPERATIONS.md](../../20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md) | purge 流程 · 實測紀錄 · 維運 runbook |

## 未完成（→ BACKLOG）

- M3.1 PR：`photos_db_libraries` · `include_mac_uploads` · `grace_days: 0`（本機已驗）
- `immich-reconcile-diagnose.sh`（script 已實作，docs 補 runbook）
