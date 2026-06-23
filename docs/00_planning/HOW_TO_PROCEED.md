# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-23（增強專案結案 · Ops W1–W3 deploy）  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**待辦優先序**: [BACKLOG.md](./BACKLOG.md)  
**Gate 狀態**: [agent-prompts/GATE_STATUS.md](./agent-prompts/GATE_STATUS.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
|------|------|
| **Immich Enhancement** | ✅ **結案**（Phase 0/2/3/3.5/3.6） |
| Phase 3.5 | ✅ PASS（purge/還原 **豁免** — family shared） |
| Immich server | **v2.7.5** @ `https://immich.3q.fi` |
| LINE Bot | PR #26–#28 已 deploy |
| **Immich Ops**（Phase 1/4/5） | Phase 1 deploy ✅ · 5a **PARTIAL**（pg 1/2 · B2 待 item）· 5b 規則 ✅ · 4 prep ✅ |

---

## 🎯 若要繼續 Immich Ops（可選）

### Wave W1 — Phase 5a 備份（進行中）

→ [agent-prompts/phase-5a-backup.md](./agent-prompts/phase-5a-backup.md) · [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

**已完成**：pg CronJob deploy · 還原演練 13759 · 排程 Success **1/2**（06-23 03:00）

**待你執行**（需 `op signin` + B2 憑證）：

```bash
cd /Users/light0/DEV/infra/infra-bootstrap
eval "$(op signin)"
B2_APPLICATION_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET=immich-3q-backup \
  bash 60_apps/immich/scripts/create-immich-b2-backup-op-item.sh
bash 60_apps/immich/scripts/bootstrap-immich-secrets.sh --wait-b2 --trigger-data-backup
```

**5a PASS**：B2 驗證 + 06-24 03:00 第二次 pg 排程 Success → 可排 Phase 4 停機窗

### 可選 — Redis 密碼

```bash
bash 60_apps/immich/scripts/create-immich-redis-op-item.sh
bash 60_apps/immich/scripts/bootstrap-immich-secrets.sh --rollout-redis
```

### Phase 1 強化（deploy 完成 · Redis 待 item）

→ [agent-prompts/phase-1-hardening.md](./agent-prompts/phase-1-hardening.md)

probes ✅ · NetworkPolicy ✅ · Redis 密碼待 `Immich-Redis` item

### P2 可選

- album reconcile（stale 27 / missing 123）
- Similar images eval
- LINE Grafana / V1.1 vision

---

## 驗證指令（日常維運）

```bash
cd /Users/light0/DEV/immich-apps
eval "$(./scripts/dev/load-env-from-op.sh)"

./scripts/photo-sync/tier-policy-status.sh
./scripts/photo-sync/immich-reconcile.sh
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
```

---

## 🔗 相關

- [Agent prompts 執行狀態](./PROGRESS_TRACKING.md#agent-prompts-執行狀態文件-vs-cluster)
- [專案收尾評估](./PROGRESS_TRACKING.md#-專案收尾評估2026-06-22--更新)
- [agent-prompts/orchestrator.md](./agent-prompts/orchestrator.md)
