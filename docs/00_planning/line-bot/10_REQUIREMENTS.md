# Phase 2: LINE Bot 自動上傳

**狀態**: 📋 規劃完成，準備實作
**預估時間**: 3-5 天
**優先級**: **P0 - 最高優先（優先於 Photo Sync）**
**負責人**: Infrastructure Team

---

## 🎯 目標

實現從 LINE 轉發照片後自動上傳到 Immich，並使用 AI 自動產生描述、標籤、地點資訊。

### 核心功能

1. **LINE Webhook**: 接收轉發的照片訊息
2. **自動上傳**: 上傳到 Immich Server
3. **AI 標註**:
   - **Immich ML (CLIP)**: 自動物件辨識、場景分類
   - **OpenAI GPT-4V**: 繁體中文詳細描述
4. **地理資訊**: EXIF GPS → 反向地理編碼（Immich 內建）
5. **即時回覆**: 5 秒內回覆用戶上傳狀態

---

## 🏗️ 架構設計

### 流程圖

```yaml
┌──────────────────────┐
│    LINE User         │
│  (Forward Photo 📸)  │
└──────────┬───────────┘
           │ HTTPS POST
           ↓
┌──────────────────────────────────────┐
│  https://immich-bot.3q.fi           │
│  (Ingress + cert-manager TLS)       │
└──────────┬───────────────────────────┘
           │
           ↓
┌──────────────────────────────────────┐
│     immich-line-bot Service         │
│     (ClusterIP, Port 80)            │
└──────────┬───────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────┐
│        immich-line-bot Pod                  │
│  ┌──────────────────────────────────────┐  │
│  │  1. Receive LINE Webhook             │  │
│  │     - Verify signature               │  │
│  │     - Parse image message            │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │  2. Download Image                   │  │
│  │     - LINE Message API               │  │
│  │     - Get image binary               │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │  3. Upload to Immich                 │  │
│  │     - immich-server:2283 (internal)  │  │
│  │     - POST /api/asset/upload         │  │
│  │     - Get asset ID                   │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │  4. Wait for ML Processing           │  │
│  │     - Poll Immich API                │  │
│  │     - Check CLIP completion          │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │  5. Generate Description (GPT-4V)    │  │
│  │     - OpenAI Vision API              │  │
│  │     - 繁體中文 100 字內               │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │  6. Update Asset Metadata            │  │
│  │     - PUT /api/asset/:id             │  │
│  │     - description, tags, etc.        │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │  7. Reply to User                    │  │
│  │     - "✅ 已上傳到 Immich!"           │  │
│  │     - Show preview of description    │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           │
           ├─→ immich-server:2283 (upload, metadata)
           ├─→ OpenAI API (GPT-4V description)
           └─→ LINE Reply API (user notification)
```

---

## 💻 技術實作

### 技術棧

- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript
- **Framework**: Express.js
- **LINE SDK**: `@line/bot-sdk`
- **HTTP Client**: `axios`
- **Logging**: `pino`
- **Metrics**: `prom-client` (Prometheus)

### 專案結構

```text
immich-line-bot/
├── src/
│   ├── index.ts                    # Express server entry
│   ├── config/
│   │   ├── environment.ts          # 環境變數
│   │   └── constants.ts            # 常數定義
│   ├── handlers/
│   │   ├── line-webhook.ts         # LINE webhook handler
│   │   ├── immich-upload.ts        # Immich API wrapper
│   │   ├── ai-annotation.ts        # GPT-4V integration
│   │   └── error-handler.ts        # 錯誤處理
│   ├── utils/
│   │   ├── logger.ts               # Pino logger
│   │   ├── metrics.ts              # Prometheus metrics
│   │   └── retry.ts                # Retry logic
│   └── types/
│       ├── line.ts                 # LINE types
│       └── immich.ts               # Immich types
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

### 核心程式碼

#### 1. Webhook Handler

```typescript
// src/handlers/line-webhook.ts
import { Client, middleware, WebhookEvent, MessageEvent } from '@line/bot-sdk';
import { uploadToImmich } from './immich-upload';
import { generateDescription } from './ai-annotation';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

