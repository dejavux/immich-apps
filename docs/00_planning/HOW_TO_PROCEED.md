# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-30  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**路線圖**: [BACKLOG.md §下一階段路線圖](./BACKLOG.md#下一階段路線圖2026-06-28)  
**Gate 狀態**: [agent-prompts/GATE_STATUS.md](./agent-prompts/GATE_STATUS.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
| ------ | ------ |
| **Immich Enhancement** | ✅ **結案** |
| LINE Bot git | 見 `git rev-parse --short HEAD` |
| LINE Bot cluster | 見 `make verify-deploy` |
| **使用者驗收** | ✅ **2026-06-29** — OA icon 上傳 · 搜尋重測（小蕊哭／2年前／Disney） |
| **Immich Ops** | 5a **PASS** · 5b **~95%** · Phase 4 ✅ **COMPLETE** |

```bash
make verify-deploy   # 比對 git SHA vs cluster image tag
```

---

## 🔴 本週優先（P0）

1. **`make release`** → `make verify-deploy` PASS → LINE Rich Menu 標籤實機確認（找照片／上傳教學／使用說明）
2. **Ops W2** — 追蹤 rsync：`ssh delta.3q.fi 'du -sh .../mac-studio/*'`（2026-06-28：**63G/146G** local · **17G/18G** icloud）
3. **Phase 5b** — 確認 Telegram smoke 3 條告警

### Rich Menu 更新（維運）

```bash
python3 scripts/line-bot/generate-rich-menu.py
eval "$(./scripts/dev/load-env-from-op.sh)"
bash scripts/line-bot/setup-rich-menu.sh
```

---

## ✅ Wave W1 — Phase 5a（PASS）

→ [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

| 項目 | 狀態 |
| ------ | ------ |
| pg 還原演練 | ✅ 13759 = prod |
| pg 排程 2/2 | ✅ `29702580`（06-23 03:00）· `29704020`（06-24 03:00） |
| NFS data 備份 | ✅ **Complete**（`immich-data-backup-nfs-test-1782176320` · **157.8G**） |
| B2 | ⏭️ 已廢止並刪除 OP item |

---

## Wave W4 — Phase 4 SSD ✅ COMPLETE（2026-06-24）

Postgres 已遷至 lama NVMe `/nvme/immich-postgres`；upload 仍 HDD。詳見 [STORAGE_MIGRATION.md](../20_guides/infra/runbooks/STORAGE_MIGRATION.md)。

**驗收**：`asset` **13763** · ping **pong** · 停機 ~5 分鐘。

---

## Ops W2 — Mac library → delta **HDD**（~50%）

→ [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)

**前置**：Phase 4 ✅ · 5a PASS ✅

**SSOT**：`delta.3q.fi:/mnt/volume1/nfs-models/photos-backup/mac-studio/`（13T HDD · **非** NVMe `/home/nfs-storage`）

| 項目 | 狀態 |
| ------ | ------ |
| 路徑決策 NVMe→HDD | ✅ 2026-06-25（PR #31） |
| delta HDD 目錄 + chown | ✅ |
| dry-run | ✅ ~146G + ~18G |
| 首輪 rsync | 🟡 **63G/146G** local · **17G/18G** icloud（2026-06-28） |
| NVMe 舊 partial 清理 | ✅ ~48G 釋放 |
| LaunchAgent | ✅ 已 `launchctl load`（週六 02:00） |
| checksum 抽樣 | 📋 rsync Complete 後 |

**追蹤首輪 rsync**：

```bash
tail -f ~/Library/Logs/immich-mac-backup/rsync-*.log
screen -r immich-mac-backup   # Ctrl+A D detach
ssh delta.3q.fi 'du -sh /mnt/volume1/nfs-models/photos-backup/mac-studio/*'
```

---

## 驗證 K8s 是否跑最新 image

```bash
make verify-deploy
# 或手動：
git rev-parse --short HEAD
kubectl get deploy immich-line-bot -n immich -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```

---

## Wave 5b — Grafana + 告警（~95%）

| 項目 | 狀態 |
| ------ | ------ |
| PrometheusRule `immich.rules` | ✅ |
| Grafana `immich-ops` ConfigMap | ✅ monitoring namespace |
| Caddy `grafana.3q.fi` | ✅ 改回 monitoring LoadBalancer `192.168.50.154` |
| Prometheus RBAC（kube-state-metrics scrape） | ✅ `prometheus-monitoring` ClusterRoleBinding |
| Deep link `/d/immich-ops` | ✅ kube + HTTP panels 有資料（2026-06-24） |
| Telegram 告警 smoke | 🟡 已重送 3 條（待使用者確認） |
| LINE Bot 專用 panel | 📋 P2 backlog |

```bash
open https://grafana.3q.fi/d/immich-ops
```

---

## 下一階段（摘要）

完整 18 項見 [BACKLOG.md §下一階段路線圖](./BACKLOG.md#下一階段路線圖2026-06-28)。

| 優先 | 方向 | 代表項 |
| ------ | ------ | ------ |
| **P1** | 產品體驗 | 國名 CLDR 自動化 · carousel 地點/人物標籤 · Web E2E 驗收 |
| **P2** | 平台 | Immich 升級 · Redis 密碼 · Similar images · LINE Grafana panel |
| **P3** | AI / 新場景 | 照片館對話助理 · Qwen vision · Photo Edit BFF · LIFF（defer） |

---

## 驗證指令

```bash
kubectl get cronjob,jobs -n immich -l component=backup --sort-by=.metadata.creationTimestamp
kubectl get pvc immich-backup-nfs-pvc -n immich
kubectl get deploy -n immich immich-redis immich-server
kubectl get configmap grafana-dashboards -n monitoring -o jsonpath='{.data}' | jq 'keys'
npm test
```
