# Port Range 分配方案

**日期**: 2026-05-27  
**目的**: 避免 port 擠壓，預留充足空間

---

## 🎯 推薦方案（調整後）

| Repo | Port Range | 保留數量 | 用途 | 備註 |
|------|-----------|---------|------|------|
| **fuqi-asset-manager** | 30400-30419 | 20 | crypto-data, price, wallet, bff, notify, bridge, prometheus, grafana, 1password | 已使用 9 個 |
| **infra-apps** | 30420-30439 | 20 | qwen, docker-registry, 其他基礎設施服務 | 已使用 2 個 |
| **immich-apps** | **30450-30479** | **30** | **LINE Bot, Photo Sync API, Immich server, ML, 未來服務** ⭐ | 預留更多空間 |
| **(預留)** | 30480-30499 | 20 | 未來新專案 | - |

---

## 📊 當前使用狀況

### fuqi-asset-manager (30400-30419)

```yaml
30400: crypto-data-service
30401: price-service
30402: wallet-service
30403: bridge-worker
30404: prometheus
30405: grafana
30408: 1password-connect
30409: telegram-notify
30410: telegram-bff
# 剩餘: 30411-30419 (9 個可用)
```

### infra-bootstrap (30420-30439)

```yaml
30420: qwen-coder (local-llm)
30421: docker-registry
# 剩餘: 30422-30439 (18 個可用)
```

### immich-apps (30450-30479) ⭐ 新方案

```yaml
30450: immich-line-bot          # LINE Bot webhook server
30451: immich-server            # (可選) Immich server port-forward
30452: immich-machine-learning  # (可選) ML service
30453: immich-postgres          # (可選) PostgreSQL
30454: immich-redis             # (可選) Redis
30455: photo-sync-api           # (未來) Photo Sync API
30456-30479: 預留（24 個）       # 未來擴充
```

**理由**:

1. ✅ **充足空間**: 30 個 port 足夠 Immich 生態擴充
2. ✅ **避免衝突**: 與其他 repo 間隔 10+ 個 port
3. ✅ **未來擴充**: Immich 可能新增更多微服務

---

## 🔄 需要更新的文件

### 1. immich-apps/scripts/dev/pf.sh

```bash
#!/usr/bin/env bash
# Port-forward for Immich Apps

PF_LOCAL_LINE_BOT_PORT="${PF_LOCAL_LINE_BOT_PORT:-30450}"  # 改為 30450
PF_LOCAL_IMMICH_SERVER_PORT="${PF_LOCAL_IMMICH_SERVER_PORT:-30451}"
PF_LOCAL_IMMICH_ML_PORT="${PF_LOCAL_IMMICH_ML_PORT:-30452}"

# ...
```

### 2. immich-apps/.env.example

```bash
# Port-Forward (更新為新 range)
PF_LOCAL_LINE_BOT_PORT=30450
PF_LOCAL_IMMICH_SERVER_PORT=30451
PF_LOCAL_IMMICH_ML_PORT=30452
```

### 3. immich-apps/docs/*.md

更新所有文檔中的 port range 引用：

- `30430-30439` → `30450-30479`

---

## 📋 完整 Port Map

```
30000-30399: (保留，未使用)
30400-30419: fuqi-asset-manager    (20 ports, 已用 9)
30420-30439: infra-bootstrap       (20 ports, 已用 2)
30440-30449: (空檔，可用於其他專案)
30450-30479: immich-apps           (30 ports, 已用 0) ⭐
30480-30499: (預留未來專案)
30500+:      (未規劃)
```

---

## ✅ 優勢

1. **避免擠壓**: 各 repo 間隔充足
2. **易於管理**: 每個 repo 有清晰的 range
3. **可擴充**: immich-apps 有 30 個 port
4. **未來友善**: 預留空間給新專案

---

**建議**: 立即更新 immich-apps 使用 **30450-30479** range

**最後更新**: 2026-05-27
