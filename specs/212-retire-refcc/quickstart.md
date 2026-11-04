# Quickstart：驗收 6c-5

1. **npm test 不再呼叫參照編譯器**
   `npx vitest run tests/integration/audit-cella-only.test.ts` → 綠（硬性零：探針以外零個檔 import `tests/helpers/run-cpp`）。
2. **沒有墊片也全綠**
   在**沒有** `SEMORPHE_REFCC_INCLUDE` 的 shell：`tools/long-test.sh <worktree> <out> --suite` → 全綠；記下時間，對照 14.8 分。
3. **課文答案的比對是斷言**
   把任一課 `check.stdout` 改錯一個字 → 新的課文比對測試紅、指名那一課；還原 → 綠。
4. **交叉檢查探針**
   `SEMORPHE_REFCC_PROBE=1 SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim npx vitest run tests/probes/refcc-cross-check.test.ts` → 列出「g++ 與 Cella 輸出不同」的程式（預期 0，或每一筆附判斷）；不開環境變數 → 跳過。
5. **e2e 與 CI**：整輪 e2e 綠；合併後 `gh run list --limit 3` 兩條綠。
