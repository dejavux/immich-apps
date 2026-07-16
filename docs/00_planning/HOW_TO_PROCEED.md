# 如何進行 — Immich Apps 執行指南

**日期**: 2026-07-16  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**Family Memories**: [FAMILY_MEMORIES_ARCHITECTURE.md](./FAMILY_MEMORIES_ARCHITECTURE.md) · [planner/10_PHASE_A_IMPLEMENTATION_PLAN.md](./planner/10_PHASE_A_IMPLEMENTATION_PLAN.md)  
**Gate 狀態**: [agent-prompts/GATE_STATUS.md](./agent-prompts/GATE_STATUS.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
| ------ | ------ |
| **Immich Enhancement** | ✅ **結案** |
| **Family Memories Phase A** | 🟡 **A4 收尾**（A0–A3 已 deploy） |
| LINE Bot cluster | **`cafde37`**（規則解析優先 · Qwen 10s · push 備援） |
| family-planner cluster | **`cafde37`**（`immich` ns · Ingress `planner.3q.fi`） |
| Immich server | **v2.7.5 pin**（anti-drift；v3 cutover 排 **2026-08-09** 提案） |
| **LINE 自然語言搜尋** | ✅ 確認後可搜到；確認 quick reply 仍可能偏慢（Immich CLIP） |
| **使用者驗收** | 🟡 LIFF Passkey · Cursor MCP 連 planner |

```bash
make verify-deploy
kubectl get deploy -n immich immich-line-bot family-planner -o wide
curl -sk https://immich.3q.fi/api/server/version
```

---

## 🔴 本週優先（P0）

### Family Memories A4

1. **Postgres 持久化** — 接 `001_a1_auth.sql`、`002_a2_shortlist_extract.sql`；shortlist / api_key 跨 restart
2. **MCP onboarding** — 撰寫 `docs/20_guides/planner/MCP_SETUP.md`；家人 invite + `~/.cursor/mcp.json`
3. **`planner.3q.fi`** — 對外 DNS → Ingress；`curl https://planner.3q.fi/health`
4. **實戰試跑** — Cursor 走 wizard → search 濟州 → extract → shortlist → compare

### LINE / Memory 維運

5. **LIFF Passkey** — Rich Menu「帳戶設定」實機驗收
6. **搜尋 UX** — 若確認步驟仍 >5s，查 log `durationMs`；必要時預先回「解析中…」

### Ops（並行、非阻塞）

7. **Ops W2** — rsync：`ssh delta.3q.fi 'du -sh .../mac-studio/*'`（**63G/146G** local）
8. **Phase 5b** — Telegram smoke 3 條告警確認

---

## ✅ 已完成（2026-07-15 ~ 07-16）

| 項目 | 備註 |
| ------ | ------ |
| 影片 E2E | 使用者驗證 2026-07-15 |
| `REDIS_URL` | Passkey grant 跨 pod |
| Qwen Instruct | `QWEN_MODEL` + helm |
| LINE 搜尋無回覆 | `cafde37` — 規則解析優先 |
| Planner A0–A3 | wizard · extract · shortlist · MCP · Helm |
| Tekton `release-planner` | 避開本機 registry TLS |
| Immich v2.7.5 pin | production anti-drift |
| v3 spike 程式 | OpenAPI 3.0；**未**升級 prod |

---

## Wave W1 — Phase 5a（PASS）

→ [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

| 項目 | 狀態 |
| ------ | ------ |
| pg 還原演練 | ✅ 13759 = prod |
| pg 排程 2/2 | ✅ |
| NFS data 備份 | ✅ **157.8G** |
| B2 | ⏭️ 已廢止 |

---

## Wave W4 — Phase 4 SSD ✅ COMPLETE（2026-06-24）

Postgres 已遷至 lama NVMe；詳見 [STORAGE_MIGRATION.md](../20_guides/infra/runbooks/STORAGE_MIGRATION.md)。

---

## Ops W2 — Mac library → delta **HDD**（~50%）

→ [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)

| 項目 | 狀態 |
| ------ | ------ |
| 首輪 rsync | 🟡 **63G/146G** local · **17G/18G** icloud |
| LaunchAgent | ✅ 週六 02:00 |

---

## Immich v3 維護窗口（提案）

→ [IMMICH_v3.0_SPIKE.md](../20_guides/infra/upgrades/IMMICH_v3.0_SPIKE.md) §9–§10

| 項目 | 建議 |
| ------ | ------ |
| **首選窗口** | 2026-08-09（六）02:00–05:00 HKT |
| **前置** | spike DoD 全勾 · `pg_dump` · LINE smoke |
| **阻擋** | 無 staging 叢集；v3 E2E 尚未對 prod 驗證 |

---

## 驗證指令

```bash
# LINE Bot
kubectl logs -n immich deploy/immich-line-bot --tail=30 | rg "Photo search|durationMs"

# Planner（叢集內）
kubectl exec -n immich deploy/family-planner -- wget -qO- http://127.0.0.1:3001/health

# Planner（本機 dev）
npm run planner:dev
curl -s http://localhost:3001/health

# 全 repo 測試
npm run test:planner && npm test
```

---

## 下一階段（摘要）

| 優先 | 方向 | 代表項 |
| ------ | ------ | ------ |
| **P0** | Family Memories A4 | Postgres · MCP 指南 · planner DNS |
| **P1** | 產品體驗 | 8 月行程 wizard 實戰 · Web+LINE 驗收 |
| **P1** | Immich v3 | 維護窗口 cutover（8/9 提案） |
| **P2** | 平台 | registry-internal 本機 DNS · Similar images |
| **P3** | AI | Qwen vision · Photo Edit BFF |

完整 backlog → [BACKLOG.md](./BACKLOG.md)
