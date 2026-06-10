# immich-line-bot Helm Chart

Deploy LINE Bot to `immich` namespace.

## Prerequisites

- 1Password items in `Infra-Apps`: `Immich-LINE-Bot`, `Immich-API-Key`
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
