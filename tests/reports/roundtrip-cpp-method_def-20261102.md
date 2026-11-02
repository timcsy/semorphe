# Round-Trip 測試結果：C++ — cpp:method_def（第 218 刀）

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | t1 const 取值方法在 const& 上呼叫 | method_def(const／非 const)、func_def | ✅ PASS | stdout `22`：原始、產回來、JS 直譯器三方一致；再 lift 同一棵樹 |
| 2 | t2 方法裡呼叫同類別的方法 | method_def、constructor、class_def | ✅ PASS（修後） | 產回來的程式碼一致；JS 直譯器原本 `UNDEFINED_FUNC: get`（既有缺陷）→ 修在 func_call 的執行器 |
| 3 | t3 const 方法用在排序的 lambda 裡 | method_def、lambda、sort | ✅ PASS | stdout 三方一致 |
| 4 | t4 運算子多載＋const 方法＋static 方法 | method_def、operator_overload | ❌ COMPILE_FAIL（既有） | `static int zero()` 走頂層函式那顆、`static` 掉了，`P::zero()` 編不過；main 上同樣。範圍外，`it.todo`＋draft 記錄 |
| 5 | t5 回傳字串、兩個參數 | method_def、string | ✅ PASS | stdout 三方一致 |

摘要：4/5 PASS、1 COMPILE_FAIL（既有缺陷，不是本刀帶進來的；已登記 todo）

- 元件身分：四支 PASS 的程式裡，類別內的成員函式都是 `cpp:method_def`，頂層的仍是 `cpp:func_def`；raw_code／unresolved 0
- 二次 round-trip：產碼是不動點、再 lift 語義樹結構相同
- 永久測試：`tests/integration/roundtrip-cpp-oop.test.ts`（method_def 一組，含 todo）、`tests/integration/interpreter-matches-compiler.test.ts`（成員函式①②③）
