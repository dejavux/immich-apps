# Phase 3: 照片同步與上傳

**狀態**: 📋 規劃中
**預估時間**: 2-3 天
**優先級**: **P1 - 次優先（在 LINE Bot 之後）**
**負責人**: Infrastructure Team

**前置條件**: ✅ Phase 2 LINE Bot 完成

---

## 🎯 目標

實現 Mac Photos Library 自動同步到 Immich，讓 Apple Photos 的照片自動備份到自建服務器。

### 核心功能

1. **Mac Photos Library 監控**: 即時偵測新增照片
2. **自動上傳**: 使用 Immich CLI 上傳
3. **增量同步**: 只上傳新增/修改的照片
4. **背景服務**: Launchd 自動啟動，不影響使用

---

## 🏗️ 架構設計

### 方案 A: Immich CLI + fswatch（推薦）

```yaml
┌──────────────────────────────────┐
│  Mac Photos Library              │
│  ~/Pictures/Photos Library       │
│      .photoslibrary/originals/   │
└────────────┬─────────────────────┘
             │ 檔案變更
             ↓
┌──────────────────────────────────┐
│  fswatch (檔案系統監控)          │
│  - 監控 originals/ 目錄          │
│  - 偵測新增/修改事件              │
└────────────┬─────────────────────┘
             │ 觸發上傳
             ↓
┌──────────────────────────────────┐
│  Immich CLI                      │
│  - @immich/cli (npm package)    │
│  - 上傳到 https://immich.3q.fi  │
│  - 自動重試失敗檔案              │
└────────────┬─────────────────────┘
             │ HTTPS upload
             ↓
┌──────────────────────────────────┐
│  Immich Server                   │
│  (Kubernetes immich namespace)   │
└──────────────────────────────────┘
```

**優點**:

- ✅ 即時同步（< 5 分鐘延遲）
- ✅ 雙向安全（刪除 Mac 照片不影響 Immich）
- ✅ 簡單易維護

**缺點**:

- ⚠️ 需要在 Mac 安裝軟體
- ⚠️ 初次全量上傳時間較長

---

### 方案 B: rsync + External Library

```yaml
┌──────────────────────────────────┐
│  Mac Photos Library              │
└────────────┬─────────────────────┘
             │ rsync (cron)
             ↓
┌──────────────────────────────────┐
│  lama:/mnt/immich/external-lib/  │
│  (透過 SSH rsync)                │
└────────────┬─────────────────────┘
             │ 手動掃描
             ↓
┌──────────────────────────────────┐
│  Immich External Library Scan    │
│  (Web UI 操作)                   │
└──────────────────────────────────┘
```

**優點**:

- ✅ 不需要 Immich CLI
- ✅ 利用 rsync 增量傳輸

**缺點**:

- ❌ 需要手動觸發掃描
- ❌ 延遲較高
- ❌ 需要 SSH 存取 lama

**結論**: 選擇 **方案 A（推薦）**

---

## 💻 技術實作

### 安裝依賴

```bash
# 1. 安裝 Immich CLI
npm install -g @immich/cli

# 驗證安裝
immich --version

# 2. 安裝 fswatch (Homebrew)
brew install fswatch

# 驗證安裝
fswatch --version
```

### 設定環境變數

```bash
# ~/.zshrc 或 ~/.bashrc
export IMMICH_INSTANCE_URL=https://immich.3q.fi
export IMMICH_API_KEY=<your-api-key>  # 從 Immich Web UI 產生
```

### 同步腳本

