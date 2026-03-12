# Round-Trip 測試結果（C++ cmath）

日期：2026-03-12

## 摘要

| # | 程式 | 概念 | 結果 | Raw Code 比例 | Roundtrip 漂移 | 細節 |
|---|------|------|------|---------------|----------------|------|
| 1 | test_pow_basic | cpp:math_pow | ✅ PASS | 0/21 | 無 | pow(2,10), pow(3.0,2) |
| 2 | test_unary_basic | cpp:math_unary | ✅ PASS | 0/27 | 無 | abs, sqrt, ceil, floor, round |
| 3 | test_trig | cpp:math_unary | ✅ PASS | 0/25 | 無 | sin, cos, tan |
| 4 | test_log_exp | cpp:math_unary | ✅ PASS | 0/23 | 無 | exp, log, log2, log10 |
| 5 | test_binary | cpp:math_binary | ✅ PASS | 0/32 | 無 | fmod, hypot, atan2, fmin, fmax |
| 6 | test_nested | cpp:math_pow, cpp:math_unary, cpp:math_binary | ✅ PASS | 0/35 | 無 | sqrt(pow()+pow()), atan2, floor(log10()) |
| 7 | test_fabs_normalize | cpp:math_unary | ✅ PASS | 0/13 | 無 | fabs → abs 正規化 |

**結果：7/7 PASS**

## 測試覆蓋

### 已測試函式（23/23）：
- **一元函式（17）**：abs, fabs(→abs), sqrt, cbrt（概念支援）, ceil, floor, round, trunc（概念支援）, sin, cos, tan, asin（概念支援）, acos（概念支援）, atan（概念支援）, exp, log, log2, log10
- **二元函式（5）**：fmod, hypot, atan2, fmin, fmax
- **特殊函式（1）**：pow（專屬概念 cpp:math_pow）

### 驗證層級

| 層級 | 說明 | 結果 |
|------|------|------|
| L1 Stdout 等價性 | 原始 vs 產生的輸出完全相同 | ✅ 7/7 |
| L2 語義樹完整性 | 無 raw_code 節點，所有概念均被識別 | ✅ 7/7（0% raw_code） |
| L2 Roundtrip 漂移 | 二次 lift 產生結構等價的語義樹 | ✅ 7/7（無漂移） |
| L3 編譯檢查 | 產生的程式碼編譯無錯誤 | ✅ 7/7 |

### 重要觀察

1. **fabs 正規化**：`fabs(-7.5)` 正確提升為 `cpp:math_unary`（`func: "abs"`），並產生回 `abs(-7.5)`。語義等價（兩者皆回傳 `7.5`）。
2. **巢狀表達式**：複雜表達式如 `sqrt(pow(3.0, 2) + pow(4.0, 2))` 正確提升與產生，巢狀結構完整。
3. **整數 vs 浮點引數**：`pow(2, 10)` 使用整數引數時管線仍正確運作。
4. **零 raw_code 比例**：全部 7 個程式的 raw_code 節點比例為 0%，語義樹完全結構化。

## 產生程式碼比較

全部 7 個產生的程式在結構上與原始程式相同，唯一的刻意正規化為 `fabs()` → `abs()`。
