# Phase 3 Photo Sync — 結案摘要

**日期**: 2026-06-12  
**詳細 checklist**: [00_planning/PROGRESS_TRACKING.md §Phase 3](../../00_planning/PROGRESS_TRACKING.md)

---

## 全量同步

| Library | 檔數 | dry-run |
|---------|------|---------|
| icloud-primary | 3512 | 0 new / 2789 dup |
| local-archive | 5023 | 0 new / 5023 dup |

CLI 依 content hash 跳過已上傳檔；中斷後續傳不會重複寫入 blob。

---

## 增量同步

- LaunchAgent：`~/Library/LaunchAgents/com.immich.photo-sync.watch.plist`
- 設定：`~/.config/immich-apps/photo-sync.config.yaml`
- 日誌：`~/Library/Logs/immich-photo-sync/{watch,sync}.log`
- 2026-06-12 自動增量：icloud +1 / +2 / +6 已驗

---

## 儲存清理

- External library「Migrated photos」已刪除
- `GET /api/libraries` → `[]`
- 釋放 ~86 GB（詳見 STORAGE_AUDIT runbook）

---

## 已知後續

- Phase 3.5 osxphotos / tier_policy → [BACKLOG](../../00_planning/BACKLOG.md)
- fswatch debounce 優化（sync storm 10:03–10:15）
