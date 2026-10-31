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

## 量測紀錄（T015，2026-10-31，開發伺服器、本機 Chrome）

| | 從「載入中」到就緒 | 說明 |
|---|---|---|
| 第一次（沒有快取） | 25.7 秒 | 下載套件＋載入＋編譯判決模組 |
| 第二次（IndexedDB 有編好的模組） | **0.16 秒** | 不下載套件、不編譯——編好的模組不需要 Cella 執行環境 |

SC-004（第二次少一半）：達成，少了 99%。建置版的 e2e 從暖機到判出越界約 30 秒（`e2e/cella-verdict.spec.ts`）。
