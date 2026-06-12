# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-12  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)

---

## 📍 當前狀態（2026-06-12 下午）

| 項目 | 狀態 |
|------|------|
| Phase 3 local-archive | ✅ **5023/5023**（icloud dry-run 0 new；local 續傳進行中見 §3.3） |
| Phase 3 icloud-primary | ✅ **3512/3512**（0 new） |
| Immich `/data/upload` | **~115 GB** |
| LaunchAgent watch | ✅ running · 增量已驗 |
| external-library | ✅ ~86 GB 已清 · DB library 0 rows |
| **Immich server** | **v2.7.5** ✅（2026-06-12 升級完成） |
| OpenAPI types | **v2.7.5** · `npm test` 48/48 |
| LINE Bot | `immich-line-bot:b2522c2` · smoke API 全綠 |
| pg 備份 | `infra-bootstrap/immich-pg-backup-20260612.sql`（149 MB） |

**整體進度**: ~**90%**（Phase 2: **95%** · Phase 3: **96%**）

---

## 🎯 現在該做什麼

### 1. local-archive 續傳（Phase 3 收尾）

增量測試曾觸發 **1894 new**（Photos 重編碼 hash 變更）。續傳至 dry-run `0 new`：

```bash
./scripts/photo-sync/immich-sync.sh --library local-archive
./scripts/photo-sync/immich-sync.sh --library local-archive --dry-run   # 目標 0 new
python3 scripts/photo-sync/audit-local-duplicates.py   # 可選：本機 hash 稽核
```

### 2. 升級後手動驗收（Phase D 剩餘）

- [ ] Web UI：兩相簿 + 時間軸 EXIF 抽查
- [ ] LINE：「找在海邊的照片」「幫我找小蕊一歲半的照片」
- [ ] 可選：`npm i -g @immich/cli@2.7.5` 對齊 CLI

### 3. 下一階段

| Phase | 內容 |
|-------|------|
| **3.5** | `tier_policy` + osxphotos（iCloud→Local 自動搬移） |
| **4** | PostgreSQL → SSD |
| **5** | B2 CronJob + 還原測試 |
| **V1.1** | Qwen **vision** 繁中描述 |

---

## 驗證指令

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
# {"major":2,"minor":7,"patch":5}

./scripts/photo-sync/immich-sync.sh --library icloud-primary --dry-run   # 0 new / 3512 dup
bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach sunset" --person rayna
```

**v2.7.5 升級紀錄** → [IMMICH_UPGRADE_v2.7.5.md](./IMMICH_UPGRADE_v2.7.5.md)

---

## 🔗 相關

- [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)
- [PHASE3_STORAGE_AUDIT.md](./PHASE3_STORAGE_AUDIT.md)
- [PHASE3_PHOTO_SYNC.md](./PHASE3_PHOTO_SYNC.md)
- [scripts/photo-sync/README.md](../scripts/photo-sync/README.md)
