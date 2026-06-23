# Optional — Photo Edit + AI 整合

**狀態**: 📋 規劃中  
**優先級**: P3（Optional feature）  
**前置**: Phase 2/3 ✅ · Immich **v2.7.5** · GPU worker3 可用  
**最後更新**: 2026-06-13

---

## 問題陳述

| 現況 | 痛點 |
| ------ | ------ |
| Immich 內建 `/assets/{id}/edits` | 僅 crop / rotate / mirror（非破壞性） |
| ML pipeline（Smart Search、人臉、OCR） | 偏搜尋／標籤，**不能改圖** |
| Workflow / Plugin（WASM） | 早期；偏自動化分類，非完整 editor SDK |
| Mac Photos 為 SSOT | 重度修圖仍可能在 Photos；Immich 需 union 可見 |

**目標**：在 Immich 生態內提供 **AI 輔助修圖**（去背、超解析、修復等），結果可追溯、不覆蓋原圖。

---

## 非目標

- 不取代 Lightroom / Photoshop / Photos 重度工作流
- 第一版不做 Immich Web UI fork 或完整 inline editor
- 不從 Immich 刪除原 asset 來「替換」編輯結果
- 不修改 Mac `.photoslibrary` 內容（僅 Immich 側新 asset）

---

## Immich 能力邊界（v2.7.5）

| 層級 | API / 能力 | 本專案用途 |
| ------ | ------------ | ------------ |
| 下載原圖 | `GET /assets/{id}/original` | edit pipeline 輸入 |
| 幾何編輯 | `PUT /assets/{id}/edits` | crop / rotate / mirror only |
| 上傳新圖 | `POST /assets`（multipart） | AI 結果回寫（**首選**） |
| 標籤 | `PUT /assets` tags | `ai-edit`、`source:{id}` |
| Workflow | `/workflows` trigger `AssetCreate` | Phase B 自動化 hook |

---

## 方案（三階段）

### Phase A — Sidecar Edit BFF（MVP）

**架構**：

```text
Web / LINE / CLI
  → photo-edit-bff（immich-apps，namespace: immich）
      → GET /assets/{id}/original
      → GPU worker（rembg / Real-ESRGAN / CodeFormer）
      → POST upload（新 asset）
      → tags: ai-edit, source:{id}, tool:{name}
```

**首版工具（擇一或並行 PoC）**：

| 工具 | 用途 | GPU |
| ------ | ------ | ----- |
| rembg | 去背 | worker3 |
| Real-ESRGAN | 超解析 | worker3 |
| CodeFormer | 人臉修復 | worker3 |

**與現有 repo 整合**：

- 共用 OpenAPI client / `IMMICH_API_KEY`（同 LINE Bot、photo-sync）
- 可選：LINE Bot 指令「幫這張去背」→ 回傳 Immich link

**Config schema（草案）**：

```yaml
photo_edit:
  enabled: false
  gpu_node: worker3
  default_tools: [rembg]
  upload_album: "AI Edits"
  tag_prefix: "source"
```

### Phase B — ComfyUI + Workflow

- 部署 ComfyUI（worker3 或獨立 GPU pod）
- 預設 workflow JSON（去背、inpaint、風格化）
- Immich Workflow Plugin：新 asset 上傳時可選自動跑 pipeline
- LINE 自然語言 → BFF 選 workflow（需 guardrail）

### Phase C — Web UI + 批次 Queue

- 輕量 before/after 頁（Immich asset deep link 或 sidecar SPA）
- Redis / DB job queue；Prometheus 指標
- 批次：album 內 N 張套用同一 tool

---

## 設計原則

1. **Immutability**：原 asset 不變；編輯結果為新 asset 或 edits endpoint（僅幾何）
2. **Provenance**：`source:{uuid}` tag + metadata（tool、model version、timestamp）
3. **SSOT**：Mac Photos library 不因 Immich edit 而變更；photo-sync 照常 dedupe
4. **GPU 共用**：與 `immich-machine-learning` 協調 node / 時間片；避免 OOM

---

## 里程碑

### A0 — 研究（1 天）

- [ ] 確認 v2.7.5 OpenAPI：`/assets/{id}/original`、upload、tags
- [ ] worker3 GPU 空閒時段盤點（與 ML pod 共存策略）

### A1 — PoC（2–3 天）

- [ ] 本機或 K8s Job：單張 asset → rembg → upload
- [ ] 驗證 Web UI 可見新圖 + source tag
- [ ] 文件：`20_guides/photo-edit/POC.md`

### A2 — BFF 服務（3–5 天）

- [ ] `services/photo-edit-bff`（FastAPI 或 Express，對齊 line-bot 慣例）
- [ ] Helm chart + `/health` + 1Password API key
- [ ] 可選 LINE Bot 子命令

### B1 — ComfyUI（Optional）

- [ ] ComfyUI Deployment + 1–2 workflow
- [ ] BFF 轉發 ComfyUI API

### C1 — UI / Queue（Optional）

- [ ] Job queue + 簡易 status API
- [ ] Before/after 靜態頁

---

## 驗收（Phase A MVP）

| 項目 | 標準 |
| ------ | ------ |
| 單張去背 E2E | API 觸發 → 60s 內 Immich 可見新 asset |
| 追溯 | 新 asset 含 `source:{原 asset id}` tag |
| 原圖 | 原 asset checksum 不變 |
| 失敗 | 4xx/5xx + 結構化 log；不留下半 upload |

---

## 風險

| 風險 | 緩解 |
| ------ | ------ |
| GPU 與 ML pod 搶資源 | 排程 / 低優先 Job · toleration 分離 |
| 大圖 OOM | 下采樣預覽 + 原尺寸 async queue |
| 重複 upload | hash dedupe（同 photo-sync）；tag 區分「編輯版」 |
| Immich Plugin API 變動 | Phase A 只用 REST；Plugin 為 Phase B |

---

## 參考

- [Immich API docs](https://immich.app/docs/api) · 本 repo OpenAPI sync（v2.7.5）
- [20_guides/infra/GPU_CONFIGURATION.md](../../20_guides/infra/GPU_CONFIGURATION.md)
- LINE Bot 架構：`services/immich-line-bot/`