const lineClient = new Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function handleWebhook(event: WebhookEvent) {
  if (event.type !== 'message' || event.message.type !== 'image') {
    return;
  }

  const startTime = Date.now();
  metrics.webhookReceived.inc();

  try {
    await handleImageMessage(event as MessageEvent);
    metrics.uploadSuccess.inc();
    metrics.uploadDuration.observe((Date.now() - startTime) / 1000);
  } catch (error) {
    logger.error({ error, event }, 'Failed to process image');
    metrics.uploadFailure.inc();

    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 照片上傳失敗，請稍後再試',
    });
  }
}

async function handleImageMessage(event: MessageEvent) {
  const userId = event.source.userId || 'unknown';
  const messageId = event.message.id;

  logger.info({ userId, messageId }, 'Processing image upload');

  // 1. 下載 LINE 圖片
  const imageStream = await lineClient.getMessageContent(messageId);
  const imageBuffer = await streamToBuffer(imageStream);

  // 2. 上傳到 Immich
  const asset = await uploadToImmich(imageBuffer, {
    deviceId: `LINE-${userId}`,
    deviceAssetId: messageId,
  });

  logger.info({ assetId: asset.id }, 'Asset uploaded to Immich');

  // 3. 等待 Immich ML 處理（CLIP）
  await waitForMLProcessing(asset.id);

  // 4. 使用 GPT-4V 產生描述
  const description = await generateDescription(imageBuffer);

  // 5. 更新 Immich Metadata
  await updateImmichAsset(asset.id, {
    description,
    tags: ['line-bot', 'auto-upload', new Date().toISOString().split('T')[0]],
  });

  logger.info({ assetId: asset.id, description }, 'Asset metadata updated');

  // 6. 回覆用戶
  await lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `✅ 照片已上傳到 Immich!\n\n📝 ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}`,
  });
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
```

#### 2. Immich API Wrapper

```typescript
// src/handlers/immich-upload.ts
import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

const IMMICH_SERVER_URL = process.env.IMMICH_SERVER_URL || 'http://immich-server:2283';
const IMMICH_API_KEY = process.env.IMMICH_API_KEY!;

interface ImmichAsset {
  id: string;
  deviceAssetId: string;
  deviceId: string;
  type: 'IMAGE' | 'VIDEO';
  originalPath: string;
  status: 'UPLOAD_COMPLETE' | 'PROCESSING' | 'READY';
}

export async function uploadToImmich(
  imageBuffer: Buffer,
  deviceInfo: { deviceId: string; deviceAssetId: string }
): Promise<ImmichAsset> {
  const formData = new FormData();
  formData.append('assetData', imageBuffer, {
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
  });
  formData.append('deviceId', deviceInfo.deviceId);
  formData.append('deviceAssetId', deviceInfo.deviceAssetId);
  formData.append('fileCreatedAt', new Date().toISOString());
  formData.append('fileModifiedAt', new Date().toISOString());

  const response = await retryWithBackoff(
    () =>
      axios.post(`${IMMICH_SERVER_URL}/api/asset/upload`, formData, {
        headers: {
          'x-api-key': IMMICH_API_KEY,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }),
    { maxRetries: 3, baseDelay: 1000 }
  );

  return response.data;
}

export async function waitForMLProcessing(assetId: string, timeout = 30000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const asset = await getAssetInfo(assetId);

    if (asset.status === 'READY') {
      logger.info({ assetId }, 'ML processing complete');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  logger.warn({ assetId }, 'ML processing timeout');
}

async function getAssetInfo(assetId: string): Promise<ImmichAsset> {
  const response = await axios.get(`${IMMICH_SERVER_URL}/api/asset/${assetId}`, {
    headers: { 'x-api-key': IMMICH_API_KEY },
  });
  return response.data;
}

export async function updateImmichAsset(
  assetId: string,
  metadata: { description?: string; tags?: string[] }
): Promise<void> {
  await axios.put(
    `${IMMICH_SERVER_URL}/api/asset/${assetId}`,
    metadata,
    {
      headers: { 'x-api-key': IMMICH_API_KEY },
    }
  );
}
```

#### 3. GPT-4V Integration

```typescript
// src/handlers/ai-annotation.ts
import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export async function generateDescription(imageBuffer: Buffer): Promise<string> {
  const base64Image = imageBuffer.toString('base64');

  const response = await retryWithBackoff(
    () =>
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '請用繁體中文描述這張照片。包含：\n1. 場景（室內/室外）\n2. 主要物件\n3. 氛圍或情緒\n4. 可能的地點或場合\n\n限制：100 字內，簡潔生動。',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                    detail: 'low', // 降低成本
                  },
                },
              ],
            },
          ],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      ),
    { maxRetries: 2, baseDelay: 1000 }
  );

  const description = response.data.choices[0].message.content.trim();
  logger.info({ description }, 'Generated description with GPT-4V');

  return description;
}
```

---

## 🔐 憑證管理

### 1Password Items

需在 1Password `Infra-Apps` vault 建立以下 items:

#### Item 1: Immich-LINE-Bot

```yaml
Title: Immich-LINE-Bot
Vault: Infra-Apps
Fields:
  - channel-secret: <LINE Channel Secret>
  - access-token: <LINE Channel Access Token>