```bash
# ~/scripts/immich-sync.sh
#!/bin/bash

set -e

# 設定
PHOTOS_LIBRARY="$HOME/Pictures/Photos Library.photoslibrary/originals"
LOG_FILE="$HOME/Library/Logs/immich-sync.log"
LOCK_FILE="/tmp/immich-sync.lock"

# 日誌函數
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 確保只有一個實例運行
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    log "Another sync is already running (PID: $PID)"
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

# 檢查環境變數
if [ -z "$IMMICH_INSTANCE_URL" ] || [ -z "$IMMICH_API_KEY" ]; then
  log "ERROR: IMMICH_INSTANCE_URL or IMMICH_API_KEY not set"
  exit 1
fi

# 檢查 Photos Library 存在
if [ ! -d "$PHOTOS_LIBRARY" ]; then
  log "ERROR: Photos Library not found at $PHOTOS_LIBRARY"
  exit 1
fi

# 初次全量上傳（只在第一次執行）
MARKER_FILE="$HOME/.immich-sync-initialized"
if [ ! -f "$MARKER_FILE" ]; then
  log "Starting initial full sync..."
  immich upload "$PHOTOS_LIBRARY" --recursive --album "Mac Photos" 2>&1 | tee -a "$LOG_FILE"
  touch "$MARKER_FILE"
  log "Initial sync complete"
else
  # 增量上傳
  log "Starting incremental sync..."
  immich upload "$PHOTOS_LIBRARY" --recursive --album "Mac Photos" --skip-duplicates 2>&1 | tee -a "$LOG_FILE"
  log "Incremental sync complete"
fi
```

### fswatch 監控腳本

```bash
# ~/scripts/immich-watch.sh
#!/bin/bash

PHOTOS_LIBRARY="$HOME/Pictures/Photos Library.photoslibrary/originals"
SYNC_SCRIPT="$HOME/scripts/immich-sync.sh"
LOG_FILE="$HOME/Library/Logs/immich-watch.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting fswatch on $PHOTOS_LIBRARY"

# 使用 fswatch 監控檔案變更
fswatch -o "$PHOTOS_LIBRARY" | while read -r change; do
  log "Detected change: $change"

  # 延遲 30 秒，避免頻繁觸發（等 Photos 完成寫入）
  sleep 30

  # 執行同步
  log "Triggering sync..."
  bash "$SYNC_SCRIPT"
done
```

### Launchd 自動啟動

```xml
<!-- ~/Library/LaunchAgents/com.user.immich-watch.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.immich-watch</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/YOUR_USERNAME/scripts/immich-watch.sh</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/immich-watch.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/immich-watch.stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>IMMICH_INSTANCE_URL</key>
        <string>https://immich.3q.fi</string>
        <key>IMMICH_API_KEY</key>
        <string>YOUR_IMMICH_API_KEY</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
```

---

## 🚀 部署步驟

### Step 1: 準備腳本

```bash
# 1. 建立腳本目錄
mkdir -p ~/scripts
mkdir -p ~/Library/Logs

# 2. 建立同步腳本
nano ~/scripts/immich-sync.sh
# (貼上上面的腳本內容)
chmod +x ~/scripts/immich-sync.sh

# 3. 建立監控腳本
nano ~/scripts/immich-watch.sh
# (貼上上面的腳本內容)
chmod +x ~/scripts/immich-watch.sh
```

### Step 2: 取得 Immich API Key

1. 登入 Immich Web UI: `https://immich.3q.fi`
2. Settings → API Keys → Create API Key
3. Name: `Mac Photos Sync`
4. 複製 API Key

### Step 3: 設定環境變數

```bash
# 編輯 ~/.zshrc
nano ~/.zshrc

# 加入以下內容
export IMMICH_INSTANCE_URL=https://immich.3q.fi
export IMMICH_API_KEY=YOUR_COPIED_API_KEY

# 重新載入
source ~/.zshrc
```

### Step 4: 測試手動同步

```bash
# 測試同步腳本（初次會全量上傳）
~/scripts/immich-sync.sh

# 查看日誌
tail -f ~/Library/Logs/immich-sync.log
```

### Step 5: 設定 Launchd

```bash
# 1. 建立 plist 檔案
nano ~/Library/LaunchAgents/com.user.immich-watch.plist
# (貼上上面的 plist 內容，修改 YOUR_USERNAME 和 API_KEY)

# 2. 載入服務
launchctl load ~/Library/LaunchAgents/com.user.immich-watch.plist

# 3. 檢查服務狀態
launchctl list | grep immich

# 4. 查看日誌
tail -f ~/Library/Logs/immich-watch.stdout.log
```

### Step 6: 測試自動同步

1. 在 Mac Photos 加入一張新照片
2. 等待 30-60 秒
3. 檢查日誌: `tail -f ~/Library/Logs/immich-sync.log`
4. 登入 Immich Web UI 確認照片出現

---

## 📊 監控與日誌

