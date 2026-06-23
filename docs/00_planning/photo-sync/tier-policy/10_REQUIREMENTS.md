# Phase 3.5 — iCloud 分層自動化（tier policy）

**狀態**: 🟢 Kickoff  
**優先級**: P1  
**前置**: Phase 3 Photo Sync ✅ · `tier_policy` config 已預留  
**最後更新**: 2026-06-13

---

## 問題陳述

| 現況 | 痛點 |
| ------ | ------ |
| 兩個 `.photoslibrary`（iCloud + Local） | iCloud 配額有限 |
| 兩邊都 sync → Immich dedupe | **搬移需手動**在 Photos App 操作 |
| Immich 為 union 備份 | 無法用 CLI 批次「移出 iCloud library」 |

**目標**：依 `tier_policy`（容量 / 日期）自動將 eligible 照片從 iCloud library 移至 local-archive，**不刪 Immich**，現有 sync pipeline 繼續運作。

---

## 非目標

- 不從 Immich 刪 asset 來「釋放 iCloud」（Mac SSOT 在 Photos）
- 不取代 Phase 5 B2 備份
- 第一版不做 Web UI / LINE 通知（log + stats JSON 即可）

---

## 方案

### 首選：osxphotos

[osxphotos](https://github.com/RhetTbull/osxphotos) 可讀 Photos library metadata、匯出、部分操作。PoC 驗證：

1. 能否列出 `icloud-primary` 超過 `cutoff_date` 的 UUID
2. 能否匯出到 staging 再 import 至 `local-archive`（或 AppleScript 輔助「移動」）

### 備選：Photos AppleScript

若 osxphotos 無法安全「跨 library 移動」，保留 AppleScript + 人工確認 gate。

### 與現有 sync 整合

```text
LaunchAgent / cron
  → tier-policy.sh（dry-run 預設）
  → immich-sync.sh（兩 library，既有 hash dedupe）
```

`tier_policy.dry_run: true` 直到 PoC 通過。

---

## Config schema（已定稿 · Phase 3 預留）

見 `scripts/photo-sync/photo-sync.config.yaml.example`：

```yaml
tier_policy:
  enabled: false          # PoC 通過後 true
  source_library_id: icloud-primary
  target_library_id: local-archive
  max_size_gb: 50         # iCloud library 超出 → eligible
  cutoff_date: "2023-01-01"  # 可選，與 max_size 二擇一或並用
  dry_run: true
```

**Config 欄位**（見 `photo-sync.config.yaml.example`）：

```yaml
  batch_size: 10
  local_path_only: true
  skip_shared_library: false
  # staging_dir: /tmp/immich-photo-sync/tier-staging
  # target_album: Mac Photos (Local Archive)
```

~~**待增**（Phase 3.5 實作時）~~：

```yaml
  # min_age_days: 30      # Planned: 避免搬移剛拍的照片
```

---

## 實作里程碑

### M1 — PoC（本週）

- [x] `pip3 install --user osxphotos`（`~/.local/bin/osxphotos` · v0.75.9）
- [x] `osxphotos info` — iCloud library 可讀（4232 Photo App · 2560 未下載）
- [x] `immich-sync.sh --dry-run` — **0 new / 2789 dup** ✅
- [x] `scripts/photo-sync/tier-policy-poc.sh` — dry-run JSON 報告

**PoC 結果**（`cutoff_date: 2023-01-01`）：

| 指標 | 值 |
| ------ | ----- |
| originals 磁碟 | **~28 GB**（< `max_size_gb: 50` → 尺寸條件不觸發） |
| eligible（日期） | **2900** 張（建立日期早於 2023-01-01） |
| 報告 | `~/Library/Logs/immich-photo-sync/tier/tier-poc-*.json` |

```bash
export PATH="$HOME/.local/bin:$PATH"
./scripts/photo-sync/tier-policy-poc.sh --cutoff-date 2023-01-01
```

### M2 — spot-check + 跨 library 可行性（本週）

- [x] **Immich hash 重疊**：577 張 local-path eligible → **100% dup**（`bulk-upload-check`）
- [x] **eligible 分桶**：2900 總計 · 577 可 export · 2188 iCloud-only · 0 已在 local-archive
- [x] `tier-policy-spotcheck.sh` · `tier-policy-cross-library-poc.sh`（只計數、不搬檔）
- [x] [20_CROSS_LIBRARY_MOVE_RESEARCH.md](./20_CROSS_LIBRARY_MOVE_RESEARCH.md)

**M2 結論**：

| 項目 | 結果 |
| ------ | ------ |
| Immich 覆蓋（可 hash 子集） | **577/577 = 100%** |
| 跨 library 自動「move」 | **不可**；需 export → photoscript import → 人工/AS 刪 source |
| v1 建議先搬 | **577** 張已有 local path（Immich 已 dup） |
| 其餘 2188 | 需 iCloud 下載後才能 export；1865 Live Photo · 940 shared library 需額外 caution |

```bash
export PATH="$HOME/.local/bin:$PATH"
./scripts/photo-sync/tier-policy-spotcheck.sh
./scripts/photo-sync/tier-policy-cross-library-poc.sh
```

- [x] M3：`tier-policy.sh` execute — **第一輪 1615/1615 verify**（2026-06-14）

### M3 — tier-policy.sh ✅（v1 · 2026-06-14 bulk）

- [x] 讀 `photo-sync.config.yaml` 的 `tier_policy`
- [x] dry-run：JSON 報告（eligible / skipped / batch 清單）
- [x] execute：`osxphotos export` → `osxphotos import` + verify poll
- [x] export-only / import-staging / bulk-export / bulk-import / verify-staging / retry-failed
- [x] Live Photo import 修正（略過 companion `.mov`）
- [x] 人工 gate：`tier-delete-manifest-*.json` + terminal 暫停
- [x] 狀態檔 `tier/state.json`（exported **1615** · imported **1615**）
- [x] Runbook：[TIER_POLICY.md](../../../20_guides/photo-sync/runbooks/TIER_POLICY.md)

```bash
export PATH="$HOME/.local/bin:$PATH"
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-one-year
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh   # 1615/1615
```

- [x] 人工刪除 icloud-primary source（1615 張 → **Recently Deleted** · 2026-06-14）
- [ ] 永久清除 Recently Deleted（釋放 iCloud 配額）
- [ ] Phase B：4119 張 `ismissing` iCloud 下載 + re-export

### M4 — LaunchAgent 整合

- [ ] 每週 cron 或 fswatch 前執行 tier（可選）
- [ ] 與 `immich-watch.sh` 協調（避免 sync storm）
- [ ] 文件：`20_guides/photo-sync/runbooks/TIER_POLICY.md`

---

## 驗收標準

- [x] `tier_policy.dry_run` 輸出 eligible 清單且可重現
- [ ] 執行後：iCloud library 磁碟/Photos 顯示容量下降（**待人工刪 source**）
- [ ] Immich：`immich-sync.sh --dry-run` 兩 library 仍 **0 new**
- [x] staging verify **1615/1615**（fingerprint + filename fallback）
- [ ] rollback 程序 documented（從 local 移回 iCloud 手動步驟）

---

## 風險

| 風險 | 緩解 |
| ------ | ------ |
| osxphotos 無法跨 library 移動 | AppleScript / 半自動 + 人工確認 |
| 搬移後 iCloud 重新下載 | 先移「僅 local 已有 copy」的 dup |
| sync storm | tier 與 fswatch 錯開；debounce 加大 |
| Live Photos / HEIC 特殊格式 | PoC 含 HEIC + MOV pair |

---

## 參考

- [Phase 3 歸檔規格](../../../60_completed/phase3-photo-sync-bulk/10_REQUIREMENTS.md)
- [scripts/photo-sync/README.md](../../../../../scripts/photo-sync/README.md)
- [BACKLOG §Phase 3.5](../../BACKLOG.md)
