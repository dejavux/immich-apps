# Optional — 相似圖 / 重複圖偵測

**狀態**: 📋 待驗證  
**優先級**: P2（Optional · 非 Sprint 主軌）  
**前置**: Immich v2.7.5 · ML job 完成 · [SIMILAR_IMAGES_EVAL runbook](../../../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)  
**最後更新**: 2026-06-15

---

## 問題陳述

| 現況 | 痛點 |
|------|------|
| photo-sync 用 **SHA1 checksum** dedupe | 僅 **binary 完全相同** 才 skip |
| local audit：**0 hash dup**，~**1506** hash 不在 Immich | Photos 重編碼 → Immich 視為不同 asset |
| Immich v2.7 **Duplicate Detection** | 宣稱視覺相似，實務覆蓋率未知 |
| 跨 library（icloud + local）union | 需確認「同一張照片兩份編碼」能否被偵測 |

**目標**：釐清 Immich 內建是否足夠；不足時定義 **similar-images 小工具**（CLI + JSON 報告）。

---

## Immich 三層「重複」概念

| 層級 | 機制 | 比對依據 | 能抓到重編碼？ |
|------|------|----------|----------------|
| **L1 Upload dedupe** | CLI `--skip-duplicates` / server checksum | **SHA1 二進位** | ❌ |
| **L2 duplicateId** | DB 多 asset 共用 checksum | **SHA1 相同** | ❌ |
| **L3 Duplicate Detection** | ML job（CLIP embedding + `maxDistance`） | **視覺相似** | ✅ 可能 |
| **Stacks** | 手動或 resolve 合併 | 使用者／API 分組 | 視操作 |

**結論**：若需求是「列出 **看起來像** 的重複」，應評估 **L3**（Admin → Duplicate Detection + `GET /api/duplicates`），不是 L1/L2。

Duplicate Detection 設定（Admin → Settings → Machine Learning）：

- `duplicateDetection.enabled`
- `duplicateDetection.maxDistance`（越小越嚴格）

---

## 非目標

- 第一版不做 Web UI
- 不自動刪 asset（僅報告 + 可選 stack 建議）
- 不取代 Mac Photos「重複項目」功能

---

## 驗證策略（SSOT → runbook）

→ **[SIMILAR_IMAGES_EVAL.md](../../../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)**

摘要：

1. **啟用** Duplicate Detection · 等 job queue 清空
2. **Ground truth**：人工標 20 組已知近重複（連拍、重編碼、export 兩份）
3. **API 對照**：`GET /api/duplicates` vs ground truth → 算 recall / precision
4. **回歸集**：`audit-local-duplicates.json` 中 hash-miss 樣本 10 張 → 是否在 duplicate group
5. **決策**：recall ≥ 80% 且 false positive 可接受 → **用內建**；否則進 Phase B 自建

---

## 方案（若內建不足）

### Phase A — 報告 CLI（MVP）

```text
similar-images-audit.py
  → 讀 audit-local-duplicates.json hash-miss 清單
  → 對每張：GET /search/smart?query=<assetId> 或 duplicates API 鄰近
  → 輸出 JSON：{ asset_id, candidates[], distance, in_immich_dup_group }
```

### Phase B — embedding 批次（Optional）

- 直接查 Immich DB `smart_search` / embedding 表（需 admin）
- 或本機 CLIP 對 `/original` 下載比對（較慢、離線可用）

### Phase C — 整合 tier policy（Optional）

- tier export 前提示「Immich 已有相似 asset」→ 避免重複佔 iCloud

---

## 里程碑

| # | 任務 | 狀態 |
|---|------|------|
| V0 | 跑 [SIMILAR_IMAGES_EVAL](../../../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md) | 📋 |
| V1 | Ground truth 20 組 + recall/precision 表格 | 📋 |
| A1 | `similar-images-audit.py`（若 V0 未過） | 📋 |

---

## 驗收（內建足夠時）

| 項目 | 標準 |
|------|------|
| Duplicate job | enabled · queue 無 backlog |
| Ground truth recall | ≥ **80%**（20 組中 ≥16 被 L3 抓到） |
| False positive | 隨機 50 張非重複 · ≤ **5%** 誤報 |
| hash-miss 樣本 | 10 張中 ≥ **5** 出現在 duplicate group 或 smart-search top-3 |

---

## 參考

- [STORAGE_AUDIT.md](../../../20_guides/photo-sync/runbooks/STORAGE_AUDIT.md) · checksum dedupe
- `scripts/photo-sync/audit-local-duplicates.py`
- Immich API：`GET /api/duplicates` · `POST /api/search/smart`
