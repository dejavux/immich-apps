# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-15  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**待辦優先序**: [BACKLOG.md](./BACKLOG.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
|------|------|
| Phase 2 LINE Bot MVP | ✅ 結案 |
| Phase 3 Photo Sync | ✅ 結案（全量 + 增量） |
| Phase 3.5 tier policy | 🟢 **Download gate 達標**（`eligible_ismissing` **1** · export_ready **4280**）→ **bulk 可開跑** |
| Phase 3.6 delete reconcile | ✅ M1/M2 · API upload 預設 · PR #19 |
| Immich server | **v2.7.5** @ `https://immich.3q.fi` |
| LINE Bot 映像 | `immich-line-bot:39f8a66` |
| LaunchAgent | ✅ running |

---

## 🎯 Sprint 主軌

### 短期（本週）

| 優先 | 任務 | 說明 |
|------|------|------|
| **P1** | Phase B bulk 全流程 | **現在可開跑**（不必等 `ismissing` 最後 1 張）；export 可隔夜 |
| **P0** | 人工 E2E | Web UI 時間軸 + LINE 場景搜尋；**bulk 跑著時並行** |
| **收尾** | Recently Deleted 永久清除 | bulk + verify **都 OK** 後；兩輪 delete 一次清 |

Phase 3.5 完成後：**icloud-primary** 只剩 cutoff 後新照 · **local-archive** 承載歷史 · **Immich union** 不變。

### 中期（下週起）

| 優先 | 任務 | 價值 |
|------|------|------|
| **P2** | Similar images eval | bulk **空檔或下週**；測 Duplicate Detection 對 ~1506 hash-miss |
| **P2** | Phase 5 B2 備份 | **tier 結案後**排進 Sprint |
| **待辦** | tier LaunchAgent / cron | **全量 tier 結案後**才裝；日常新照 cutoff 後自動留 icloud |

---

### P1 — Phase B bulk（主軌 · 可立即開跑）

→ [30_PHASE_B_ICLOUD_DOWNLOAD.md](./photo-sync/tier-policy/30_PHASE_B_ICLOUD_DOWNLOAD.md)

**前置已完成**：M3 第一輪 **1615/1615** · Phase 3.6 API upload + reconcile（PR #19）· download **4280/4281** ready

**Gate 說明**：`eligible_ismissing: 1` 可視為達標——`tier-policy-bulk-export.sh` 只處理 `local_path` 項目，最後 1 張 ismissing 會被略過。

**執行中（2026-06-15）**：

- bulk export ✅ **75 batch** · staging **78GB** · log `bulk-export-phase-b.log`
- bulk import 🟡 進行中 · log `bulk-import-phase-b.log` · immich-watch 已暫停

```bash
export PATH="$HOME/.local/bin:$PATH"

# Gate（應見 eligible_ismissing: 0 或 1）
./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365

# 可選：bulk 期間暫停 immich-watch，避免 sync storm
# launchctl unload ~/Library/LaunchAgents/com.immich.photo-sync.watch.plist

./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-days 365
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh
# 失敗 → tier-policy-retry-failed-import.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
# Photos：TierPolicy-Delete → ⌘A → ⌘Delete

# launchctl load ~/Library/LaunchAgents/com.immich.photo-sync.watch.plist

./scripts/photo-sync/immich-sync.sh --dry-run   # 預期 0 new；upload_mode: api
```

**iCloud 配額**：兩輪 delete 後，Recently Deleted → **全部删除**（見 [tier-policy/README](./photo-sync/tier-policy/README.md)）

### P0 — 人工驗收

- [ ] Web UI：兩相簿 + 時間軸 EXIF（v2.7.5）
- [ ] LINE：「找在海邊的照片」「幫我找小蕊一歲半的照片」
- [x] 後端 smoke：`smoke-photo-search-e2e.sh`（person rayna · scene beach ocean · 2026-06-15）
- [ ] 可選：`npm i -g @immich/cli@2.7.5`

### P2 — Similar images 驗證（中期 · 建議 bulk 空檔或下週）

→ [SIMILAR_IMAGES_EVAL runbook](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)

Immich 有 **Duplicate Detection**（CLIP 視覺相似），但能否涵蓋 Photos **重編碼 hash 變更**（~1506 檔）需實測：

1. Admin 啟用 Duplicate Detection · 等 job 跑完
2. 建 20 組 ground truth（連拍 / 重編碼 / 跨 library）
3. 對照 `GET /api/duplicates` → recall ≥ 80% 則用內建，否則建 `similar-images-audit.py`

→ [similar-images/10_REQUIREMENTS.md](./photo-sync/similar-images/10_REQUIREMENTS.md)

### 之後（中期）

| 優先 | 任務 | 連結 |
|------|------|------|
| P2 | Phase 5 B2 備份 | [BACKLOG §Phase 5](./BACKLOG.md) |
| P2 | Phase 4 SSD | [BACKLOG §Phase 4](./BACKLOG.md) |
| 待辦 | tier LaunchAgent / cron | 全量 tier 結案後 |

---

## 驗證指令

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach sunset" --person rayna
tail -f ~/Library/Logs/immich-photo-sync/sync.log
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/duplicates | jq length
```

---

## 🔗 相關

- [BACKLOG.md](./BACKLOG.md)
- [photo-sync/tier-policy/](./photo-sync/tier-policy/)
- [20_guides/photo-sync/](../20_guides/photo-sync/)
- [20_guides/infra/upgrades/IMMICH_v2.7.5.md](../20_guides/infra/upgrades/IMMICH_v2.7.5.md)
- [scripts/photo-sync/README.md](../../scripts/photo-sync/README.md)
