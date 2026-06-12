# Immich v2.7.5 升級

**歸檔日期**: 2026-06-12  
**活躍 checklist**: [00_planning/infra/upgrades/IMMICH_v2.7.5.md](../../00_planning/infra/upgrades/IMMICH_v2.7.5.md)

## 交付摘要

| Phase | 狀態 | 備註 |
|-------|------|------|
| A2 pg_dump | ✅ | `infra-bootstrap/immich-pg-backup-20260612.sql`（149 MB） |
| A3 VectorChord | ✅ | `shared_preload_libraries = vchord.so` |
| B deploy | ✅ | server + ML pin **v2.7.5** |
| C OpenAPI | ✅ | sync 2.7.5 · `npm test` 48/48 |
| D 手動 | ⏸ | Web UI / LINE E2E 待人工 |

## 文件索引

| 文件 | 說明 |
|------|------|
| [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md) | 本摘要 |
| [../../00_planning/infra/upgrades/IMMICH_v2.7.5.md](../../00_planning/infra/upgrades/IMMICH_v2.7.5.md) | 完整 checklist |

## 環境

- URL: `https://immich.3q.fi`
- Manifest: `infra-bootstrap/60_apps/immich/immich-deployment.yaml`
