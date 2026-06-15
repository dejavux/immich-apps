# Runbook — Immich 相似圖 / 重複偵測驗證

**目的**：確認 Immich v2.7.5 **內建 Duplicate Detection** 是否滿足「列出 similar images」需求；不足再建 `similar-images-audit.py`。  
**規格**: [similar-images/10_REQUIREMENTS.md](../../../00_planning/photo-sync/similar-images/10_REQUIREMENTS.md)  
**最後更新**: 2026-06-15

---

## 先釐清：你要哪一種「重複」？

| 需求 | 適用工具 | 本 runbook |
|------|----------|------------|
| 檔案 byte 完全相同 | CLI checksum / L2 duplicateId | ❌ 已用 audit-local-duplicates 驗過 |
| 看起來同一張（重編碼、縮圖、連拍） | **L3 Duplicate Detection** + Stacks | ✅ 本 runbook |
| 語意相似（「海邊 sunset」） | Smart Search | ❌ 非 duplicate |

---

## Step 0 — 前置

```bash
# Immich 版本
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version

# ML job 是否積壓
curl -fsS -H "x-api-key: $IMMICH_API_KEY" \
  https://immich.3q.fi/api/jobs | jq '.[] | select(.name|test("duplicate|smart"))'
```

Admin UI：**Settings → Machine Learning → Duplicate Detection** → **Enabled**  
記下 `maxDistance`（預設約 0.1；可先用預設，驗證後再調）。

等 **Duplicate Detection** queue 跑完（大 library 可能數小時）。

---

## Step 1 — 內建 Duplicate 群組數量

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" \
  https://immich.3q.fi/api/duplicates | jq 'length'

# 看一組結構
curl -fsS -H "x-api-key: $IMMICH_API_KEY" \
  https://immich.3q.fi/api/duplicates | jq '.[0]'
```

Web UI：**Utilities → Duplicates**（或側欄 Duplicate 工具，依 v2.7 UI）。

記錄：

- 群組總數
- 每組 asset 數分布（2 張 vs 3+ 張）
- 是否含 **不同 album**（Mac Photos Local vs iCloud）

---

## Step 2 — Ground truth 樣本（20 組）

人工建立對照表（Google Sheet 或 JSON），每組含 **2+ asset id**：

| 類型 | 範例 | 預期 |
|------|------|------|
| **連拍** | 同一秒 3 張 | L3 應同 group |
| **重編碼** | audit 中 hash-miss 已知對 | L3 應同 group |
| **跨 library** | icloud + local 各一份（若存在） | L3 或 smart-search |
| **確定不同** | 不同場景 | **不**應同 group |

從 audit 取 hash-miss 候選：

```bash
./scripts/photo-sync/audit-local-duplicates.py
jq '.checksum_not_in_immich[:10]' \
  ~/Library/Logs/immich-photo-sync/audit-local-duplicates.json
```

在 Immich Web UI 用 Smart Search / 時間軸找到對應 asset id，填入 ground truth。

---

## Step 3 — 對照 Immich duplicate groups

對每組 ground truth `(id_a, id_b, …)`：

```bash
DUP=$(curl -fsS -H "x-api-key: $IMMICH_API_KEY" \
  https://immich.3q.fi/api/duplicates)

# 檢查 id_a 與 id_b 是否在同一 duplicate group（jq 範例）
echo "$DUP" | jq --arg a "$ID_A" --arg b "$ID_B" \
  '[.[] | select(.assets|map(.id)|index($a)) and (.assets|map(.id)|index($b))] | length'
```

填表：

| 組別 | 類型 | Immich 同 group? | 備註 |
|------|------|------------------|------|
| GT-01 | 連拍 | ✅/❌ | |
| … | | | |

**Recall** = 應同 group 且 Immich 有抓到 / 應同 group 總數  
**Precision（抽樣）** = 隨機 10 個 Immich group 人工看是否真 duplicate / 10

---

## Step 4 — Smart Search 鄰近（輔助）

對 hash-miss 單張，用 **以圖搜圖** 看 top-5：

Web UI：開啟 asset → **Find similar** / Smart Search with asset（v2.7 選單名稱可能為「Explore」或 search bar 附圖）。

API（若 OpenAPI 支援 `assetId` query on smart search）：

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"<asset-uuid>","type":"SMART"}' \
  https://immich.3q.fi/api/search/smart | jq '.assets[:5] | map(.id)'
```

若 duplicate group 沒抓到，但 smart-search top-3 有 ground truth 配對 → **內建「勉強可用」**，可調低 `maxDistance` 再測。

---

## Step 5 — 決策矩陣

| Recall | Precision | 決策 |
|--------|-----------|------|
| ≥ 80% | ≥ 90% | ✅ **用 Immich 內建**；必要時調 `maxDistance` |
| 50–80% | 可接受 | 🟡 內建 + 人工 spot-check；watch v2.8 |
| < 50% | — | 🔴 建 **similar-images-audit.py**（見規格 Phase A） |

---

## Step 6 — 記錄結果

寫入：

```text
~/Library/Logs/immich-photo-sync/similar-images-eval-YYYYMMDD.json
```

建議欄位：`immich_version`, `duplicate_detection_enabled`, `max_distance`, `group_count`, `ground_truth`, `recall`, `precision_sample`, `decision`.

更新 [PROGRESS_TRACKING §similar-images](../../../00_planning/PROGRESS_TRACKING.md) checklist。

---

## 常見問題

**Q: Duplicate 群組是 0？**  
→ job 未跑完、未 enabled、或 library 真的無 visual dup。先確認 queue + 用連拍測一組。

**Q: 和 checksum duplicate 差在哪？**  
→ checksum 要 byte 相同；Duplicate Detection 用 **CLIP embedding 距離**（AI）。

**Q: 會刪照片嗎？**  
→ 本 runbook **只讀**；Resolve/Delete 需另開人工 gate。

**Q: Photos 重編碼那 1506 張？**  
→ 重點測 Step 2「重編碼」類型；若 L3 抓不到，就是自建工具的主要場景。

---

## 相關

- [STORAGE_AUDIT.md](./STORAGE_AUDIT.md)
- `scripts/photo-sync/audit-local-duplicates.py`
- [Immich Duplicate docs](https://docs.immich.app/features/duplicates)
