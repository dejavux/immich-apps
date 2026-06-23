# Immich Grafana Dashboard 規格（Phase 5b）

**狀態**：JSON 已 provision（`infra-bootstrap` ConfigMap）  
**最後更新**：2026-06-23

---

## Dashboard 概要

| 項目 | 值 |
| ------ | ----- |
| 建議 UID | `immich-ops` |
| 建議標題 | Immich Ops |
| Folder | Applications |
| 資料來源 | Prometheus（`monitoring` namespace） |

---

## Panel 規格

### Row 1 — Server SLO

| Panel | 類型 | PromQL / 說明 |
| ------- | ------ | ---------------- |
| Server Up | Stat | `up{job="immich-server-metrics"}` 或 `kube_pod_status_ready{namespace="immich",pod=~"immich-server.*"}` |
| API Ping | Stat | `probe_success`（若已設外部探測） |
| Assets (info) | Text | 手動或 Immich API；metric 若可用：`immich_assets_total` |

### Row 2 — Immich Prometheus metrics（port 8081）

Immich server 已 annotate `prometheus.io/scrape: "true"` port `8081` path `/metrics`。

| Panel | 類型 | 範例 PromQL |
| ------- | ------ | ------------- |
| HTTP request rate | Graph | `rate(http_requests_total{namespace="immich"}[5m])` |
| HTTP 5xx rate | Graph | `rate(http_requests_total{namespace="immich",status=~"5.."}[5m])` |
| Request duration p95 | Graph | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{namespace="immich"}[5m]))` |
| ML queue / jobs | Graph | `immich_jobs_*`（以實際 `/metrics` 輸出為準） |

**建立前**：`kubectl port-forward -n immich svc/immich-server-metrics 8081:8081` → `curl localhost:8081/metrics | head` 確認 metric 名稱。

### Row 3 — Backup

| Panel | 類型 | PromQL |
| ------- | ------ | -------- |
| PG backup last success | Stat | `time() - kube_job_status_completion_time{namespace="immich",job_name=~"immich-pg-backup.*"}` |
| Data backup last success | Stat | 同上 `immich-data-backup` |
| Backup job failed | Alert list | 見 `prometheus-rules.yaml` `ImmichBackupJobFailed` |

### Row 4 — LINE Bot（選用）

| Panel | 類型 | 說明 |
| ------- | ------ | ------ |
| Upload success rate | Graph | `line_bot_upload_success_total / line_bot_upload_total`（helm `/metrics`） |
| Search latency p95 | Graph | histogram from line-bot metrics |
| 5xx rate | Graph | `rate(http_requests_total{app="immich-line-bot",status=~"5.."}[5m])` |

---

## 匯入步驟

### 自動（建議）

ConfigMap `grafana-dashboards` 內含 `immich-ops-dashboard.json`：

```bash
kubectl apply -f infra-bootstrap/70_monitoring/manifests/platform/grafana/grafana-all-dashboards.yaml
kubectl rollout restart deployment/grafana -n monitoring
```

Deep link：`https://grafana.3q.fi/d/immich-ops/immich-ops`

### 手動

1. Grafana → Dashboards → New → Import → 貼上 JSON（見 infra-bootstrap ConfigMap key `immich-ops-dashboard.json`）。
2. UID 設為 `immich-ops`。

---

## 告警（已加入 prometheus-rules）

見 `infra-bootstrap/70_monitoring/manifests/platform/prometheus/prometheus-rules.yaml` 群組 `immich.rules`：

- `ImmichServerPodNotReady`
- `ImmichBackupJobFailed`
- `ImmichLineBotHighErrorRate`（需 line-bot metrics）

Telegram 路由沿用 Alertmanager `bot_token_file` / `chat_id_file`（vault `Infra-CI` / `Monitoring-Telegram-Bot`）。

---

## 相關

- [phase-5b-monitoring.md](../../../00_planning/agent-prompts/phase-5b-monitoring.md)
- [K8S_DEPLOYMENT.md](../K8S_DEPLOYMENT.md)
