# Round-Trip 測試結果（C++ — `cpp:this`）

> 2026-11-06，元件管線 311。永久測試：`tests/integration/roundtrip-cpp-this.test.ts`。
> 執行的判準是 Cella（參照編譯器族 2026-11-04 退場）；預期輸出照手算，第五支另用本機 clang（專案的標頭墊片）對過：`10`。

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | 取成員 | this, struct_at_ptr | ✅ PASS | `return this->x;`；輸出 7 |
| 2 | 建構子裡參數遮蔽成員 | this, struct_at_ptr, var_assign | ✅ PASS | `this->x = x;`；輸出 5 |
| 3 | 呼叫自己的方法 | this, method_call（->） | ✅ PASS | `return this->twice();`；輸出 8 |
| 4 | 回傳自己串接呼叫 | this, pointer_deref | ✅ PASS | `return *this;`；輸出 3 |
| 5 | 比較是不是同一個物件 | this, compare, address_of | ✅ PASS | `return this == o;`；輸出 10 |

摘要：**5/5 PASS**。每支：元件身分（`cpp:this` 恰好一顆、零降級）、產碼一字不差、再 lift 結構相同、Cella accept 且輸出相同。

- 信心分布：pattern 直接對應（`this` 一對一），無 composite、無一對多映射。
- 層級三、四（多分支鷹架、層級轉換）：課程清單已是平坦的元件清單（無 levelTree），不適用。
- 層級五（積木與程式碼一致）：積木「這個物件」＝ C++ 的 `this`（tooltip 說明它是指標、用「指標的欄位」取成員）。
