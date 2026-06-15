# Optional — 相似圖 / 重複圖偵測

**狀態**: 📋 待驗證（P2 · Optional）  
**優先級**: Phase 3.5 Phase B 空檔或 tier 結案後  
**SSOT**: [10_REQUIREMENTS.md](./10_REQUIREMENTS.md)

## 問題

Immich 有多層「重複」概念（checksum、Duplicate Detection job、Stacks），但能否涵蓋 **視覺相似但 hash 不同**（Photos 重編碼、連拍、HEIC↔JPEG export）尚不確定。

## 文件

| 文件 | 用途 |
|------|------|
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | 需求、Immich 能力邊界、自建工具方案 |
| [SIMILAR_IMAGES_EVAL.md](../../../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md) | **如何驗證**內建功能是否夠用（runbook） |

## 已知線索（2026-06-12）

`audit-local-duplicates.py`：local **0 hash dup**，但 **~1506** 檔 checksum 不在 Immich（Photos 重編碼後 hash 變更 → sync 視為 new asset）。這類案例需 **similarity-level** 工具，非 binary dedupe。
