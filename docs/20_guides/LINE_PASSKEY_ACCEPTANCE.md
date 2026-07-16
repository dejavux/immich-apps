# LIFF Passkey 實機驗收清單

> 對照：[LIFF_PASSKEY_SETUP.md](./LIFF_PASSKEY_SETUP.md)  
> 自動檢查日期：**2026-07-16**

## 前置條件（已通過自動檢查）

| 項目 | 預期 | 2026-07-16 結果 |
|------|------|-----------------|
| 叢集映像 | `immich-line-bot:cafde37` 或更新 | ✅ `registry-internal.3q.fi/immich-line-bot:cafde37` |
| `LIFF_ID` | 非空 | ✅ `2010563517-ubCFnmWa` |
| `LINE_LOGIN_CHANNEL_ID` | 與 LIFF 前綴一致 | ✅ `2010563517` |
| `WEBAUTHN_RP_ID` | `3q.fi` | ✅ |
| `REDIS_URL` | Passkey unlock grant 跨 pod | ✅ `redis://immich-redis:6379` |
| Hub 頁面 | HTTP 200 | ✅ `https://immich-bot.3q.fi/liff/hub` (~114ms) |
| LIFF meta | `liffUrl` 正確 | ✅ `https://liff.line.me/2010563517-ubCFnmWa` |
| Settings 頁 | HTTP 200 | ✅ `/liff/hub/settings`、LIFF 子路徑 `/settings` |

```bash
# 重跑自動檢查
kubectl -n immich get deploy immich-line-bot \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n immich get deploy immich-line-bot \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.value}{"\n"}{end}' \
  | grep -E 'LIFF|WEBAUTHN|LINE_LOGIN|REDIS'
curl -sS https://immich-bot.3q.fi/liff/_meta | jq .
curl -sS -o /dev/null -w "%{http_code}\n" https://immich-bot.3q.fi/liff/hub
```

---

## 手機驗收步驟（iPhone + LINE）

### A. 首次進入（無 Passkey）

1. 開啟 **Immich LINE Bot** 聊天室。
2. 點 Rich Menu 最右欄 **「帳戶設定」**（URI → `liff.line.me/{LIFF_ID}/settings`）。
3. 預期：LIFF 載入「帳戶與 Passkey」頁，顯示 LINE 登入狀態。
4. 若尚未註冊 Passkey：應直接看到 **「註冊 Passkey」** 按鈕與說明（無解鎖面板）。
5. 點 **「註冊 Passkey」**：
   - LINE 內建瀏覽器應提示改以 **Safari** 開啟（WebAuthn 不支援 LINE WebView）。
   - 在 Safari 完成 **Face ID / Touch ID** 註冊。
6. 註冊成功後預期：
   - Safari 顯示「Passkey 已註冊，可返回 LINE。」
   - 約 1.5s 後自動 `liff.closeWindow()` 返回 LINE；若未自動返回，手動切回 LINE。
7. 再次點 Rich Menu **「帳戶設定」**：
   - 預期顯示 **「已註冊 1 組 Passkey」**（或已解鎖後的設定面板）。

### B. 解鎖流程（Rich Menu → Safari Face ID → 返回已解鎖）

> 註冊 Passkey 後，設定頁與 Hub 皆需 Face ID 解鎖。

1. 確保距離上次解鎖已超過 session 有效期，或清除瀏覽器 session 重測。
2. Rich Menu → **「帳戶設定」**。
3. 預期：顯示 **「🔐 需要解鎖」** 面板與 **「使用 Face ID 解鎖」** 按鈕。
4. 點 **「使用 Face ID 解鎖」** → 應以 **Safari** 開啟 `liff.line.me/.../settings?action=unlock`。
5. 在 Safari 完成 Face ID 驗證。
6. 預期：
   - Safari 顯示「已解鎖，可返回 LINE。」
   - 伺服器寫入 **unlock grant（8h）**；返回 LINE 後 `POST /api/v1/auth/session/refresh` 同步為已解鎖 session。
7. 切回 LINE，再次開啟 **「帳戶設定」** 或 Hub **「帳戶與 Passkey」**：
   - 預期：**不再**顯示解鎖面板，可直接管理 Passkey / 開啟 Immich 連結。
8. （管理員）若 `ADMIN_LINE_USER_IDS` 含此帳號，Hub 應顯示 **「管理員設定」** 連結；未解鎖時應被 gate 擋下。

### C. 失敗排查

| 現象 | 可能原因 | 處理 |
|------|----------|------|
| LIFF 白屏 / 登入失敗 | Login channel 未 Published、未勾 `openid` | LINE Console 檢查 scope 與 Linked bots |
| Safari 無法 Face ID | 非 HTTPS、RP ID 不符 | 確認 `WEBAUTHN_RP_ID=3q.fi`、憑證有效 |
| 返回 LINE 仍顯示鎖定 | Redis 未連、grant 未寫入 | 查 `REDIS_URL`、pod log `auth/session/refresh` |
| 直接在 Safari 輸入 `immich-bot.3q.fi/liff/hub` | 繞過 LIFF context | **必須**從 `liff.line.me/{LIFF_ID}/...` 進入 |

```bash
# 驗收期間 tail log
kubectl logs -n immich deploy/immich-line-bot -f | rg "auth|webauthn|session"
```

---

## 驗收簽核

| 步驟 | 測試者 | 日期 | 結果 |
|------|--------|------|------|
| A 首次註冊 Passkey | | | ☐ Pass ☐ Fail |
| B 解鎖 → 返回已解鎖 | | | ☐ Pass ☐ Fail |
| C 8h 內免重複解鎖 | | | ☐ Pass ☐ Fail |

**備註欄**：（裝置型號、iOS 版本、異常截圖連結）
