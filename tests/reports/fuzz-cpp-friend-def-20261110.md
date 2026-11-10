# 模糊測試報告：C++ 類別裡帶本體的 friend（2026-11-10）

## 摘要
- 語言：C++；隔離的出題者寫了 4 支，全部可編譯執行
- Round-trip PASS：4（再 lift 不漂移；產回去的程式碼補上 using namespace std 後，clang++ 輸出與原程式相同）
- 發現 bug：3，全部已修，零 todo
- EXPECTED_DEGRADATION：1（fuzz_2 的多維陣列欄位）
- Cella：4 支都照實回 untranslated，等 `mbFriendDef`

## 修掉的 bug
1. 類別裡帶名字的 `struct Node { … };` 名字被清掉（COMPILE_FAIL、ROUNDTRIP_DRIFT）。
2. 預設 private 區宣告型別時，產碼把 public 排前面，用到該型別的成員簽名編不過（COMPILE_FAIL）。
3. 類別裡的 `enum Color { RED };`、`class B { … };` 多編出欄位 `x`（探針延伸，SEMANTIC_DIFF）。

## 回歸測試
`tests/integration/fuzz-cpp-friend-def.test.ts`（13 支）