```

#### Item 2: Immich-API-Key

```yaml
Title: Immich-API-Key
Vault: Infra-Apps
Fields:
  - api-key: <Immich API Key>
```

#### Item 3: OpenAI-API-Key

```yaml
Title: OpenAI-API-Key
Vault: Infra-Apps
Fields:
  - api-key: <OpenAI API Key>
```

### 1Password Operator Manifest

```yaml
# 60_apps/immich/line-bot/1password-items.yaml
---
apiVersion: onepassword.com/v1
kind: OnePasswordItem
metadata:
  name: line-bot-credentials
  namespace: immich
spec:
  itemPath: "vaults/Infra-Apps/items/Immich-LINE-Bot"
---
apiVersion: onepassword.com/v1
kind: OnePasswordItem
metadata:
  name: immich-api-credentials
  namespace: immich
spec:
  itemPath: "vaults/Infra-Apps/items/Immich-API-Key"
---
apiVersion: onepassword.com/v1
kind: OnePasswordItem
metadata:
  name: openai-credentials
  namespace: immich
spec:
  itemPath: "vaults/Infra-Apps/items/OpenAI-API-Key"
```

---

## 🚢 Kubernetes 部署

### Deployment

```yaml
# 60_apps/immich/line-bot/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: immich-line-bot
  namespace: immich
  labels:
    app: immich-line-bot
spec:
  replicas: 2  # 高可用
  selector:
    matchLabels:
      app: immich-line-bot
  template:
    metadata:
      labels:
        app: immich-line-bot
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: line-bot
          image: registry.3q.fi/immich-line-bot:latest
          imagePullPolicy: Always
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "3000"
            - name: LOG_LEVEL
              value: info
            - name: LINE_CHANNEL_SECRET
              valueFrom:
                secretKeyRef:
                  name: line-bot-credentials
                  key: channel-secret
            - name: LINE_CHANNEL_ACCESS_TOKEN
              valueFrom:
                secretKeyRef:
                  name: line-bot-credentials
                  key: access-token
            - name: IMMICH_API_KEY
              valueFrom:
                secretKeyRef:
                  name: immich-api-credentials
                  key: api-key
            - name: IMMICH_SERVER_URL
              value: "http://immich-server:2283"
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: openai-credentials
                  key: api-key
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2
---
apiVersion: v1
kind: Service
metadata:
  name: immich-line-bot
  namespace: immich
  labels:
    app: immich-line-bot
spec:
  selector:
    app: immich-line-bot
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
  type: ClusterIP
