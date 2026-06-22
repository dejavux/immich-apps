# Phase 3.5 Gate 狀態（Handoff）

**評估時間**：2026-06-22 20:33 CST  
**評估者**：Orchestrator subagent（W0 復工驗證，**無** cluster/deploy/reconcile --apply）

---

## 總結

| 項目 | 結果 |
|------|------|
| **Phase 3.5 gate** | **FAIL** |
| **建議 Wave** | **W0**（繼續 Task A） |
| **Cluster/deploy 工作** | **無** |

---

## Gate Criteria 逐項

| 準則 | 狀態 | 證據 |
|------|------|------|
| reconcile dry-run `orphan_ready_for_apply: 0` | ✅ PASS | `reconcile-20260622-203149.json`：`orphan_candidates: 0`，`orphan_ready_for_apply: 0`（本次重跑 dry-run） |
| tier verify `staging_items: 0` | ✅ PASS | `tier-policy-status.sh`（2026-06-22 20:28 CST）：`staging_items: 0` |
| icloud-primary dry-run `0 new` | ⚠️ BLOCKED | `immich-sync.sh --library icloud-primary --dry-run` → `Another sync running (PID 17779)`；`/bin/ps`：`bash …/immich-sync.sh`（子行程 `python3.12`）— lock **有效**，未清除 |
| local-archive dry-run / 9 new | ⚠️ BLOCKED | 同上 lock（PID 17779）；§3.5.5 仍列 local-archive 待上傳 |
| album reconcile stale=0 missing=0 | ❌ FAIL | `immich-icloud-album-reconcile.sh --dry-run`（2026-06-22 20:32 UTC）：`stale_to_remove: 27`，`missing_on_mac_to_add: 123`（非 0/0） |
| Recently Deleted 永久清除 | ❌ FAIL | sqlite `ZTRASHEDSTATE=1`：**103**（與 tier-policy-status 一致） |
| 23 張手動還原 | ❌ FAIL | `recovery/trashed-restore-23.json`：`items` 23 筆，無 `restored` 狀態；需使用者 GUI 確認 |

---

## Task 解鎖狀態

| Task | 說明 | 狀態 |
|------|------|------|
| **A** Phase 3.5 Gate | purge + local-archive + 還原確認 | 🟢 **進行中（W0）** |
| **B** Phase 5a Backup | B2 + pg_dump CronJob | 🔴 **BLOCKED**（3.5 gate FAIL） |
| **C** Phase 1 Hardening | PR/設計可平行；prod deploy 建議錯開 | 🟡 **部分解鎖**（僅文檔/manifest PR） |
| **D** Phase 4 SSD | Postgres NVMe 遷移 | 🔴 **BLOCKED**（3.5 + 5a） |
| **E** Phase 5b Monitoring | Grafana + 告警 | 🟡 **可規劃**；prod 告警建議 3.5 後 |

---

## 腳本存在性（✅）

| 腳本 | 路徑 |
|------|------|
| reconcile dry-run | `immich-apps/scripts/photo-sync/immich-reconcile.sh` |
| album reconcile | `immich-apps/scripts/photo-sync/immich-icloud-album-reconcile.sh` |
| tier 狀態摘要 | `immich-apps/scripts/photo-sync/tier-policy-status.sh` |
| sync | `immich-apps/scripts/photo-sync/immich-sync.sh` |

---

## 建議使用者執行的 Gate 驗證命令

在 **無其他 sync 執行中** 時於本機 Mac 執行：

```bash
cd /Users/light0/DEV/immich-apps
eval "$(./scripts/dev/load-env-from-op.sh)"

# 1) 單頁狀態
./scripts/photo-sync/tier-policy-status.sh

# 2) reconcile dry-run（應 orphan_ready_for_apply: 0）
./scripts/photo-sync/immich-reconcile.sh
jq '.summary | {orphan_candidates, orphan_ready_for_apply}' \
  ~/Library/Logs/immich-photo-sync/reconcile/reconcile-*.json | tail -5

# 3) sync dry-run
./scripts/photo-sync/immich-sync.sh --library icloud-primary --dry-run
./scripts/photo-sync/immich-sync.sh --library local-archive --dry-run

# 4) album reconcile
./scripts/photo-sync/immich-icloud-album-reconcile.sh --dry-run

# 5) Recently Deleted 計數（purge 後應接近 0 或僅剩不可刪 shared）
sqlite3 "$HOME/Pictures/Photos Library.photoslibrary/database/Photos.sqlite" \
  "SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=1"
```

**人工步驟（GUI）**：

1. Photos → 最近刪除：還原 §3.5.5 所列 23 張（capture < 1y 且不在 Immich）
2. 確認後 → 永久清除 Recently Deleted
3. 再跑步驟 2–5；若全 PASS → 更新本檔為 `Phase 3.5 gate: PASS` 並進 **W1**

**purge 後若有 orphan**（歷史曾 dry-run 20）：

```bash
./scripts/photo-sync/immich-reconcile.sh --apply --confirm  # 僅在 dry-run 確認後
```

---

## 與 PROGRESS_TRACKING §3.5.5 對照

| §3.5.5 待辦 | 本次評估（2026-06-22 復工） |
|-------------|----------|
| 手動還原 23 張 | ❌ 未確認完成 |
| Recently Deleted 永久清除 | ❌ 仍 103 筆 |
| icloud dry-run 0 new | ⚠️ sync lock（PID 17779 執行中） |
| album reconcile dry-run | ❌ stale=27 · missing=123 |
| local-archive 9 new | ⚠️ sync lock（未 dry-run） |
| reconcile dry-run | ✅ orphan 0（`reconcile-20260622-203149.json`） |
| Phase 3.5 結案 | ❌ |

---

## 下一動作（Orchestrator）

1. 派 **Task A**（[phase-3.5-gate.md](./phase-3.5-gate.md)）— 產出 23 張還原 checklist、等使用者 purge
2. **勿**派 Task B/D 至 prod
3. Task C 可做 manifest PR（不 deploy）
4. Gate PASS 後更新本檔並通知進入 **W1**
