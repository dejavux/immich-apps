# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-18  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**待辦優先序**: [BACKLOG.md](./BACKLOG.md)  
**UX / 產品檢視**: [UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
|------|------|
| Phase 2 LINE Bot MVP | ✅ 結案（搜尋 + Flex carousel 已上線） |
| Phase 3 Photo Sync | ✅ 結案（全量 + 增量） |
| Phase 3.5 tier policy | 🟡 **Phase B 收尾**（staging verify `0` · purge + delete-source 待完成） |
| Phase 3.6 delete reconcile | ✅ 歸檔（PR #19/#20/#21/#22）· M3.1 + diagnose 已 merge |
| Immich server | **v2.7.5** @ `https://immich.3q.fi` |
| LINE Bot 映像 | 以 `main` 最新 Tekton release 為準 |
| LaunchAgent | ✅ running |

**Reconcile 實測（2026-06-18 01:15）**：dry-run `orphan_candidates: 20` · `orphan_ready_for_apply: 20`（purge 後待 apply）  
**Tier verify（2026-06-18）**：`staging_items: 0` · `verified: 0` — import 輪次已清空 staging

---

## 🎯 Sprint 主軌

### 短期（本週）

| 優先 | 任務 | 說明 |
|------|------|------|
| **P1** | Phase B 收尾 | delete-source · `photos_gui_ops.py purge` · immich-sync dry-run `0 new` |
| **P1** | Reconcile apply | purge 後 `--apply`（目前 dry-run **20** orphan ready） |
| **P0** | 人工 E2E | Web 兩相簿時間軸 + LINE 場景/人名搜尋（見 [UX_PRODUCT_REVIEW](./UX_PRODUCT_REVIEW.md) checklist） |
| **P2** | UX 拋光（下週） | LINE Rich Menu · 人物消歧 Quick Reply · `tier-policy-status` |

Phase 3.5 完成後：**icloud-primary** 只剩 cutoff 後新照 · **local-archive** 承載歷史 · **Immich union** 不變。

### 中期（下週起）

| 優先 | 任務 | 價值 |
|------|------|------|
| **P2** | `immich-reconcile-diagnose.sh` | 輸入 asset id → mac_ref / Photos 狀態 |
| **P2** | Similar images eval | Duplicate Detection 對 ~1506 hash-miss |
| **P2** | Phase 5 B2 備份 | tier 結案後 |
| **待辦** | tier LaunchAgent / cron | 全量 tier 結案後 |

---

### P1 — Phase B bulk（收尾）

→ [30_PHASE_B_ICLOUD_DOWNLOAD.md](./photo-sync/tier-policy/30_PHASE_B_ICLOUD_DOWNLOAD.md)

**已完成**：download **4280/4281** · export **75 batch** · 第一輪 1615/1615

**進行中（2026-06-18）**：

- bulk import 多輪已完成 · `tier-verify-staging.json` → `staging_items: 0`
- 待完成：delete-source 本輪 · Recently Deleted purge（`photos_gui_ops.py` GUI 路徑已強化）

```bash
export PATH="$HOME/.local/bin:$PATH"

./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365
./scripts/photo-sync/tier-policy-verify-staging.sh
# 失敗 → tier-policy-retry-failed-import.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
# Photos：TierPolicy-Delete → ⌘A → ⌘Delete → 最近刪除 → 全部删除
```

### P1 — Reconcile（purge 後）

→ [delete-reconcile/20_OPERATIONS.md](./photo-sync/delete-reconcile/20_OPERATIONS.md)

```bash
eval "$(./scripts/dev/load-env-from-op.sh)"
./scripts/photo-sync/immich-reconcile.sh                    # dry-run
./scripts/photo-sync/immich-reconcile.sh --apply --confirm  # 需 delete_policy: conservative
```

**注意**：「最近刪除」未 purge → icloud `mac_ref=1` → **不會**刪 Immich。勿用 `IMG_XXXX` 搜尋對照（檔名會重用）。

### P0 — 人工驗收

- [x] 後端 smoke：`smoke-photo-search-e2e.sh`（person rayna · scene beach ocean · 2026-06-18）
- [x] immich-sync dry-run：icloud **0 new** · local **9 new**（2026-06-18）
- [x] reconcile dry-run：`orphan_candidates: 0`（2026-06-18）
- [ ] Web UI：兩相簿 + 時間軸 EXIF
- [ ] LINE：「找在海邊的照片」「幫我找小蕊一歲半的照片」（部署 Rich Menu 後驗）

### P2 — Similar images 驗證（bulk 空檔或下週）

→ [SIMILAR_IMAGES_EVAL runbook](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)

---

## 驗證指令

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach sunset" --person rayna
tail -f ~/Library/Logs/immich-photo-sync/sync.log
./scripts/photo-sync/immich-reconcile.sh
jq .summary ~/Library/Logs/immich-photo-sync/reconcile/reconcile-*.json | tail -20
```

---

## 🔗 相關

- [UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md)
- [BACKLOG.md](./BACKLOG.md)
- [photo-sync/delete-reconcile/20_OPERATIONS.md](./photo-sync/delete-reconcile/20_OPERATIONS.md)
- [photo-sync/tier-policy/](./photo-sync/tier-policy/)
- [20_guides/photo-sync/](../20_guides/photo-sync/)
- [scripts/photo-sync/README.md](../../scripts/photo-sync/README.md)
