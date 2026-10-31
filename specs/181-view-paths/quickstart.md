# Quickstart：驗證第 181 號 spec

前置：`npm install`；長測試前先確認 cella 沒有在跑（`pgrep -f '[c]ella/target|[c]argo test|[c]ella check'`）。

1. **宣告全部是新形狀**：`npx vitest run tests/unit/core/component-paths.test.ts tests/integration/audit-completeness.test.ts`
   ——349 顆都載得進登錄表；舊鍵 0 次。
2. **顯式的空一顆不差**：轉換腳本印出的新舊計數逐格相同（lift null 7、generate null 3、execute null 23、render／extract null 1、liftStrategy 78）。
3. **判定者對照數字不變**：`npx vitest run tests/integration/audit-judge-coverage.test.ts`——`byPath` 只換鍵名。
4. **加一個視圖不加動詞**：契約測試裡給一顆元件加單向的假視圖 → 接受；只寫 lift → 擋下；未知視圖名 → 擋下。
5. **行為不變**：`SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim npm test` 全綠；`npm run test:e2e` 全綠。
6. **知識庫**：`npx vitest run tests/integration/audit-knowledge-links.test.ts` 綠；P2、五槽、完備性 ⑤ 的文字是定案版。
