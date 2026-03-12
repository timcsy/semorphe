# 模糊測試報告 — C++ cmath — 2026-03-12

## 摘要

- 語言：C++
- 範疇：`<cmath>` 數學函式
- 產生的程式數：12
- 成功編譯執行：12
- Round-trip PASS：11
- STDOUT_DIFF（bug）：1（fuzz_12 — 陣列初始化列表遺失）
- COMPILE_FAIL（bug）：0
- LIFT_FAIL（限制）：0
- EXPECTED_DEGRADATION：0
- ROUNDTRIP_DRIFT：1（fuzz_12 — 與 STDOUT_DIFF 同源）
- Raw code 比例：全部 0%

## 測試涵蓋

| # | ID | 難度 | 說明 | 概念 | Raw Code | Drift | 結果 |
|---|-----|------|------|------|----------|-------|------|
| 1 | fuzz_1 | easy | abs/fabs 整數與浮點 | cpp:math_unary | 0/23 | 無 | ✅ PASS |
| 2 | fuzz_2 | easy | ceil/floor/round/trunc 正負數 | cpp:math_unary | 0/43 | 無 | ✅ PASS |
| 3 | fuzz_3 | easy | sqrt/cbrt/pow 基本用法 | cpp:math_unary, cpp:math_pow | 0/24 | 無 | ✅ PASS |
| 4 | fuzz_4 | medium | 三角函式 sin/cos/tan + pi 計算 | cpp:math_unary | 0/63 | 無 | ✅ PASS |
| 5 | fuzz_5 | medium | log/log2/log10/exp + 換底公式 | cpp:math_unary | 0/36 | 無 | ✅ PASS |
| 6 | fuzz_6 | medium | fmod/fmin/fmax/hypot + 負數 fmod | cpp:math_binary | 0/44 | 無 | ✅ PASS |
| 7 | fuzz_7 | medium | atan2 四象限 + 角度轉換 | cpp:math_unary, cpp:math_binary | 0/55 | 無 | ✅ PASS |
| 8 | fuzz_8 | hard | 巢狀距離公式 + 角度 + static_cast | cpp:math_unary, cpp:math_pow, cpp:math_binary | 0/71 | 無 | ✅ PASS |
| 9 | fuzz_9 | hard | NaN/Inf 邊界：sqrt(-1), log(0), NAN | cpp:math_unary, cpp:math_pow, cpp:math_binary | 0/44 | 無 | ✅ PASS |
| 10 | fuzz_10 | hard | 整數引數隱式提升 + static_cast | cpp:math_unary, cpp:math_pow | 0/53 | 無 | ✅ PASS |
| 11 | fuzz_11 | hard | 反三角函式恆等式 + 精度控制 | cpp:math_unary, cpp:math_pow | 0/83 | 無 | ✅ PASS |
| 12 | fuzz_12 | hard | 二次公式 + 陣列範數 + 迴圈 | cpp:math_pow, cpp:math_unary, cpp:math_binary | 0/96 | **有** | ❌ STDOUT_DIFF |

## 發現的 Bug

### Bug 1：陣列初始化列表遺失（fuzz_12）

- **嚴重度**：高（STDOUT_DIFF — 語義不同）
- **影響範圍**：非 cmath 問題，而是陣列宣告 lifter 的已知限制

- **輸入**：
  ```cpp
  double coords[] = {3.0, 4.0, 5.0};
  double norm = sqrt(pow(coords[0], 2) + pow(coords[1], 2) + pow(coords[2], 2));
  cout << round(norm * 1000.0) / 1000.0 << endl;
  ```

- **預期輸出**：`7.071`
- **實際輸出**：`0`

- **產生的程式碼**：
  ```cpp
  double coords[10];  // 初始化列表 {3.0, 4.0, 5.0} 遺失！
  double norm = sqrt(pow(coords[0], 2) + pow(coords[1], 2) + pow(coords[2], 2));
  cout << round(norm * 1000.0) / 1000.0 << endl;
  ```

- **根本原因**：陣列宣告的 lifter（`array_declare` 概念）不支援初始化列表（initializer list）。`double coords[] = {3.0, 4.0, 5.0}` 被提升為 `array_declare` 但初始值丟失，generator 輸出時沒有初始化列表，只有空陣列宣告 `double coords[10]`。

- **修復建議**：擴展 `array_declare` 概念或新增 `array_declare_init` 概念，支援初始化列表語法。這是 `/concept.discover cpp array_initializer_list` 的候選。

## 覆蓋缺口

| 缺口 | 出現在 | 影響 |
|------|--------|------|
| 陣列初始化列表 `{...}` | fuzz_12 | 陣列初始值丟失導致語義不同 |

> 注意：`isnan()`、`isinf()`、`NAN` 常量雖然通過了管線（fuzz_9），但它們是以通用 `func_call_expr` 處理的，不是專屬概念。若需要更精確的語義表達，可考慮未來新增這些概念。

## cmath 概念品質評估

所有 12 個程式的 cmath 相關節點（`cpp:math_unary`、`cpp:math_pow`、`cpp:math_binary`）全部正確提升和產生，零 raw_code。唯一的 bug 來自陣列初始化（非 cmath 範疇）。

**cmath 模組品質：優秀** — 通過所有模糊測試（11/11 cmath 相關 PASS，1 個失敗與 cmath 無關）。
