# immich-apps 文檔目錄重整規劃

**日期**: 2026-06-12  
**狀態**: ✅ 已執行（2026-06-12 · PR-A/B/C 合併）  
**參考**: `fuqi-asset-manager/docs/` · `infra-bootstrap/00_docs/DOCUMENTATION_ARCHIVE_RULES.md`

---

## 1. 現況盤點

### 1.1 問題

| 問題 | 說明 |
|------|------|
| **扁平 20+ 檔** | 全在 `docs/` 根目錄，Phase / runbook / 歷史混雜 |
| **README 過期** | 仍寫「Phase 2 ~45%」、連結 `PHASE1/4/5` 部分不存在 |
| **SSOT 分散** | `PROGRESS_TRACKING` + `HOW_TO_PROCEED` + `IMMICH_ENHANCEMENT_PROJECT` 內容重疊 |
| **無歸檔區** | 已結案 Phase 0/2 與 migration 摘要無 `60_completed/` |
| **命名不一致** | `PHASE3_*` vs `IMMICH_UPGRADE_*` vs `*_SUMMARY` |

### 1.2 現有檔案分類

| 類別 | 檔案 | 建議處置 |
|------|------|----------|
| **活躍 SSOT** | `PROGRESS_TRACKING.md`, `HOW_TO_PROCEED.md` | → `00_planning/` |
| **進行中專案** | `PHASE3_*`, `IMMICH_UPGRADE_v2.7.5.md` | → `00_planning/photo-sync/` · `infra/upgrades/` |
| **規格 / 設計** | `PHASE2_LINE_BOT.md`, `PHASE2_K8S_DEPLOYMENT.md` | → `00_planning/line-bot/` · `infra/` |
| **維運指南** | `CURSOR_LINT_FIX_AGENT.md` | → `20_guides/` |
| **參考** | `GPU_CONFIGURATION.md`, `PORT_RANGE_PLAN.md` | → `00_planning/infra/` |
| **已結案 / 歷史** | `COMPLETION_SUMMARY.md`, `MIGRATION_SUMMARY.md`, `FIXES_SUMMARY.md`, `IMPLEMENTATION_SUMMARY.md`, `REPO_*`, `QUESTIONS_ANSWERED.md` | → `60_completed/` |
| **原始願景（凍結）** | `IMMICH_ENHANCEMENT_PROJECT.md` | → `80_history/` 或 `60_completed/vision/` |
| **索引** | `README.md` | 重寫為頂層導覽 |

---

## 2. 目標目錄結構

對齊 fuqi 的 **`00_planning` / `20_guides` / `60_completed` / `80_history`** 分層：

```text
docs/
├── README.md                              # 頂層導覽（連到各區 SSOT）
│
├── 00_planning/                           # 進行中 + 規格 + 進度
│   ├── README.md
│   ├── DOCUMENTATION_INDEX.md             # 同 fuqi：全 planning 索引
│   ├── PROGRESS_TRACKING.md               # ⭐ 任務 SSOT
│   ├── HOW_TO_PROCEED.md                  # ⭐ 現在該做什麼
│   ├── BACKLOG.md                         # Phase 4/5/V1.1 待辦池
│   │
│   ├── line-bot/                          # Phase 2 + 後續 Bot 功能
│   │   ├── README.md
│   │   ├── 10_REQUIREMENTS.md             ← PHASE2_LINE_BOT.md
│   │   └── 90_PROGRESS.md                 ← PROGRESS §Phase 2 摘要（或連結 SSOT）
│   │
│   ├── photo-sync/                        # Phase 3 + 3.5
│   │   ├── README.md
│   │   ├── 10_REQUIREMENTS.md             ← PHASE3_PHOTO_SYNC.md
│   │   ├── runbooks/
│   │   │   ├── EXTERNAL_LIBRARY_CLEANUP.md
│   │   │   └── STORAGE_AUDIT.md
│   │   └── tier-policy/                   # Phase 3.5 osxphotos（待建）
│   │
│   ├── infra/                             # K8s / GPU / port / 升級
│   │   ├── README.md
│   │   ├── K8S_DEPLOYMENT.md              ← PHASE2_K8S_DEPLOYMENT.md
│   │   ├── GPU_CONFIGURATION.md
│   │   ├── PORT_RANGE_PLAN.md
│   │   └── upgrades/
│   │       └── IMMICH_v2.7.5.md           ← IMMICH_UPGRADE_v2.7.5.md
│   │
│   └── repo/                              # monorepo 決策（仍有效參考）
│       ├── REPO_CONSOLIDATION_PLAN.md
│       └── REPO_ARCHITECTURE_RECOMMENDATION.md
│
├── 20_guides/                             # 日常操作手冊（非專案）
│   ├── README.md
│   └── CURSOR_LINT_FIX_AGENT.md
│
├── 60_completed/                          # 已結案專案（不再改內容，僅勘誤）
│   ├── README.md                          # 歸檔規則 + 索引
│   ├── phase0-repo-consolidation/
│   │   ├── README.md
│   │   ├── MIGRATION_SUMMARY.md
│   │   └── COMPLETION_SUMMARY.md
│   ├── phase2-line-bot-mvp/
│   │   ├── README.md
│   │   └── IMPLEMENTATION_SUMMARY.md
│   ├── phase3-photo-sync-bulk/            # Phase 3 全量結案後移入
│   │   ├── README.md
│   │   ├── FIXES_SUMMARY.md
│   │   └── upgrade/
│   │       └── IMMICH_v2.7.5_COMPLETED.md # 升級完成紀錄（自 checklist 摘錄）
│   └── faq/
│       └── QUESTIONS_ANSWERED.md
│
└── 80_history/                            # 早期願景 / 已被 SSOT 取代
    ├── README.md
    └── IMMICH_ENHANCEMENT_PROJECT.md
```

