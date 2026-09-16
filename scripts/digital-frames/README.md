# Digital frame export (Pix-Star + Nixplay)

Mac 本機工具：從 Immich 選片 → 1920px JPEG → 上傳至 Pix-Star web album 與 Nixplay playlist。

**Nixplay 請使用 direct upload**（瀏覽器 session + `__nixplayUpload`）。Dropbox 匯入會依檔名重用帳號內舊的 480px 媒體，勿依賴 Dropbox 同步到 Nixplay。

## 設定

```bash
cd immich-apps/scripts/digital-frames
cp nixplay_config.json.example nixplay_config.json   # 編輯 playlistId / frameId
# IMMICH_API_KEY + IMMICH_BASE_URL（見 scripts/photo-sync/bootstrap-credentials.sh）
```

資料目錄預設 `scripts/digital-frames/.data/`（不進 git）。

## 流程

```bash
python3 fetch_immich_photos.py          # Immich → .data/best2025 + manifest
./build_upload_jpegs.sh                 # → .data/best2025_upload (1920px)
python3 pixstar_clear_album.py          # 可選：清空 Pix-Star album
python3 pixstar_upload_album.py
# Nixplay：在已登入 app.nixplay.com 的 Cursor 瀏覽器分頁注入 nixplay_batch_upload.js，
# 或以 nixplay_mcp_chunk_inject.py 產生 browser_cdp 分塊步驟
python3 nixplay_setup_frame.py assign  # CDP payload：指派 playlist 到 frame
```

環境變數：`NIXPLAY_BROWSER_VIEW_ID`（Cursor browser tab viewId）、`PIXSTAR_ALBUM_ID`、`DROPBOX_TOKEN`（僅 `dropbox_upload_photos.py`）。
