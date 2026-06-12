# Backlog — 待辦與優先順序

**SSOT 進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)  
**最後更新**: 2026-06-13

---

## 文件角色

| 文件 | 用途 |
|------|------|
| **PROGRESS_TRACKING** | Phase 級 checklist SSOT |
| **HOW_TO_PROCEED** | 本週 Sprint 該做什麼 |
| **BACKLOG（本檔）** | 細項、tech debt、未排進 Sprint 的候選 |

**已結案規格** → [60_completed/](../60_completed/) · **維運 runbook** → [20_guides/](../20_guides/)

---

## 當前 Sprint

| 軌道 | 任務 | 狀態 | 負責 |
|------|------|------|------|
| **P0** | Web UI + LINE 人工 E2E | ✅ 進行中（你已確認） | 人工 |
| **P0** | `@immich/cli@2.7.5` pin | 📋 可選 | 本機 |
| **P1** | Phase 3.5 M1 PoC | 🟢 **Kickoff** | osxphotos 探索 |

---

## 優先順序總覽

```text
P0  本週     人工 E2E 驗收 + CLI pin
P1  下週起   Phase 3.5 osxphotos / tier_policy
P2  Q3       Phase 4 Storage SSD · Phase 5 B2 備份 · LINE V1.1 Grafana
P3  有空再做 Photo Edit AI · fswatch debounce · sync storm 優化
```

**建議順序**：P0 驗收 → **Phase 3.5**（Mac 照片分層自動化，直接減輕 sync 負擔）→ **Phase 5 pg_dump**（風險低、價值高）→ **Phase 4 SSD**（需 downtime 規劃）→ **LINE V1.1**（錦上添花）

---

## Phase 3.5 — osxphotos / tier policy（P1 · 進行中）

**規格**: [photo-sync/tier-policy/10_REQUIREMENTS.md](./photo-sync/tier-policy/10_REQUIREMENTS.md)

### M1 PoC

- [x] 安裝 osxphotos · 讀 icloud-primary（pip3 · v0.75.9）
- [x] eligible 數量：`cutoff 2023-01-01` → **2900** 張；originals **~28 GB**
- [x] `tier-policy-poc.sh` + JSON 報告
- [ ] eligible vs Immich 重疊 spot-check
- [ ] 跨 library 移動可行性（M2）

### M2 腳本

- [ ] `tier-policy.sh` 讀 config · dry-run / execute
- [ ] 小批次搬移 + rollback 文件

### M3 整合

- [ ] LaunchAgent / cron 排程
- [ ] runbook `20_guides/photo-sync/runbooks/TIER_POLICY.md`

**已完成**: `tier_policy` schema 定稿（config example）· 規劃文件 kickoff

---

## Phase 5 — Backup（P2 · 建議早於 Phase 4）

**為何提前**：115 GB upload 已上線；pg_dump 腳本 v2.7.5 升級時已驗證。

- [ ] pg_dump CronJob（K8s CronJob · namespace `immich`）
- [ ] B2 bucket + 憑證（1Password）
- [ ] 還原 runbook（年度演練）
- [ ] upload blob 增量策略（評估 restic / rclone）

**參考**: `scripts/photo-sync/photo-sync.config.yaml.example` · [80_history §Phase 5](../80_history/IMMICH_ENHANCEMENT_PROJECT.md)

---

## Phase 4 — Storage 優化（P2）

**為何稍後**：需遷移窗口；Phase 5 備份應先就位。

- [ ] 盤點 PVC / hostPath（lama HDD）
- [ ] PostgreSQL → SSD 遷移計畫 + downtime
- [ ] `/data/upload` 遷移或 symlink 策略
- [ ] pgbench / 查詢 latency baseline

---

## LINE Bot V1.1（P2）

MVP 已結案 → [line-bot/10_REQUIREMENTS.md](./line-bot/10_REQUIREMENTS.md)

- [ ] Qwen vision 繁中描述
- [ ] Grafana dashboard + 7 天 SLO
- [ ] Prometheus scrape 驗證（annotations 已有）

---

## Optional — Photo Edit + AI（P3）

**規格**: [photo-edit/10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md)

| 階段 | 任務 | 狀態 |
|------|------|------|
| A0 | OpenAPI + GPU 共存策略研究 | 📋 |
| A1 | rembg 單張 PoC → Immich upload + source tag | 📋 |
| A2 | `photo-edit-bff` 服務 + Helm | 📋 |
| B | ComfyUI workflow + LINE 指令 | 📋 |
| C | Before/after UI + job queue | 📋 |

**觸發條件**：Phase 3.5 M2 或 Phase 5 pg_dump 完成後再開 PoC。

---

## 維運 / Tech Debt（P3）

- [ ] fswatch debounce / ignore（10:03–10:15 sync storm）
- [ ] local-archive hash 變更監控（audit-local-duplicates cron）
- [ ] Grafana Immich server dashboard 抽查
- [ ] `docs/` stub 清理（2026-09 後）

---

## 最近完成（移出 Backlog）

| 項目 | 完成日 |
|------|--------|
| Phase 2 LINE Bot MVP | 2026-06-12 |
| Phase 3 Photo Sync 全量 + 增量 | 2026-06-13 |
| Immich v2.7.5 升級 | 2026-06-12 |
| 場景搜尋 fix PR #13 | 2026-06-12 |
| docs 目錄重整 PR #14 | 2026-06-13 |
