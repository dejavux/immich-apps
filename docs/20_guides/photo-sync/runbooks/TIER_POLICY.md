# Tier Policy Runbook — icloud-primary → local-archive

**Phase 3.5 M3** · 最後更新：2026-06-13

---

## 前置

```bash
pip3 install --user osxphotos photoscript
export PATH="$HOME/.local/bin:$PATH"
```

設定檔 `~/.config/immich-apps/photo-sync.config.yaml`：

```yaml
tier_policy:
  enabled: true          # --execute 必要
  dry_run: true          # 預設只規劃；execute 時加 --execute
  cutoff_date: "2023-01-01"
  batch_size: 10
  local_path_only: true
  skip_shared_library: false
```

---

## 流程

### 1. 規劃（dry-run）

```bash
./scripts/photo-sync/tier-policy-poc.sh
./scripts/photo-sync/tier-policy-spotcheck.sh
./scripts/photo-sync/tier-policy.sh --dry-run --batch-size 10
```

報告：`~/Library/Logs/immich-photo-sync/tier/tier-plan-*.json`

### 2. 執行一批（export → import）

**會啟動 Photos.app** 並開啟 `local-archive` library（首次可能需點確認）。

```bash
# 設定 enabled: true 後
./scripts/photo-sync/tier-policy.sh --execute --batch-size 10
```

每批：

1. `osxphotos export` → staging
2. `photoscript` import 至 target album
3. fingerprint 驗證
4. 輸出 **delete manifest**（不自動刪 source）

### 3. 人工刪除 source（gate）

manifest：`~/Library/Logs/immich-photo-sync/tier/tier-delete-manifest-*.json`

1. 在 Photos 開啟 **icloud-primary**
2. 依 manifest 的 `filename` / `date` 找到項目
3. **刪除**（Immich 仍有備份；local-archive 已 import）
4. `shared_library: true` 項目需特別確認是否適合刪除

腳本會在 terminal 暫停等待 Enter（`--no-pause` 可略過）。

### 4. 重複直到搬完

狀態檔：`~/Library/Logs/immich-photo-sync/tier/state.json`（已 import 的 UUID 會跳過）

```bash
# 577 張 local-path ≈ 58 批 × batch_size 10
while ./scripts/photo-sync/tier-policy.sh --execute --batch-size 10 --no-pause; do
  sleep 5
done
```

### 5. 驗收

```bash
./scripts/photo-sync/immich-sync.sh --dry-run
./scripts/photo-sync/tier-policy-spotcheck.sh
```

---

## Rollback（手動）

1. 在 **local-archive** 找到 import 項目
2. Export 或拖回 **icloud-primary**（Photos UI）
3. 從 `tier/state.json` 移除對應 UUID（若需 re-run tier）

---

## 疑難排解

| 問題 | 處理 |
|------|------|
| `tier_policy.enabled is false` | config 設 `enabled: true` 或 `--force` |
| Photos 彈 duplicate 視窗 | 應已設 `skip_duplicate_check=True`；確認 photoscript 版本 |
| export 空目錄 | 項目可能 `ismissing`；v1 只處理 local path |
| import 後 verify 失敗 | 查 staging 與 target library；勿刪 source |

---

## 參考

- [10_REQUIREMENTS.md](../../00_planning/photo-sync/tier-policy/10_REQUIREMENTS.md)
- [20_CROSS_LIBRARY_MOVE_RESEARCH.md](../../00_planning/photo-sync/tier-policy/20_CROSS_LIBRARY_MOVE_RESEARCH.md)
