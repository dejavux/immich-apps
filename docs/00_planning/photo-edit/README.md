# Optional — Photo Edit + AI 整合

**狀態**: 📋 規劃中（Optional · 非 Sprint 主軌）  
**優先級**: P3（Phase 3.5 / Phase 5 之後）  
**SSOT**: [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) · [PROGRESS_TRACKING §Optional](../PROGRESS_TRACKING.md)

## 背景

Immich v2.7.5 內建編輯僅 crop / rotate / mirror；Smart Search / ML 偏「理解」而非「改圖」。若要 AI 去背、超解析、修復等，需外掛 **edit service** 與 Immich REST API 整合。

## 文件

| 文件 | 用途 |
| ------ | ------ |
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | 三階段方案、API、驗收 |
| [20_guides/infra/GPU_CONFIGURATION.md](../../20_guides/infra/GPU_CONFIGURATION.md) | worker3 GPU 資源 |

## 原則

- **不覆蓋** Immich blob；Mac `.photoslibrary` 為 SSOT
- 編輯結果以 **新 asset** 或 `PUT /assets/{id}/edits`（僅幾何變更）回寫
- 以 tag `source:{asset_id}`、`ai-edit` 追溯來源
