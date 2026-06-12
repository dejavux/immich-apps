# Backlog — Phase 4+ 與 V1.1

**SSOT 進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**最後更新**: 2026-06-12

---

## Phase 3.5 — osxphotos / tier policy（P1）

- [ ] osxphotos export 整合評估
- [ ] tier_policy：icloud-primary vs local-archive 優先序
- [ ] 文件：`photo-sync/tier-policy/`（待建）

---

## Phase 4 — Storage 優化（P2）

**目標**: PostgreSQL / upload 從 HDD 遷移 SSD，提升查詢與 ML 性能

- [ ] 盤點目前 PVC / hostPath 配置
- [ ] 遷移計畫與 downtime 窗口
- [ ] 效能 baseline vs 遷移後對比

**參考**: [80_history/IMMICH_ENHANCEMENT_PROJECT.md](../80_history/IMMICH_ENHANCEMENT_PROJECT.md) §Phase 4

---

## Phase 5 — Backup 監控（P2）

**目標**: Immich 資料定期備份至 Backblaze B2 / S3 + 還原演練

- [ ] pg_dump CronJob（server 端）
- [ ] upload blob 增量備份策略
- [ ] 還原 runbook + 年度演練

**參考**: `scripts/photo-sync/photo-sync.config.yaml.example` 註解

---

## LINE Bot V1.1（P2）

- [ ] 繁中 AI 描述（Qwen vision；非 GPT-4V）
- [ ] Grafana dashboard + 7 天 SLO 告警
- [ ] Prometheus scrape 驗證

**規格**: [line-bot/10_REQUIREMENTS.md](./line-bot/10_REQUIREMENTS.md)

---

## 維運優化（P3）

- [ ] fswatch debounce / ignore 規則（sync storm 優化）
- [ ] `@immich/cli@2.7.5` 本機 pin
- [ ] Web UI / LINE 手動 E2E 驗收紀錄