```

### Ingress

```yaml
# 60_apps/immich/line-bot/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: immich-line-bot-ingress
  namespace: immich
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"  # LINE 圖片上限
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - immich-bot.3q.fi
      secretName: immich-line-bot-tls
  rules:
    - host: immich-bot.3q.fi
      http:
        paths:
          - path: /webhook/line
            pathType: Prefix
            backend:
              service:
                name: immich-line-bot
                port:
                  number: 80
```

---

## 📊 監控指標

### Prometheus Metrics

```typescript
// src/utils/metrics.ts
import { Registry, Counter, Histogram } from 'prom-client';

export const register = new Registry();

export const metrics = {
  webhookReceived: new Counter({
    name: 'immich_line_bot_webhook_requests_total',
    help: 'Total number of LINE webhook requests',
    labelNames: ['event_type'],
    registers: [register],
  }),

  uploadSuccess: new Counter({
    name: 'immich_line_bot_upload_success_total',
    help: 'Total number of successful uploads',
    registers: [register],
  }),

  uploadFailure: new Counter({
    name: 'immich_line_bot_upload_failure_total',
    help: 'Total number of failed uploads',
    labelNames: ['error_type'],
    registers: [register],
  }),

  uploadDuration: new Histogram({
    name: 'immich_line_bot_upload_duration_seconds',
    help: 'Duration of upload processing',
    buckets: [0.5, 1, 2, 3, 5, 10, 15, 30],
    registers: [register],
  }),

  aiAnnotationDuration: new Histogram({
    name: 'immich_line_bot_ai_annotation_duration_seconds',
    help: 'Duration of AI annotation (GPT-4V)',
    buckets: [1, 2, 3, 5, 8, 10, 15],
    registers: [register],
  }),
};
```

### Grafana Dashboard 指標

| 指標 | 類型 | 說明 |
|------|------|------|
| `immich_line_bot_webhook_requests_total` | Counter | Webhook 請求總數 |
| `immich_line_bot_upload_success_total` | Counter | 上傳成功次數 |
| `immich_line_bot_upload_failure_total` | Counter | 上傳失敗次數 |
| `immich_line_bot_upload_duration_seconds` | Histogram | 上傳處理延遲 |
| `immich_line_bot_ai_annotation_duration_seconds` | Histogram | AI 標註延遲 |

**成功率計算**:

```promql
rate(immich_line_bot_upload_success_total[5m]) /
(rate(immich_line_bot_upload_success_total[5m]) + rate(immich_line_bot_upload_failure_total[5m])) * 100
```

---

## 🚀 部署步驟

### Step 1: 建立 LINE Bot Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. Create Provider (如果還沒有)
3. Create Channel → **Messaging API**
4. 設定：
   - Channel name: `Immich Photo Bot`
   - Channel description: `自動上傳照片到 Immich`
   - Category: Utilities
5. 在 Channel 設定頁面：
   - **Webhook URL**: `https://immich-bot.3q.fi/webhook/line`
   - **Use webhook**: ON
   - **Auto-reply messages**: OFF
   - **Greeting messages**: OFF
6. 取得憑證：
   - **Channel Secret**: (Basic settings 頁面)
   - **Channel Access Token**: (Messaging API 頁面 → Issue)

### Step 2: 設定 1Password Items

在 1Password Desktop App 或 CLI 建立三個 items（見上方憑證管理章節）

### Step 3: 取得 Immich API Key

1. 登入 Immich Web UI: `https://immich.3q.fi`
2. Settings → API Keys → Create API Key
3. Name: `LINE Bot`
4. 複製 API Key 到 1Password `Immich-API-Key` item

### Step 4: 取得 OpenAI API Key

