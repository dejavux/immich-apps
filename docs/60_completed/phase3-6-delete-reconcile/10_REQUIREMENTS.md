# Phase 3.6 — Delete Reconcile

**狀態**: ✅ M1/M2/M3 結案（歸檔 2026-06-17）· M3.1 待 PR → [BACKLOG](../../00_planning/BACKLOG.md)  
**前置**: Phase 3 upload-only sync · tier policy union 備份策略  
**最後更新**: 2026-06-17（凍結）

---

## 問題陳述

| 現況 | 痛點 |
|------|------|
| `immich-sync.sh` 只做 **upload** | Mac 刪照片 → Immich **不刪**（刻意設計） |
| Tier policy 從 icloud 刪 source | local-archive 仍保留 → Immich 應 **保留** |
| 使用者從 **兩邊 library 都刪** | Immich 可能留下 **orphan asset** |
| API upload 用 UUID 檔名、未必掛相簿 | 僅 album scope 會漏 reconcile |

**目標**：在 **不破壞 union 備份** 前提下，可選擇性清理 Immich orphan（conservative 模式）。

---

## 非目標

- ❌ `mirror_icloud`：icloud 刪即刪 Immich（與 tier union 衝突）
- ❌ 不 reconcile 無 Mac 來源的 asset（例如純 LINE import）
- ❌ 以 `IMG_XXXX` 檔名搜尋作為唯一對照（Apple 會重用檔名）

---

## 策略：`delete_policy`

| 值 | 行為 |
|----|------|
| `none`（**預設**） | 維持 Phase 3；reconcile 僅 dry-run 報告 |
| `conservative` | Mac **雙 library** 都無該 SHA1 → Immich 候選 trash/delete（M2 `--apply`） |

### Conservative 決策

```text
mac_refcount[sha1] = icloud 有? + local 有?   （0、1、2）

Immich asset（相簿 scope + 可選 mac_uploads）:
  mac_refcount > 0  → skip（仍 union 備份）
  mac_refcount == 0 → orphan candidate
```

**icloud-primary 存在判定**（`photos_db_libraries`）：

```text
Photos.sqlite ZASSET 仍含該 UUID（含「最近刪除」未 purge）
  AND originals/ 有對應媒體檔
→ 計入 mac_ref
```

**local-archive**：`originals/` 檔案存在即計入（與 Phase 3 一致）。

**Tier 搬移範例**（1615 張 icloud 刪、local 留）：

```text
mac_refcount = 1（local-archive）
→ skip，Immich 保留 ✅
```

---

## Config

```yaml
sync:
  delete_policy: none          # none | conservative
  reconcile:
    enabled: false
    scope: albums              # albums | tags | both
    immich_tags: []
    include_mac_uploads: true  # UUID 檔名上傳（即使未掛相簿）
    photos_db_libraries:       # icloud：以 Photos.sqlite 判斷（purge 後才算刪除）
      - icloud-primary
    fetch_page_size: 500
    batch_size: 100
    grace_days: 0
    action: trash              # trash | delete
```

---

## Tier manifest checksum

`tier-delete-manifest-*.json` 與 `batch-manifest.json` 新增 `checksum`（hex SHA1，與 upload 一致）。

Reconcile dry-run 會標記 `skipped_tier_local_retains`：tier 刪除 manifest 有紀錄，但 Mac 仍至少一 library 有檔。

---

## CLI（M1 dry-run · M2 apply）

```bash
eval "$(./scripts/dev/load-env-from-op.sh)"
./scripts/photo-sync/immich-reconcile.sh              # dry-run（預設）

# M2：需 config sync.delete_policy: conservative
./scripts/photo-sync/immich-reconcile.sh --apply --confirm

# 週日 04:00 dry-run LaunchAgent
./scripts/photo-sync/install-reconcile-launchd.sh

# M3：fswatch 即時 reconcile（需 reconcile.enabled + reconcile.watch.enabled）
./scripts/photo-sync/install-reconcile-watch-launchd.sh
```

**Immich scope**：config `libraries[].album` + 可選 `include_mac_uploads`（UUID 檔名資產）。

報告：`~/Library/Logs/immich-photo-sync/reconcile/reconcile-*.json`

```json
{
  "summary": {
    "orphan_candidates": 0,
    "skipped_still_on_mac": 5277,
    "skipped_tier_local_retains": 419
  }
}
```

---

## 實作分期

| 階段 | 內容 | 狀態 |
|------|------|------|
| **M1** | config + `immich-reconcile.sh` dry-run + tier manifest checksum | ✅ PR #19 |
| **M2** | `--apply --confirm` + trash API + LaunchAgent 週 dry-run | ✅ PR #19 |
| **M3** | fswatch lightweight reconcile（debounce 大） | ✅ PR #20 |
| **M3.1** | `photos_db_libraries` · `include_mac_uploads` · `grace_days: 0` | 🟡 本機驗證 · 待 PR |

---

## 邊界情況

| 情況 | 處理 |
|------|------|
| Live Photo (.heic + .mov) | 以 primary upload 檔 checksum 為準 |
| Immich checksum 為 base64 | `photo_sync_lib.normalize_checksum()` 轉 hex |
| ismissing（無 local originals） | originals/ scan 不計入 → 不因此刪 Immich |
| Recently Deleted（未 purge） | `photos_db_libraries` 下 UUID 仍在 DB → **仍 skip** |
| Recently Deleted（已 purge） | UUID 消失 → 可成 orphan（需 dry-run 確認） |
| `grace_days: 0` | orphan 可立即 apply；建議先 dry-run |
| 無 checksum 的 Immich asset | skip，列入 `skipped_no_checksum` |
| `IMG_XXXX` 檔名重複 | 以 UUID / 日期對照；見 [20_OPERATIONS.md](./20_OPERATIONS.md) |

---

## 相關文件

- [20_OPERATIONS.md](./20_OPERATIONS.md) — purge 流程、實測紀錄、IMG 檔名誤判
- [Phase 3 結案](../../../60_completed/phase3-photo-sync-bulk/)
- [Tier policy](../tier-policy/10_REQUIREMENTS.md)
- [scripts/photo-sync/README.md](../../../../scripts/photo-sync/README.md)