### 日誌檔案

| 檔案 | 用途 |
|------|------|
| `~/Library/Logs/immich-sync.log` | 同步操作日誌 |
| `~/Library/Logs/immich-watch.stdout.log` | fswatch 標準輸出 |
| `~/Library/Logs/immich-watch.stderr.log` | fswatch 錯誤輸出 |

### 查看日誌

```bash
# 即時查看同步日誌
tail -f ~/Library/Logs/immich-sync.log

# 查看最近 50 行
tail -n 50 ~/Library/Logs/immich-sync.log

# 搜尋錯誤
grep ERROR ~/Library/Logs/immich-sync.log

# 統計上傳數量
grep "Uploaded" ~/Library/Logs/immich-sync.log | wc -l
```

### 日誌輪轉

```bash
# 手動清理舊日誌（保留最近 100 行）
tail -n 100 ~/Library/Logs/immich-sync.log > /tmp/immich-sync-tmp.log
mv /tmp/immich-sync-tmp.log ~/Library/Logs/immich-sync.log
```

---

## 🐛 故障排查

### Launchd 服務未啟動

```bash
# 檢查服務狀態
launchctl list | grep immich

# 重新載入服務
launchctl unload ~/Library/LaunchAgents/com.user.immich-watch.plist
launchctl load ~/Library/LaunchAgents/com.user.immich-watch.plist

# 查看錯誤日誌
cat ~/Library/Logs/immich-watch.stderr.log
```

### 上傳失敗

```bash
# 常見錯誤:
# 1. "Invalid API key" → 檢查 IMMICH_API_KEY
echo $IMMICH_API_KEY

# 2. "Connection refused" → 檢查網絡連通性
curl -I https://immich.3q.fi

# 3. "Duplicate file" → 使用 --skip-duplicates 選項（已包含在腳本中）
```

### Photos Library 路徑錯誤

```bash
# 檢查 Photos Library 路徑
ls -la ~/Pictures/Photos\ Library.photoslibrary/originals/

# 如果路徑不同，修改腳本中的 PHOTOS_LIBRARY 變數
```

---

## ⚠️ 注意事項

### Apple Photos 限制

1. **originals/ 目錄**: 只包含原始照片，不含 Live Photos 的影片部分
2. **編輯資訊**: Photos 的編輯不會同步（只同步原始檔）
3. **相簿結構**: Immich 會建立單一相簿 "Mac Photos"，不保留 Photos 的相簿結構
4. **刪除行為**: 從 Mac Photos 刪除照片不會刪除 Immich 的副本（單向同步）

### 效能考量

1. **初次同步**: 大量照片可能需要數小時，建議夜間執行
2. **網絡頻寬**: 上傳照片會消耗上傳頻寬
3. **CPU 使用**: fswatch 和 Immich CLI 佔用少量 CPU

---

## ✅ 驗收標準

- [ ] Immich CLI 安裝並配置正確
- [ ] 環境變數設定正確（IMMICH_INSTANCE_URL, IMMICH_API_KEY）
- [ ] 同步腳本測試通過（手動執行）
- [ ] Launchd 服務自動啟動
- [ ] Mac Photos 新增照片後 5 分鐘內同步到 Immich
- [ ] 日誌記錄正常，可追蹤同步狀態
- [ ] 初次全量同步完成（數千張照片）
- [ ] 增量同步測試通過（只上傳新照片）

---

## 📈 成功指標

| 指標 | 目標 | 測量方式 |
|------|------|----------|
| **同步延遲** | < 5 min | 手動測試 |
| **上傳成功率** | > 98% | 日誌統計 |
| **重複檔案** | 0 | `--skip-duplicates` |
| **服務穩定性** | 24/7 運行 | launchctl 監控 |

---

## 🎯 下一步（Phase 4）

完成照片同步後，進入 [Phase 4: 存儲優化](./PHASE4_STORAGE_OPTIMIZATION.md)：

- PostgreSQL 遷移到 SSD
- 縮圖快取優化
- 效能測試與驗證

---

**優先級**: **P1 - 次優先（在 LINE Bot 之後）**
**預估完成**: 2026-06-04
**負責人**: Infrastructure Team

**最後更新**: 2026-05-27