1. 登入 [OpenAI Platform](https://platform.openai.com/)
2. API keys → Create new secret key
3. Name: `Immich LINE Bot`
4. 複製 API Key 到 1Password `OpenAI-API-Key` item

### Step 5: 部署到 Kubernetes

```bash
cd 60_apps/immich/line-bot

# 1. 部署 1Password Items
kubectl apply -f 1password-items.yaml

# 2. 等待 Secrets 同步（約 30-60 秒）
kubectl get secret -n immich | grep -E "line-bot|immich-api|openai"

# 3. 部署 Deployment + Service
kubectl apply -f deployment.yaml

# 4. 部署 Ingress
kubectl apply -f ingress.yaml

# 5. 檢查狀態
kubectl get pods -n immich -l app=immich-line-bot
kubectl logs -n immich -l app=immich-line-bot --tail=50

# 6. 檢查 Ingress
kubectl get ingress -n immich immich-line-bot-ingress
```

### Step 6: 測試

1. 用手機加 LINE Bot 好友（從 LINE Developers Console 掃描 QR Code）
2. 轉發一張照片給 Bot
3. 應在 5 秒內收到回覆：

   ```
   ✅ 照片已上傳到 Immich!

   📝 陽光灑落的咖啡廳，桌上擺放著一杯拿鐵，溫暖舒適的午後氛圍...
   ```

4. 登入 Immich Web UI 確認照片存在，並有 AI 描述

---

## 🐛 故障排查

### Webhook 未收到訊息

```bash
# 檢查 Ingress
kubectl get ingress -n immich immich-line-bot-ingress
kubectl describe ingress -n immich immich-line-bot-ingress

# 檢查 cert-manager 證書
kubectl get certificate -n immich immich-line-bot-tls
kubectl describe certificate -n immich immich-line-bot-tls

# 測試 Webhook URL
curl -v https://immich-bot.3q.fi/webhook/line
# 應返回 405 Method Not Allowed（因為不是 POST）

# 檢查 LINE Webhook 設定
# LINE Developers Console → Messaging API → Verify webhook
```

### 上傳失敗

```bash
# 檢查 Pod logs
kubectl logs -n immich -l app=immich-line-bot --tail=100

# 常見錯誤:
# 1. "Invalid API key" → 檢查 immich-api-credentials Secret
# 2. "Connection refused" → 檢查 immich-server Service
# 3. "Timeout" → 檢查網絡連通性

# 測試 Immich API
kubectl exec -n immich deployment/immich-line-bot -- \
  curl -H "x-api-key: $IMMICH_API_KEY" \
  http://immich-server:2283/api/server-info/ping
```

### AI 標註失敗

```bash
# 檢查 OpenAI API Key
kubectl get secret openai-credentials -n immich -o yaml

# 檢查 OpenAI API 配額
# (登入 OpenAI Platform → Usage)

# 測試 OpenAI API
kubectl exec -n immich deployment/immich-line-bot -- \
  curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models/gpt-4-vision-preview
```

---

## ✅ 驗收標準

- [ ] LINE Bot Channel 建立並設定 Webhook
- [ ] 1Password 憑證同步正常（3 個 Secrets）
- [ ] Kubernetes Deployment 健康（2/2 Pods Running）
- [ ] Ingress TLS 證書正常（<https://immich-bot.3q.fi）>
- [ ] 從 LINE 轉發照片可成功上傳（< 5 秒回覆）
- [ ] Immich Web UI 可見新照片
- [ ] AI 描述自動產生（CLIP + GPT-4V）
- [ ] Prometheus 指標正常收集（/metrics 端點）
- [ ] 錯誤處理測試（無網絡、API Key 錯誤等）
- [ ] 成功率 > 95%（監控 7 天）

---

## 📈 成功指標

| 指標 | 目標 | 測量方式 |
|------|------|----------|
| **上傳成功率** | > 95% | Prometheus Counter |
| **P95 延遲** | < 5s | Prometheus Histogram |
| **AI 標註覆蓋率** | 100% | 所有照片都有描述 |
| **用戶滿意度** | > 90% | 手動調查 |

---

## 🎯 下一步（Phase 3）

完成 LINE Bot 後，進入 [Phase 3: 照片同步](../photo-sync/10_REQUIREMENTS.md)：

- Mac Photos Library 自動同步
- Immich CLI + fswatch
- Launchd 自動啟動服務

---

**優先級**: **P0 - 最高優先**
**預估完成**: 2026-06-02
**負責人**: Infrastructure Team

**最後更新**: 2026-05-27
