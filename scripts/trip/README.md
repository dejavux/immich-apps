# Trip probe scripts（暫存）

Family Memory / 行前行程比較用的雄獅搜尋 prototype。  
核心邏輯已遷至 `apps/planner`（adapter）與 `packages/planner-schema`（型別）；本目錄保留薄 CLI wrapper。

## 用法

```bash
# 關鍵字＋日期 → 列表
npx tsx scripts/trip/search-lion-tours.ts --keyword 濟州 --from 2026-08-01 --to 2026-08-07

# fixture 摘要比較
npx tsx scripts/trip/summary-lion-tour.ts --fixture scripts/trip/fixtures/jeju-compare.json --format table
```

## Planner 服務（A0 scaffold）

```bash
npm run planner:dev          # 本機 :3001
npm run test:planner         # adapter 單元測試
npm run type-check:planner   # schema + planner 型別檢查
curl http://127.0.0.1:3001/health
```
