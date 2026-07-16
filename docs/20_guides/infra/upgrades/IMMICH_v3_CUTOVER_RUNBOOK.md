# Immich v3.0.0 Production Cutover Runbook

> **窗口**：**2026-08-09（六）02:00–05:00 HKT**（備選 2026-08-16）  
> **前提**：§7 DoD 中需 v3 server 的項目完成，或經風險接受後於窗口內首次驗證。  
> **勿**於 spike 未完成或無 pg_dump 前執行。  
> **Spike SSOT**：[IMMICH_v3.0_SPIKE.md](./IMMICH_v3.0_SPIKE.md)

---

## 日曆提醒（建議寫入家族 / Ops 日曆）

| 事件 | 時間（HKT） | 說明 |
| ------ | ------------- | ------ |
| **T−7d 確認** | 2026-08-02 02:00 | 執行 `v3-cutover-precheck.sh`；確認 §10.6 阻擋項 |
| **T−24h 公告** | 2026-08-08 02:00 | 家族 LINE：維護 02:00–05:00、上傳/搜尋暫停 |
| **T−2h pg_dump** | 2026-08-09 00:00 | `OUT=immich-pg-backup-20260809.sql bash scripts/infra/pg-dump-precheck.sh` |
| **T−30m baseline** | 2026-08-09 01:30 | `v3-cutover-precheck.sh`（含 v2.7.5 smoke） |
| **維護窗口** | **2026-08-09 02:00–05:00** | 本 runbook 分鐘表 |
| **T+24h 驗收** | 2026-08-10 02:00 | §10.5 窗口後檢查 |

---

## 值班與聯絡

| 角色 | 負責 |
| ------ | ------ |
| Ops | pg_dump、kubectl、server/ML rollout、job 觀察 |
| Apps | LINE Bot deploy、smoke E2E、rollback Bot 映像 |
| 決策 | DB restore（僅 migration 不可逆且 v2.7.5 無法啟動時） |

**Rollback manifest 就緒路徑**：`deploy/manifests/immich-deployment.yaml`（v2.7.5 pin 已驗證 §8）

---

## 分鐘表（2026-08-09 HKT）

時刻為目標；實際以 rollout / migration 耗時為準。

| 時刻 | Δ | 步驟 | 指令 / 動作 | 通過標準 |
| ------ | --- | ------ | ------------- | ---------- |
| **01:30** | T−30m | Baseline | `eval "$(./scripts/dev/load-env-from-op.sh)"` · `bash scripts/infra/v3-cutover-precheck.sh` | 全綠；version **2.7.5** |
| **02:00** | T+0 | 開始窗口 | 家族公告「維護開始」 | — |
| **02:00** | T+0 | pg_dump | `OUT=immich-pg-backup-20260809.sql bash scripts/infra/pg-dump-precheck.sh` | header + CREATE TABLE |
| **02:05** | T+5m | Baseline 記錄 | `curl …/api/server/version` · `…/api/jobs` · `kubectl get deploy -n immich -o wide` | 寫入維護筆記 |
| **02:10** | T+10m | 更新 manifest | `deploy/manifests/immich-deployment.yaml` → `v3.0.0`（**僅** server + ML） | diff 僅映像 tag |
| **02:15** | T+15m | Apply | `kubectl apply -f deploy/manifests/immich-deployment.yaml` | apply OK |
| **02:15** | T+15m | Rollout server | `kubectl rollout status deploy/immich-server -n immich --timeout=30m` | Ready |
| **02:20** | T+20m | Rollout ML | `kubectl rollout status deploy/immich-machine-learning -n immich --timeout=30m` | Ready |
| **02:20–03:00** | T+20–60m | Migration log | `kubectl logs -n immich deploy/immich-server --tail=200 -f` | 無不可恢復錯誤 |
| **03:00** | T+60m | **中止點 R2** | `curl …/api/server/version` | **major=3**；否則 → Rollback |
| **03:05** | T+65m | Web UI | 瀏覽器登入 `https://immich.3q.fi` | 無 5xx |
| **03:10** | T+70m | Deploy LINE Bot | `make release` 後更新 Helm values-prod image tag · deploy | rollout Ready |
| **03:15** | T+75m | API smoke | `bash scripts/line-bot/smoke-photo-search-e2e.sh --person 小蕊` | 全綠（**對 v3**） |
| **03:30** | T+90m | LINE 手動 | 上傳照片/原檔/影片 · 搜尋 · carousel（§ smoke 步驟 7） | 連續 2 次失敗 → R5 rollback |
| **03:45** | T+105m | Job 觀察 | `curl …/api/jobs` 每 15m | 佇列下降 |
| **04:30** | T+150m | photo-sync | `./scripts/photo-sync/immich-sync.sh --dry-run` 各 library | 0 unexpected errors |
| **04:45** | T+165m | 收尾 | 更新 §7 DoD · §8 pin 日期 · 家族公告「恢復」 | committed |
| **05:00** | T+180m | 窗口結束 | — | — |

---

## Rollback（≤30 min）

**觸發**：§10.4 R1–R5（rollout 失敗、40 min 後 version ≠ 3.0.0、ping 失敗、smoke 失敗、LINE 手動 2 次失敗）

```bash
# 1. Pin server/ML 回 v2.7.5
kubectl apply -f deploy/manifests/immich-deployment.yaml   # 確認 yaml 為 v2.7.5
kubectl rollout status deploy/immich-server -n immich --timeout=20m
kubectl rollout status deploy/immich-machine-learning -n immich --timeout=20m

# 2. 確認 API
curl -fsS https://immich.3q.fi/api/server/version
curl -fsS https://immich.3q.fi/api/server/ping

# 3. Rollback LINE Bot 至維護前 tag（例：cafde37）
# helm upgrade / kubectl set image …

# 4. Smoke 對 v2.7.5
eval "$(./scripts/dev/load-env-from-op.sh)"
bash scripts/line-bot/smoke-photo-search-e2e.sh --person 小蕊
```

**DB restore**：僅當 v3 migration 已寫入不可逆變更且 v2.7.5 server 無法啟動時，依 [IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md) A2 restore；預設不 restore。

---

## 窗口前自動化（可提前執行）

```bash
cd /Users/light0/DEV/immich-apps
eval "$(./scripts/dev/load-env-from-op.sh)"

# 完整 pre-check（含 pg_dump 驗證、v2.7.5 smoke）
bash scripts/infra/v3-cutover-precheck.sh

# 僅 pg_dump 演練（不保留檔案）
bash scripts/infra/pg-dump-precheck.sh

# 正式備份（T−2h 或窗口內）
OUT=immich-pg-backup-$(date +%Y%m%d).sql bash scripts/infra/pg-dump-precheck.sh
```

---

## 相關文件

| 文件 | 用途 |
| ------ | ------ |
| [IMMICH_v3.0_SPIKE.md](./IMMICH_v3.0_SPIKE.md) | Spike、DoD §7、阻擋項 §10.6 |
| [IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md) | pg_dump A2、VectorChord A3 |
| `scripts/line-bot/smoke-photo-search-e2e.sh` | API + thumbnail smoke |
| `scripts/infra/v3-cutover-precheck.sh` | 窗口前一鍵檢查 |