---

## 3. 歸檔規則（`60_completed/`）

沿用 infra-bootstrap [DOCUMENTATION_ARCHIVE_RULES](https://github.com/dejavux/infra-bootstrap/blob/main/00_docs/DOCUMENTATION_ARCHIVE_RULES.md) 精神：

| 條件 | 動作 |
|------|------|
| Phase 驗收 checklist 全勾、不再新增功能 | 整包移入 `60_completed/<project>/` |
| `PROGRESS_TRACKING` 該 Phase 標 ✅ 結案 | 在 completed README 加一行索引 + 完成日 |
| Runbook 仍會用（如 external-library cleanup） | **留** `00_planning/photo-sync/runbooks/` |
| 升級 checklist 執行完 | 摘要移 completed；詳細 checklist 可留 planning 或 completed 副本 |
| 新 agent / 新人 | 只看 `00_planning/PROGRESS_TRACKING` + `HOW_TO_PROCEED`，completed 僅查考古 |

**每個 completed 子目錄必備**：

```markdown
# <專案名>
**歸檔日期**: YYYY-MM-DD
**活躍 SOT**: [連結到 00_planning 後繼文件]
## 交付摘要
## 文件索引（表格）
```

---

## 4. 檔案搬移對照表

| 現路径 | 新路径 |
|--------|--------|
| `docs/PROGRESS_TRACKING.md` | `docs/00_planning/PROGRESS_TRACKING.md` |
| `docs/HOW_TO_PROCEED.md` | `docs/00_planning/HOW_TO_PROCEED.md` |
| `docs/PHASE2_LINE_BOT.md` | `docs/00_planning/line-bot/10_REQUIREMENTS.md` |
| `docs/PHASE2_K8S_DEPLOYMENT.md` | `docs/00_planning/infra/K8S_DEPLOYMENT.md` |
| `docs/PHASE3_PHOTO_SYNC.md` | `docs/00_planning/photo-sync/10_REQUIREMENTS.md` |
| `docs/PHASE3_EXTERNAL_LIBRARY_CLEANUP.md` | `docs/00_planning/photo-sync/runbooks/EXTERNAL_LIBRARY_CLEANUP.md` |
| `docs/PHASE3_STORAGE_AUDIT.md` | `docs/00_planning/photo-sync/runbooks/STORAGE_AUDIT.md` |
| `docs/IMMICH_UPGRADE_v2.7.5.md` | `docs/00_planning/infra/upgrades/IMMICH_v2.7.5.md` |
| `docs/GPU_CONFIGURATION.md` | `docs/00_planning/infra/GPU_CONFIGURATION.md` |
| `docs/PORT_RANGE_PLAN.md` | `docs/00_planning/infra/PORT_RANGE_PLAN.md` |
| `docs/CURSOR_LINT_FIX_AGENT.md` | `docs/20_guides/CURSOR_LINT_FIX_AGENT.md` |
| `docs/MIGRATION_SUMMARY.md` | `docs/60_completed/phase0-repo-consolidation/MIGRATION_SUMMARY.md` |
| `docs/COMPLETION_SUMMARY.md` | `docs/60_completed/phase0-repo-consolidation/COMPLETION_SUMMARY.md` |
| `docs/IMPLEMENTATION_SUMMARY.md` | `docs/60_completed/phase2-line-bot-mvp/IMPLEMENTATION_SUMMARY.md` |
| `docs/FIXES_SUMMARY.md` | `docs/60_completed/phase3-photo-sync-bulk/FIXES_SUMMARY.md` |
| `docs/QUESTIONS_ANSWERED.md` | `docs/60_completed/faq/QUESTIONS_ANSWERED.md` |
| `docs/REPO_CONSOLIDATION_PLAN.md` | `docs/00_planning/repo/REPO_CONSOLIDATION_PLAN.md` |
| `docs/REPO_ARCHITECTURE_RECOMMENDATION.md` | `docs/00_planning/repo/REPO_ARCHITECTURE_RECOMMENDATION.md` |
| `docs/IMMICH_ENHANCEMENT_PROJECT.md` | `docs/80_history/IMMICH_ENHANCEMENT_PROJECT.md` |

---

## 5. 執行階段（建議 PR 切分）

### PR-A：骨架 + 索引（低風險）

1. 建立 `00_planning/`、`20_guides/`、`60_completed/`、`80_history/` 與各 `README.md`
2. 新增 `DOCUMENTATION_INDEX.md`、`BACKLOG.md`（自 PROGRESS 抽出 Phase 4/5）
3. 重寫根 `docs/README.md`
4. **不搬檔**，舊路徑保留

### PR-B：搬移 + stub 轉址

1. `git mv` 依對照表
2. 舊路徑留 stub（≤5 行）：

   ```markdown
   # Moved
   → [新路径](../00_planning/...)
   ```

3. 批次更新 repo 內連結：`grep -r 'docs/PHASE' .`

### PR-C：結案歸檔

1. Phase 3 正式結案後：`phase3-photo-sync-bulk/` 補 README + 驗收摘要
2. `IMMICH_v2.7.5` 完成項移 completed 摘要
3. 刪除 stub（或保留 3 個月）

### 需同步更新的外部引用

| 位置 | 動作 |
|------|------|
| `immich-apps/README.md` | 連結改 `docs/00_planning/` |
| `scripts/photo-sync/README.md` | 連結 runbooks |
| `infra-bootstrap/60_apps/immich/README.md` | 指向新 DOCUMENTATION_INDEX |
| `.cursor/rules`（若有） | PROGRESS 路徑 |

---

## 6. `00_planning` 子專案 README 模板

```markdown
# <子專案名>（例：Photo Sync）

**狀態**: 🚧 進行中 | ✅ 已結案 → [60_completed/...](../60_completed/...)
**SSOT**: [PROGRESS_TRACKING §Phase N](../PROGRESS_TRACKING.md#...)

## 文件

| 文件 | 用途 |
|------|------|
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | 需求與設計 |
| [runbooks/](./runbooks/) | 操作 runbook |

## 驗收

- [ ] …
```

---

## 7. 與 fuqi 對照

| fuqi | immich-apps（規劃） |
|------|---------------------|
| `00_planning/PROGRESS_TRACKING.md` | 同 |
| `00_planning/DOCUMENTATION_INDEX.md` | 同 |
| `00_planning/<project>/10_REQUIREMENTS.md` | line-bot / photo-sync |
| `00_planning/<project>/90_PROGRESS.md` | 可選；或只用頂層 PROGRESS |
| `20_guides/COMMAND_REFERENCE.md` | 待建（photo-sync + make 指令） |
| `60_completed/<project>/README.md` | phase0 / phase2 / phase3 |
| `80_history/` | 早期大規劃 |

---

## 8. 立即建議（本週）

1. **合併 PR-A** — 只加目錄與索引，零破壞
2. **更新根 `docs/README.md`** — 反映 Phase 3 ~95%、v2.7.5 ✅
3. **Phase 3 結案時** — 執行 PR-C，把 bulk sync + upgrade 收進 `60_completed/`
4. **新增 `20_guides/COMMAND_REFERENCE.md`** — 匯總 `make release`、photo-sync、smoke 指令

---

## 9. 決策待確認

| # | 問題 | 建議 |
|---|------|------|
| 1 | `PHASE2_*` 檔名是否保留前綴？ | 改 `10_REQUIREMENTS.md`（fuqi 風格） |
| 2 | stub 轉址保留多久？ | 3 個月或下一 major release |
| 3 | `IMMICH_UPGRADE` 放 planning 還 completed？ | 進行中 → planning；結案後摘要 → completed |
| 4 | Phase 4/5 尚未有 md 檔 | 先建 `BACKLOG.md` 條目，有 spec 再開子目錄 |

---

**下一步**: stub 可於 2026-09 後移除；新連結請直接用 `00_planning/` 路徑。
