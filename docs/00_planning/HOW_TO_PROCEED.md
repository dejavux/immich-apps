# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-13  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**待辦優先序**: [BACKLOG.md](./BACKLOG.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
|------|------|
| Phase 2 LINE Bot MVP | ✅ 結案 |
| Phase 3 Photo Sync | ✅ 結案（全量 + 增量） |
| Immich server | **v2.7.5** @ `https://immich.3q.fi` |
| LINE Bot 映像 | `immich-line-bot:b2c2d6c` |
| `/data/upload` | **~115 GB** |
| LaunchAgent | ✅ running |

---

## 🎯 現在該做什麼

### P0 — 人工驗收（你已確認進行 ✅）

自行勾選即可，與 Phase 3.5 可並行。

- [ ] Web UI：兩相簿 + 時間軸 EXIF（v2.7.5）
- [ ] LINE：「找在海邊的照片」「幫我找小蕊一歲半的照片」
- [ ] 可選：`npm i -g @immich/cli@2.7.5`

### P1 — Phase 3.5 Kickoff（主軌）

→ [tier-policy/10_REQUIREMENTS.md](./photo-sync/tier-policy/10_REQUIREMENTS.md)

**M1 PoC** — 大部分完成 ✅：

```bash
export PATH="$HOME/.local/bin:$PATH"
pip3 install --user osxphotos          # 若尚未安裝
./scripts/photo-sync/tier-policy-poc.sh --cutoff-date 2023-01-01
# → eligible: 2900 · originals ~28 GB · size 未超 50 GB
./scripts/photo-sync/immich-sync.sh --library icloud-primary --dry-run  # 0 new
```

**M2 spot-check + 跨 library 研究** — 完成 ✅：

```bash
export PATH="$HOME/.local/bin:$PATH"
./scripts/photo-sync/tier-policy-spotcheck.sh
./scripts/photo-sync/tier-policy-cross-library-poc.sh
# → 577 local eligible 100% 已在 Immich
# → 2900 eligible：577 可 export · 2188 iCloud-only · export→import 可行、無一鍵 move
```

→ [20_CROSS_LIBRARY_MOVE_RESEARCH.md](./photo-sync/tier-policy/20_CROSS_LIBRARY_MOVE_RESEARCH.md)

**M3 下一步**：`tier-policy.sh` execute（先小批次 577 張 local-path）

### Optional — Photo Edit + AI（P3 · 非主軌）

→ [photo-edit/10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md)

Phase 3.5 M2 或 Phase 5 備份就緒後再開 PoC（rembg → Immich upload）。

### 之後

Phase 5 備份 → Phase 4 SSD（見 [BACKLOG.md](./BACKLOG.md)）

---

## 驗證指令

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach sunset" --person rayna
tail -f ~/Library/Logs/immich-photo-sync/sync.log
```

---

## 🔗 相關

- [BACKLOG.md](./BACKLOG.md)
- [photo-sync/tier-policy/](./photo-sync/tier-policy/)
- [20_guides/photo-sync/](../20_guides/photo-sync/)
- [20_guides/infra/upgrades/IMMICH_v2.7.5.md](../20_guides/infra/upgrades/IMMICH_v2.7.5.md)
- [scripts/photo-sync/README.md](../../scripts/photo-sync/README.md)
