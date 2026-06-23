# Observability 路線圖（Immich · 全平台）

**最後更新**：2026-06-23  
**狀態**：討論結論 — **現況維持 by-app**；統一 SSOT **延後**獨立整合

---

## 現況（infra-bootstrap `70_monitoring/`）

| 層 | 做法 |
| ---- | ------ |
| **Prometheus** | 單一叢集 Prometheus；各 app 以 `PrometheusRule` 群組追加（例 `immich.rules`） |
| **Grafana** | 單一 Grafana；dashboard JSON 併入 `grafana-dashboards` ConfigMap（例 `immich-ops`） |
| **告警** | 共用 Alertmanager → Telegram（`Infra-CI` / Monitoring-Telegram-Bot） |

這是 **「統一平台 + by-app 規則／面板」** 混合模式，不是每個 app 一套 Prometheus。

---

## 建議（短期 → 長期）

### 短期（Immich Ops 收尾）

- ✅ 維持：`immich.rules` + `immich-ops` dashboard 放在 **infra-bootstrap**
- ✅ Runbook／規格留在 **immich-apps** `docs/20_guides/infra/monitoring/`
- 不在 immich-apps repo 內再架第二套 Prometheus

### 中期（其他 app 上線時）

每 app 交付：

1. `PrometheusRule` YAML 片段（或獨立檔 + kustomize patch）
2. Grafana dashboard JSON（ConfigMap key 或獨立檔）
3. immich-apps 式 **SPEC.md**（panel PromQL 文件化）

命名：`{app}-ops` UID、`{app}.rules` rule group。

### 長期（獨立 Observability 整合 · 延後）

當 app 數量 >3 或 dashboard 難維護時，再開專案：

- 單一 **dashboard 目錄**（或 Grafana folder-as-code）
- 統一 label 規約（`service`, `team`, `tier`）
- 可選：Mimir/Loki 多租戶、SLO 範本

**不阻塞** Immich Phase 5b 或 content-studio 上線。

---

## 決策摘要

| 選項 | 建議 |
| ------ | ------ |
| By-app 規則 + 中央 Prometheus/Grafana | ✅ **現況，繼續** |
| 每 app 獨立 Prometheus | ❌ 過重 |
| 立刻全平台 observability 重構 | ⏸️ **延後**至 backlog 獨立項 |

---

## 相關

- [IMMICH_DASHBOARD_SPEC.md](./IMMICH_DASHBOARD_SPEC.md)
- `infra-bootstrap/70_monitoring/manifests/platform/prometheus/prometheus-rules.yaml`
- `infra-bootstrap/70_monitoring/manifests/platform/grafana/grafana-all-dashboards.yaml`
