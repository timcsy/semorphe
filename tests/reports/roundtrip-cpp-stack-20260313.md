# Round-Trip 測試結果：C++ `<stack>`

日期：2026-03-13
分支：044-cpp-std-containers

## 摘要

- 語言：C++
- 概念：cpp_stack_declare, cpp_stack_push, cpp_stack_pop, cpp_stack_top, cpp_stack_empty
- 測試程式數：7（5 單概念 + 2 組合）
- PASS: 7, DEGRADED: 0, FAIL: 0

## 結果

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | stack_declare | cpp_stack_declare | ✅ PASS | P1 穩定 |
| 2 | stack_push | cpp_stack_push | ✅ PASS | P1 穩定 |
| 3 | stack_top | cpp_stack_top | ✅ PASS | P1 穩定 |
| 4 | stack_pop | cpp_stack_pop | ✅ PASS | P1 穩定 |
| 5 | stack_empty | cpp_vector_empty (共享) | ✅ PASS | P1 穩定，.empty() 歸入 vector |
| 6 | combo1 | push + top + pop | ✅ PASS | P1 穩定 |
| 7 | combo2 | push + empty + pop loop | ✅ PASS | P1 穩定 |

## 驗證層級

- **層級一（P1 投影定理）**：7/7 通過 — 二次 round-trip 產生一致的程式碼
- **層級五（積木-程式碼一致性）**：BlockSpec message 與 generator 輸出語義一致

## 備註

- `.empty()` 和 `.size()` 是共享方法，lifter 統一歸為 cpp_vector_empty / cpp_vector_size，但生成的程式碼語法正確（`s.empty()` / `s.size()`）
- `.push()` 和 `.pop()` 在 stack 和 queue 之間共享，lifter 預設歸為 stack 概念
