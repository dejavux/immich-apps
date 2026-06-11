# immich-line-bot Helm Chart

Deploy LINE Bot to `immich` namespace.

## Prerequisites

- 1Password items in `Infra-Platform`（immich namespace Connect 授權範圍）: `Immich-LINE-Bot`, `Immich-API-Key`
- 若 items 在 `Infra-Apps`，先執行 `./scripts/sync-op-items-infra-platform.sh`
- 1Password Connect Operator watching `immich` namespace
- Image in `registry-internal.3q.fi/immich-line-bot:<tag>`
- Caddy + Route53 for `immich-bot.3q.fi` (see `docs/PHASE2_K8S_DEPLOYMENT.md`)

## Install

```bash
helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
  --namespace immich \
  --create-namespace \
  -f deploy/helm/immich-line-bot/values.yaml \
  -f deploy/helm/immich-line-bot/values-prod.yaml \
  --set image.tag=v0.1.0
```

## Verify

```bash
kubectl get pods,ingress -n immich -l app.kubernetes.io/name=immich-line-bot
curl -sS https://immich-bot.3q.fi/health
```

## LINE Webhook

```
https://immich-bot.3q.fi/webhook/line
```

### 原檔測試（file 訊息）

在 LINE 用 **「檔案」** 傳圖（勿用相簿「照片」）。Bot 以 `line-file` 模式上傳並保留檔名。

```bash
kubectl logs -n immich deployment/immich-line-bot -f \
  | grep -E 'Processing LINE media|Downloaded LINE content|Uploaded to Immich'
```

比對同一張圖：`source=line-file` 的 `bytes` 通常大於 `line-image`；Immich 時間軸用 webhook `event.timestamp`。
