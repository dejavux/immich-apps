# Phase 1 — Immich K8s 基礎設施強化（剩餘 50%）

> Subagent prompt：補齊運維硬化項。**不包含** Postgres SSD 遷移（屬 Phase 4）。

---

## 目標

補齊運維硬化項，**不**包含 Postgres SSD 遷移（屬 Phase 4）。  
完成後 Phase 1 標 ~90%（SSD 相關留 Phase 4）。

---

## 依賴

- **前置**：Immich v2.7.5 已部署（✅）
- **可平行**：Phase 5a 設計/開發（manifest PR）
- **deploy 錯開**：與 Phase 5 CronJob 首次 deploy、Phase 4 停機窗勿同日
- **硬阻擋**：Phase 3.5 gate 未 PASS 時僅允許 **PR/文檔**，不 deploy prod

---

## Multi-task 可平行子任務

| ID | 任務 | Repo | 可平行 |
|----|------|------|--------|
| 1-A | liveness/readiness probes（server/postgres/redis/ml） | infra-bootstrap | ✅ |
| 1-B | Redis/Valkey 密碼 + Secret 同步 | infra-bootstrap + 1Password | 須在 1-A 後 deploy |
| 1-C | NetworkPolicy（`immich` namespace） | infra-bootstrap | ✅ |
| 1-D | `immich-configmap.yaml` 清理或文檔化 | infra-bootstrap + docs | ✅ |

---

## 主要路徑

- `infra-bootstrap/60_apps/immich/immich-deployment.yaml`
- `infra-bootstrap/60_apps/immich/deploy-immich.sh`
- `infra-bootstrap/60_apps/immich/immich-configmap.yaml`
- `immich-apps/docs/80_history/IMMICH_ENHANCEMENT_PROJECT.md`（對照待辦）
- `immich-apps/docs/20_guides/infra/K8S_DEPLOYMENT.md`

---

## 執行步驟

1. 讀現有 deployment：確認 **無** probes、Redis `REDIS_PASSWORD=""`（目前狀態）。
2. 為 `immich-server`、`immich-postgres`、`immich-redis`、`immich-machine-learning` 加合適 probe（Immich 官方建議 endpoint）。
3. Redis：產生密碼 → 1Password item → 更新 deployment env + redis `requirepass`；同步 server/ml env。
4. NetworkPolicy：允許 ingress（Caddy/LB）、cluster 內 immich→postgres/redis/ml、deny 其餘 ingress。
5. `immich-configmap.yaml`：移除未掛載的 dead config，或於 README 註明用途。
6. 撰寫或更新 runbook：`immich-apps/docs/20_guides/infra/`。
7. **不要**改 postgres PV hostPath（留 Phase 4）。
8. **不要**在本 Phase 做 PostgreSQL → NVMe 遷移。

---

## 驗收標準

- [ ] `kubectl rollout status -n immich` 全 deployment Ready
- [ ] `https://immich.3q.fi` 可登入、上傳一張測試圖
- [ ] probe 設定符合 K8s 最佳實踐（可選：staging 故意錯誤測試後還原）
- [ ] Redis 無密碼連線被拒絕（1-B 完成後）
- [ ] `PROGRESS_TRACKING.md` Phase 1 進度更新

---

## 禁止

- 修改 postgres `hostPath` / PV（Phase 4）
- 與 Phase 5a 首次 CronJob deploy 同日 rollout 整個 `immich` namespace（除非使用者批准）
- commit 明文 Redis 密碼

---

## Handoff

- PR 連結 + manifest diff 摘要
- 註明：**已 deploy prod** 或 **僅 PR 待 merge**
- 若已 deploy：probe 與 Redis 驗收命令輸出
