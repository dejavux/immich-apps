# Phase 3.6 — Delete Reconcile

**狀態**: 🟡 M1（dry-run）  
**前置**: Phase 3 upload-only sync · tier policy union 備份策略  
**最後更新**: 2026-06-15

---

## 問題陳述

| 現況 | 痛點 |
|------|------|
| `immich-sync.sh` 只做 **upload** | Mac 刪照片 → Immich **不刪**（刻意設計） |
| Tier policy 從 icloud 刪 source | local-archive 仍保留 → Immich 應 **保留** |
| 使用者從 **兩邊 library 都刪** | Immich 可能留下 **orphan asset** |

**目標**：在 **不破壞 union 備份** 前提下，可選擇性清理 Immich orphan（conservative 模式）。

---

## 非目標

- ❌ `mirror_icloud`：icloud 刪即刪 Immich（與 tier union 衝突）
- ❌ 第一版不做 fswatch 即時 reconcile（M3 可選）
- ❌ 不 reconcile 無 `mac-sync` tag 的 asset（例如 LINE import）

---

## 策略：`delete_policy`

| 值 | 行為 |
|----|------|
| `none`（**預設**） | 維持 Phase 3；reconcile 僅 dry-run 報告 |
| `conservative` | Mac **雙 library** 都無該 SHA1 → Immich 候選 trash/delete（M2 `--apply`） |

### Conservative 決策

```text
mac_refcount[sha1] = icloud 有? + local 有?   （0、1、2）

Immich asset（tag ∈ immich_tags）:
  mac_refcount > 0  → skip（仍 union 備份）
  mac_refcount == 0 → orphan candidate
```

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
    fetch_page_size: 500
    batch_size: 100
    grace_days: 7
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

**Immich scope**：預設用 config `libraries[].album`（`Mac Photos (iCloud)`、`Mac Photos (Local Archive)`），**不是** `mac-sync` tag（CLI upload 未打 tag）。

報告：`~/Library/Logs/immich-photo-sync/reconcile/reconcile-*.json`

```json
{
  "summary": {
    "orphan_candidates": 0,
    "skipped_still_on_mac": 8500,
    "skipped_tier_local_retains": 1615
  }
}
```

---

## 實作分期

| 階段 | 內容 | 狀態 |
|------|------|------|
| **M1** | config + `immich-reconcile.sh` dry-run + tier manifest checksum | ✅ |
| **M2** | `--apply --confirm` + trash API + LaunchAgent 週 dry-run | ✅ |
| **M3** | fswatch lightweight reconcile（debounce 大） | ✅ `immich-reconcile-watch.sh` + LaunchAgent |

---

## 邊界情況

| 情況 | 處理 |
|------|------|
| Live Photo (.heic + .mov) | 以 primary upload 檔 checksum 為準 |
| Immich checksum 為 base64 | `photo_sync_lib.normalize_checksum()` 轉 hex |
| ismissing（無 local originals） | originals/ scan 不計入 → 不因此刪 Immich |
| Recently Deleted | `grace_days` 延遲 apply；dry-run 仍列出全部 orphan 候選 |
| 無 checksum 的 Immich asset | skip，列入 `skipped_no_checksum` |

---

## 相關文件

- [Phase 3 結案](../../60_completed/phase3-photo-sync-bulk/)
- [Tier policy](./tier-policy/10_REQUIREMENTS.md)
- [scripts/photo-sync/README.md](../../../../scripts/photo-sync/README.md)
