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
| Phase 3.5 tier policy | 🟡 **Phase B**（1615 已 import · 4119 ismissing 下載中） |
| Immich server | **v2.7.5** @ `https://immich.3q.fi` |
| infra-bootstrap K8s | ✅ `588ee55`（v2.7.5 pin · Recreate · GPU toleration · Caddy 長 timeout） |
| LINE Bot 映像 | `immich-line-bot:2217530` |
| LaunchAgent | ✅ running |

---

## 🎯 Sprint 主軌

```text
P0  人工 E2E（Web UI + LINE 場景搜尋）— 與 Phase B 並行
P1  Phase 3.5 Phase B：ismissing 下載 → re-export/import → immich-sync 0 new
P2  Similar images 驗證（Immich 內建 Duplicate Detection 是否夠用）
```

### P0 — 人工驗收

- [ ] Web UI：兩相簿 + 時間軸 EXIF（v2.7.5）
- [ ] LINE：「找在海邊的照片」「幫我找小蕊一歲半的照片」
- [ ] 可選：`npm i -g @immich/cli@2.7.5`

### P1 — Phase 3.5 Phase B（主軌）

→ [30_PHASE_B_ICLOUD_DOWNLOAD.md](./photo-sync/tier-policy/30_PHASE_B_ICLOUD_DOWNLOAD.md) · [TIER_POLICY runbook](../20_guides/photo-sync/runbooks/TIER_POLICY.md)

**已完成（M3 第一輪）**：export/import **1615/1615** verify · 人工刪 source → Recently Deleted

**進行中**：

```bash
export PATH="$HOME/.local/bin:$PATH"

# 監控 ismissing 是否下降（Phase B 長跑）
WATCH=1 INTERVAL=300 ./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365
# log: ~/Library/Logs/immich-photo-sync/tier/ismissing-monitor.log

# Photos：依年份往回瀏覽 cutoff 前舊照，觸發原尺寸下載
```

**Phase B 完成後**：

```bash
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-days 365
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
./scripts/photo-sync/immich-sync.sh --dry-run   # 預期 0 new
```

**iCloud 配額**：Recently Deleted → **全部删除**（見 [tier-policy/README](./photo-sync/tier-policy/README.md)）

### P2 — Similar images 驗證（Optional · 建議 Phase B 空檔執行）

→ [SIMILAR_IMAGES_EVAL runbook](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)

Immich 有 **Duplicate Detection**（CLIP 視覺相似），但能否涵蓋 Photos **重編碼 hash 變更**（~1506 檔）需實測：

1. Admin 啟用 Duplicate Detection · 等 job 跑完
2. 建 20 組 ground truth（連拍 / 重編碼 / 跨 library）
3. 對照 `GET /api/duplicates` → recall ≥ 80% 則用內建，否則建 `similar-images-audit.py`

→ [similar-images/10_REQUIREMENTS.md](./photo-sync/similar-images/10_REQUIREMENTS.md)

### 之後

Phase 5 備份 → Phase 4 SSD（見 [BACKLOG.md](./BACKLOG.md)）

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
