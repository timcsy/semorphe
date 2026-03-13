# Round-Trip 測試結果：C++ `<vector>`

日期：2026-03-13
分支：044-cpp-std-containers

## 摘要

- 語言：C++
- 概念：cpp_vector_declare, cpp_vector_push_back, cpp_vector_size, cpp_vector_pop_back, cpp_vector_clear, cpp_vector_empty, cpp_vector_back
- 測試程式數：10（7 單概念 + 3 組合）
- PASS: 10, DEGRADED: 0, FAIL: 0

## 結果

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | vec_declare | cpp_vector_declare, cpp_vector_size | ✅ PASS | raw=0/11 |
| 2 | vec_push_back | cpp_vector_push_back, cpp_vector_size | ✅ PASS | raw=0/17 |
| 3 | vec_size | cpp_vector_size | ✅ PASS | raw=0/17 |
| 4 | vec_pop_back | cpp_vector_pop_back | ✅ PASS | raw=0/18 |
| 5 | vec_clear | cpp_vector_clear | ✅ PASS | raw=0/16 |
| 6 | vec_empty | cpp_vector_empty | ✅ PASS | raw=0/13 |
| 7 | vec_back | cpp_vector_back | ✅ PASS | raw=0/15 |
| 8 | vec_combo1 | push_back + size + back | ✅ PASS | raw=0/20 |
| 9 | vec_combo2 | push_back + pop_back + empty | ✅ PASS | raw=0/19 |
| 10 | vec_combo3 | push_back + clear + size | ✅ PASS | raw=0/18 |

## 驗證層級

- **層級一（Stdout 等價性）**：10/10 通過 — 原始程式和產生程式的 stdout 完全相同
- **層級二（P1 投影定理）**：10/10 通過 — 二次 round-trip (lift→generate→re-lift→re-generate) 產生一致的程式碼，raw_code 節點比例 0%
- **層級五（積木-程式碼一致性）**：BlockSpec message 與 generator 輸出語義一致

## 修復的 Bug

1. **template_type lifter**：`vector<int> v;` 原被 lift 為 `var_declare { type: "int" }`，因 `liftDeclaration` strategy 不認識 `template_type`。已修復：加入 template_type 偵測，辨識 vector/stack/queue/set/map/pair 容器宣告。
2. **Lifter 方法衝突**：Phase 8 的 `tryMethodCallLift` 攔截了共享方法（empty, clear, push_back），導致 METHOD_TO_CONCEPT 成為死碼。已修復：重構為 `tryStringMethodLift`，只處理 string-only 方法。
3. **advanced-features 測試**：`roundtrip-cpp-advanced-features.test.ts` 中有個測試預期 vector<int> 會降級，已更新為預期正確行為。
