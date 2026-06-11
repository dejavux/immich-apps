# Immich server Prometheus scrape（P2）

Immich 預設不暴露 metrics；需在 `immich-server` 設定：

```yaml
env:
  - name: IMMICH_TELEMETRY_INCLUDE
    value: "all"
ports:
  - containerPort: 8081
    name: metrics
```

Pod annotations（或 `immich-server-metrics` Service）：

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "8081"
prometheus.io/path: "/metrics"
```

參考：[Immich Monitoring](https://docs.immich.app/features/monitoring)

Manifest 已套用於 infra-bootstrap `60_apps/immich/immich-deployment.yaml`。
Cluster Prometheus 需能 scrape `immich` namespace（與 line-bot `/metrics` 相同機制）。
