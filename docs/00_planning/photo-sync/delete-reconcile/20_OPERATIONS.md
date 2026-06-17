# Delete Reconcile — 維運與疑難排解

**最後更新**: 2026-06-17  
**規格**: [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) · **SSOT**: [PROGRESS_TRACKING §3.6](../../PROGRESS_TRACKING.md)

---

## 實測紀錄

| 日期 | 動作 | 結果 |
|------|------|------|
| 2026-06-15 | 首次 `--apply --confirm`（album scope · PR #19） | **484** orphan trashed → dry-run **0** |
| 2026-06-17 | 擴大 scope（`include_mac_uploads` + `photos_db_libraries`）apply | **17** orphan trashed |
| 2026-06-17 | dry-run（patch 後） | `orphan_candidates: 0` · `skipped_still_on_mac: 5277` · `skipped_tier_local_retains: 419` |

報告目錄：`~/Library/Logs/immich-photo-sync/reconcile/reconcile-*.json`

---

## Mac 端「還在」的定義（icloud-primary）

當 config 設 `photos_db_libraries: [icloud-primary]` 時，icloud 庫以 **Photos.sqlite `ZASSET.ZUUID` 仍存在** 為準：

| Mac 狀態 | `mac_ref` | reconcile |
|----------|-----------|-----------|
| 圖庫內 | 1 | skip |
| **最近刪除**（尚未永久清除） | **1** | skip |
| 最近刪除 **已 purge**（UUID 自 DB 消失） | 0 | 可成 orphan candidate |

`local-archive` 仍用 `originals/` 檔案是否存在掃描。

**設計理由**：tier 或手動刪除後，在 purge 前仍可還原；與「purge 後才同步刪 Immich」一致。

---

## 建議操作流程（purge → reconcile）

```text
1. Photos：從 icloud-primary 刪除（或已在「最近刪除」）
2. Photos：最近刪除 → 全部删除（永久清除）
3. immich-reconcile.sh                    # dry-run，確認 orphan_candidates
4. immich-reconcile.sh --apply --confirm  # 需 delete_policy: conservative
5. immich-reconcile.sh                    # 再 dry-run，應為 0
```

tier Phase B 兩輪 delete（第一輪 1615 + 本輪 bulk）建議 **verify 完成後** 再一次 purge，再跑 reconcile。

---

## 常見誤判：搜尋 `IMG_XXXX` 檔名

Apple Photos **會重用** `IMG_1903.HEIC` 等檔名（不同年份、不同張）。

**案例（2026-06-17）**：Immich Monday 時間軸 4 張（瓦斯表 + 文件）對應 **2026-06-16 17:16** 連拍：

| Immich 檔名（UUID） | Photos `original_filename` | Mac 狀態（當日） |
|---------------------|----------------------------|------------------|
| `5A5C03E6-….heic` | `IMG_1903.HEIC` | 圖庫內 |
| `D1988830-….heic` | `IMG_1904.HEIC` | 最近刪除 |
| `2BCDDC14-….heic` | `IMG_1905.HEIC` | 最近刪除 |
| `6A244C0F-….heic` | `IMG_1906.HEIC` | 圖庫內 |

在 Photos 搜尋 `IMG_1903` 會出現 **2023** 年的小女孩／淺草照（另兩張同名），**不是** 2026 這批。

**正確對照方式**（優先序）：

1. Immich asset **id** 或上傳檔名 **UUID**
2. Photos **日期**（2026-06-16 下午）
3. osxphotos：`PhotosDB().get_photo(uuid)` 查 `original_filename` + `intrash`
4. 勿單靠 `IMG_XXXX` 搜尋

API upload 使用 UUID 檔名、`include_mac_uploads: true` 時，reconcile scope 會納入未掛相簿的 Mac 上傳。

---

## Config 要點（本機已驗證）

```yaml
sync:
  delete_policy: conservative
  reconcile:
    enabled: true
    include_mac_uploads: true
    photos_db_libraries:
      - icloud-primary
    grace_days: 0
    action: trash
```

- `grace_days: 0`：dry-run 列出的 orphan 可立即 `--apply`（仍建議先看報告）
- `auto_apply: false`（預設）：watch / LaunchAgent 不會自動刪

---

## CLI 診斷（M3.1）

```bash
eval "$(./scripts/dev/load-env-from-op.sh)"
./scripts/photo-sync/immich-reconcile-diagnose.sh <immich-asset-id>
./scripts/photo-sync/immich-reconcile-diagnose.sh --json <asset-id>
```

輸出：`mac_refcount`、各 library 的 `osxphotos` / `photos_db_tracked`、是否 `orphan_candidate`。

---

## 待辦（M3.1+）

| 項目 | 說明 | 優先 |
|------|------|------|
| PR：reconcile patch | `photos_db_libraries` · `include_mac_uploads` · `grace_days: 0` | ✅ 本 PR |
| `immich-reconcile-diagnose.sh` | 輸入 Immich asset id → Photos.sqlite / originals / mac_ref | ✅ 本 PR |
| Recently Deleted purge | 兩輪 tier delete + 手動刪除後一次清 | P1（bulk 後） |
| `trashed=1` 即 absent？ | 目前 **否**；若改需求需另開規格 | 決策 |

---

## 相關

- [tier-policy — 永久清除 Recently Deleted](../tier-policy/README.md)
- [scripts/photo-sync/README.md](../../../../scripts/photo-sync/README.md)
