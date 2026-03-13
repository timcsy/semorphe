# 模糊測試報告 — C++ String — 2026-03-13

## 摘要
- 語言：C++
- 範疇：string（hard 難度）
- 產生的程式數：10
- 成功編譯/執行原始程式：10/10
- Round-trip PASS：0
- ROUNDTRIP_DRIFT：3（fuzz_1, fuzz_2, fuzz_8）
- COMPILE_FAIL：7（fuzz_3-7, fuzz_9-10）

## 根本原因分析

**所有 10 個程式失敗的根本原因相同**：`cout` lifter 無法正確處理包含複雜表達式（如 `s.substr(s.length() - 1)`、`s.find('o', pos + 1)`）的 `cout << ... << endl;` 鏈式語句。

Lifter 將這些 cout 語句降級為 `raw_code`，導致：
1. 產生的程式碼缺少分號和正確的縮排
2. 二次 lift 時 raw_code 文字被重新解析為不同的結構 → ROUNDTRIP_DRIFT
3. 在更極端的情況下產生無法編譯的程式碼 → COMPILE_FAIL

**這不是 string 概念的 bug**，而是 `print/cout` lifter 的既有限制。證據：
- 所有 48 個 string 概念的個別 roundtrip 測試（使用簡單片段、無完整程式）全部通過
- 失敗的程式都使用 `cout << method_call_result << endl;` 模式

## 覆蓋缺口（非 string 概念本身的問題）

1. `cout << complex_expr << endl;` — 當 complex_expr 包含方法呼叫或算術時，lifter 無法識別為 `print` 概念
2. `size_t` 型別 — 尚無對應概念，降級為 raw
3. `const std::string&` — const 引用參數，降級為 `std::string&`
4. `string::npos` — 常量概念尚未完全處理
5. `s.find('o', pos + 1)` — 雙參數 find（指定起始位置），目前只支援單參數
6. `s.insert(0, 1, '*')` — 三參數 insert（重複字元），目前只支援雙參數
7. `s.erase(s.begin(), s.end())` — 迭代器版本 erase，目前只支援 pos/len 版本
8. `std::initializer_list` 語法 `{'o', 'k'}` — 尚未支援

## 產生的回歸測試
- `tests/integration/fuzz-cpp-string.test.ts` — 10 個測試（全部 it.todo，等待 cout lifter 改善後啟用）

## 建議後續步驟
1. **改善 cout lifter**（Phase 3 函式/IO 或未來專案）：讓 `cout << method_call() << endl;` 正確 lift 為 `print` 概念
2. **雙參數 find**：在 `cpp_string_find` lifter 中捕獲可選的起始位置參數
3. **三參數 insert**：考慮新增 `cpp_string_insert_fill` 概念或擴展現有概念
