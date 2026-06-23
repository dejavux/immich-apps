# Photo Sync

**Phase 3**: ✅ 結案（2026-06-13）→ [60_completed/phase3-photo-sync-bulk/](../../60_completed/phase3-photo-sync-bulk/)  
**Phase 3.5**: 🟡 Phase B bulk 收尾（download ✅ · export ✅ · import/verify/delete 進行中）→ [tier-policy/](./tier-policy/)  
**Phase 3.6**: ✅ 歸檔 → [60_completed/phase3-6-delete-reconcile/](../../60_completed/phase3-6-delete-reconcile/) · 🟡 M3.1 待 PR · runbook → [RECONCILE_OPERATIONS.md](../../20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md)

## 進行中

| 文件 | 用途 |
| ------ | ------ |
| [tier-policy/10_REQUIREMENTS.md](./tier-policy/10_REQUIREMENTS.md) | iCloud → Local 自動分層 |
| [tier-policy/30_PHASE_B_ICLOUD_DOWNLOAD.md](./tier-policy/30_PHASE_B_ICLOUD_DOWNLOAD.md) | Phase B 下載策略 |
| [similar-images/10_REQUIREMENTS.md](./similar-images/10_REQUIREMENTS.md) | Optional：視覺相似圖驗證 |

## 維運

| 文件 | 用途 |
| ------ | ------ |
| [20_guides/photo-sync/runbooks/](../../20_guides/photo-sync/runbooks/) | STORAGE_AUDIT · TIER_POLICY · RECONCILE_OPERATIONS |
| [scripts/photo-sync/](../../../../scripts/photo-sync/) | immich-sync、LaunchAgent |

**SSOT**: [PROGRESS_TRACKING §Phase 3.5](../PROGRESS_TRACKING.md)
