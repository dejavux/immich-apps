# LIFF + Passkey — Immich 相簿中心

> LINE Login channel LIFF 入口：`https://immich-bot.3q.fi/liff/hub`

## 1. LINE Console 設定

1. 於 **LINE Login channel** 新增 LIFF app
2. **Endpoint URL**：`https://immich-bot.3q.fi/liff/hub`
3. **Scope**：`profile`、**`openid`**、`chat_message.write`
4. Login channel 狀態需 **Published**
5. **Linked bots**：關聯 Immich LINE Bot OA

> **路徑對應**：Endpoint 在 `/liff/hub` 時，`https://liff.line.me/{LIFF_ID}/settings` 會開啟 `/liff/hub/settings`（非 `/liff/settings`）。Passkey 頁面必須走 `liff.line.me` 子路徑，勿在 Safari 直接輸入 `immich-bot.3q.fi/liff/hub`。

## 2. 環境變數

| 變數 | 說明 |
|------|------|
| `LIFF_ID` | LIFF app ID |
| `LINE_LOGIN_CHANNEL_ID` | Login channel ID（可從 LIFF ID 前綴推導） |
| `AUTH_SESSION_SECRET` | HMAC session 簽章（預設 `LINE_CHANNEL_SECRET`） |
| `WEBAUTHN_RP_ID` | WebAuthn RP ID（建議 `3q.fi`） |
| `WEBAUTHN_RP_NAME` | 顯示名稱（預設 `Immich LINE`） |
| `ADMIN_LINE_USER_IDS` | 管理員 LINE userId（逗號分隔） |
| `REDIS_URL` | 選填；Passkey 持久化 |
| `LINE_BOT_PUBLIC_URL` | 對外 HTTPS（`https://immich-bot.3q.fi`） |
| `IMMICH_WEB_URL` | Immich Web UI 連結 |

## 3. 流程

1. 使用者從 Rich Menu 或 URI 開啟 LIFF hub
2. `liff.getIDToken()` → `POST /api/v1/auth/session`
3. 可開啟 `IMMICH_WEB_URL` 瀏覽相簿
4. 設定頁可註冊 Passkey；之後需 Face ID 解鎖才能進設定/管理員頁
5. **Passkey 須在 Safari 完成**：LINE 內建瀏覽器不支援 WebAuthn；點註冊/解鎖會以 `liff.openWindow({ external: true })` 開啟 `liff.line.me/{id}/settings?action=…`，Safari 完成 LINE 登入後再註冊 Face ID

## 4. API

- `POST /api/v1/auth/session` — LINE idToken 換 session
- `GET /api/v1/auth/me` — 目前使用者狀態
- `POST /api/v1/auth/webauthn/register/*` — 註冊 Passkey
- `POST /api/v1/auth/webauthn/assert/options` + `session/upgrade` — Face ID 解鎖

## 5. 部署

```bash
# 設定 secret 後 helm upgrade
kubectl apply -k deploy/helm/immich-line-bot/
```

K8s secret 需含 `LIFF_ID`、`LINE_LOGIN_CHANNEL_ID`（可併入現有 Immich-LINE-Bot 1Password item）。
