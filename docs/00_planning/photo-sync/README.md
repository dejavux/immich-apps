# Photo Sync

**狀態**: 🚧 Phase 3 收尾（全量 ✅ · 增量實測 ✅）  
**SSOT**: [PROGRESS_TRACKING §Phase 3](../PROGRESS_TRACKING.md)  
**結案歸檔**: [phase3-photo-sync-bulk](../../60_completed/phase3-photo-sync-bulk/)

## 文件

| 文件 | 用途 |
|------|------|
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | 需求、CLI 設定、LaunchAgent |
| [runbooks/STORAGE_AUDIT.md](./runbooks/STORAGE_AUDIT.md) | 磁碟與 duplicate 分析 |
| [runbooks/EXTERNAL_LIBRARY_CLEANUP.md](./runbooks/EXTERNAL_LIBRARY_CLEANUP.md) | External library 清理 |

## 腳本

`scripts/photo-sync/` — `immich-sync.sh`、`install-launchagent.sh`

## 驗收

- [x] icloud-primary 3512/3512 · local-archive 5023/5023
- [x] dry-run 0 new
- [x] LaunchAgent 增量已驗
- [ ] Phase 3 正式結案簽核
