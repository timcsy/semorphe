# 模糊測試報告 — C++ numeric — 2026-03-15

## 摘要
- 語言：C++
- 產生的程式數：10
- Round-trip PASS：8
- ROUNDTRIP_DRIFT：2（全為已知 pre-existing lifter limitation）
- numeric 特有 bug：0

## ROUNDTRIP_DRIFT 分析

### fuzz_4: lcm chain with C-style array initializer
- **根因**：`int nums[] = {2, 3, 4, 5}` 的陣列初始化器遺失（已知限制）
- **非 numeric bug**：lcm 本身正確 lift 和 generate

### fuzz_10: struct + iota + accumulate
- **根因**：struct 型別的函式參數處理不完整（已知限制）
- **非 numeric bug**：iota 和 accumulate 本身正確

## 結論
所有 5 個 numeric 概念（accumulate、iota、partial_sum、gcd、lcm）在模糊測試中都正確運作。
包含 4-arg accumulate（帶 functor/lambda）、partial_sum with multiplies、gcd/lcm chain 等進階用法。
