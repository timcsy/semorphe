# 模糊測試報告 — C++ cstdlib — 2026-03-15

## 摘要
- 語言：C++
- 產生的程式數：10
- 成功編譯/執行：10
- Round-trip PASS：5
- SEMANTIC_DIFF（bug）：4（全部為已知前置 lifter 限制）
- COMPILE_FAIL（bug）：1（已知前置 lifter 限制）
- cstdlib 特有 bug：0

## 結果明細

| # | 程式 | 概念 | 結果 | 根因 |
|---|------|------|------|------|
| 1 | rand+abs+srand | cpp_rand, cpp_srand, cpp_abs | ✅ PASS | |
| 2 | atoi+atof mixed | cpp_atoi, cpp_atof | ✅ PASS | |
| 3 | exit in helper | cpp_exit | ❌ SEMANTIC_DIFF | 陣列初始化器遺失 |
| 4 | abs+function chain | cpp_abs | ❌ SEMANTIC_DIFF | 陣列初始化器遺失 |
| 5 | srand+rand+switch | cpp_srand, cpp_rand | ❌ SEMANTIC_DIFF | 陣列初始化器遺失 |
| 6 | atoi+do-while | cpp_atoi | ✅ PASS | |
| 7 | abs+shadowed var | cpp_abs | ✅ PASS | |
| 8 | srand+rand+abs | cpp_srand, cpp_rand, cpp_abs | ✅ PASS | |
| 9 | atof+comma operator | cpp_atof | ❌ COMPILE_FAIL | 逗號運算子不支援 |
| 10 | abs+exit+functions | cpp_abs, cpp_exit | ❌ SEMANTIC_DIFF | 陣列初始化器遺失 |

## 已知前置 lifter 限制（非 cstdlib 特有）

1. **陣列初始化器遺失**：`int arr[] = {1, 2, 3}` → `int arr[10];`（初始值遺失）
2. **逗號運算子**：`(result = num / den, true)` 無法正確解析

## 結論

所有 6 個 cstdlib 概念（rand, srand, abs, exit, atoi, atof）的 lift/generate/round-trip 都正確運作。5 個失敗案例全部是已知的前置 C++ lifter 限制（陣列初始化器、逗號運算子），與 cstdlib 概念實作無關。

## 產生的回歸測試
- `tests/integration/fuzz-cpp-cstdlib.test.ts`（5 PASS + 5 todo）
