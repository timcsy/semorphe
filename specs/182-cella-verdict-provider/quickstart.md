# Quickstart：驗證 spec 182

1. **轉換的單元測試**：`npx vitest run tests/unit/core/verdict-diagnostics.test.ts`——契約的五條不變式。
2. **語料**：`npx vitest run tests/probes/c18-verdict.test.ts`——99 支的每個 problem 轉成的診斷，`nodeId` 都在樹裡（SC-001）。
3. **產物大小**：`npm run build` 之後量 `dist/` 裡 `.cell` 與 wasm 的總大小、檔數；記下 gzip 後的大小。
4. **瀏覽器**（`verify-in-browser`）：
   - 打開一支越界讀取的程式 → 等狀態變「可用」→ 越界那一塊高亮、程式碼那一行波浪、中文原因
   - 用到尚未支援構造的程式 → 「判不出來」的樣子（不是紅色）
   - 載入期間編輯與執行照常
   - 重新整理 → 第二次出結果明顯變快
5. **e2e**：`npm run test:e2e`（新增一支：判決標示出現在兩側；載入期間不擋）。
