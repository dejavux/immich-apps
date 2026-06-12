# Immich v2.0.1 → v2.7.5 升級 — 結案摘要

**執行日**: 2026-06-12  
**完整 checklist**: [IMMICH_v2.7.5.md](../../00_planning/infra/upgrades/IMMICH_v2.7.5.md)

---

## 版本

| 元件 | 升級前 | 升級後 |
|------|--------|--------|
| immich-server | v2.0.1 | **v2.7.5** |
| immich-machine-learning | :release | **v2.7.5** |
| immich-apps OpenAPI | 2.0.1 | **2.7.5** |
| postgres | VectorChord PG14 | 不變 |

---

## 關鍵步驟

1. **pg_dump** — 使用 secret 內 DB user（非 `postgres` role）
2. **VectorChord** — 移除 `vectors.so`，保留 `vchord.so`
3. **Rolling update** — pin image tag `v2.7.5`
4. **OpenAPI sync** — `scripts/openapi/fetch-spec.sh` 預設 2.7.5

---

## 驗收

- [x] `GET /api/server/version` → 2.7.5
- [x] smoke E2E API 全綠
- [x] photo-sync 續傳不受影響（hash skip）
- [ ] Web UI 抽查
- [ ] LINE 對話 E2E

---

## 建議後續

```bash
npm i -g @immich/cli@2.7.5
```
