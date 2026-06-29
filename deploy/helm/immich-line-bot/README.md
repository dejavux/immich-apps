# immich-line-bot Helm Chart

Deploy LINE Bot to `immich` namespace.

## Prerequisites

- 1Password items in `Infra-Platform`（immich namespace Connect 授權範圍）: `Immich-LINE-Bot`, `Immich-API-Key`
- 若 items 在 `Infra-Apps`，先執行 `./scripts/sync-op-items-infra-platform.sh`
- 1Password Connect Operator watching `immich` namespace
- Image in `registry-internal.3q.fi/immich-line-bot:<tag>`
- Caddy + Route53 for `immich-bot.3q.fi` (see `docs/20_guides/infra/K8S_DEPLOYMENT.md`)

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

## LINE OA assets

| 用途 | 路徑 | 規格 |
| ------ | ------ | ------ |
| OA 大頭貼 | `deploy/line-bot/line-bot-icon-1040x1040.png` | 1040×1040 · **已上傳** LINE Developers Console（2026-06-29） |
| Rich Menu 橫幅 | `deploy/line-bot/rich-menu.jpg` | 2500×843（compact）；三等分點擊區見 `src/line-bot/services/rich-menu.ts` |

**Rich Menu 標題**（找照片／上傳教學／使用說明）必須畫在 JPEG 內；`action.label` 僅供無障礙／部分客戶端。

```bash
python3 scripts/line-bot/generate-rich-menu.py   # 重製橫幅（需 CJK 字型）
eval "$(./scripts/dev/load-env-from-op.sh)"
bash scripts/line-bot/setup-rich-menu.sh         # 建立選單 + 上傳圖片 + 設為預設
```

部署時若 `LINE_RICH_MENU_AUTO_SETUP=true`，Pod 啟動也會呼叫 `ensureDefaultRichMenu`（見 `src/line-bot/index.ts`）。

### 原檔測試（file 訊息）

在 LINE 用 **「檔案」** 傳圖（勿用相簿「照片」）。Bot 以 `line-file` 模式上傳並保留檔名。

```bash
kubectl logs -n immich deployment/immich-line-bot -f \
  | grep -E 'Processing LINE media|Downloaded LINE content|Uploaded to Immich'
```

比對同一張圖：`source=line-file` 的 `bytes` 通常大於 `line-image`；Immich 時間軸用 webhook `event.timestamp`。
