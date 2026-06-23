# Round-Trip 測試報告 — cpp — cpp_string_at

## 摘要

| # | 程式 | 描述 | 結果 | 細節 |
|---|------|------|------|------|
| t01 | generate literal | SemanticNode → `word[1]` | ✅ PASS | |
| t02 | generate variable index | SemanticNode → `msg[i]` | ✅ PASS | |
| t03 | generate missing index | SemanticNode → `str[0]` | ✅ PASS | |
| t04 | P1 basic char access | lift→generate→re-lift stable | ✅ PASS | |
| t05 | P2 variable index | lift→generate→re-lift stable | ✅ PASS | |
| t06 | P3 while loop char | lift→generate→re-lift stable | ✅ PASS | |
| t07 | P4 first char compare | lift→generate→re-lift stable | ✅ PASS | |
| t08 | P5 count occurrences | lift→generate→re-lift stable | ✅ PASS | |
| t09 | concept identity lift | `str[i]` lifts as `array_access` | 🟡 DEGRADED (expected) | |
| t10 | generate compilable | SemanticNode → compiles/correct | ✅ PASS | |

**摘要：10/10 PASS（t09 為預期降級）**

## 設計決策

**Lift 方向（code → semantic）**：`str[i]` 在 C++ 中以 `subscript_expression` 表示，
lifter 無法在編譯期得知 LHS 是 `string` 還是 `array`，因此統一降級為 `array_access`。
此為設計決策（acceptable degradation），非 bug。

**Generate 方向（semantic → code）**：SemanticNode with `cpp_string_at` 正確產生 `str[i]`。
積木側（Blockly）的 dropdown 只顯示 `cpp_string_declare` 的字串變數，確保語義正確性。

## 信心等級分布

- Lift 方向：`str[i]` 升為 `array_access`（high confidence）
- Generate 方向：直接對應，無降級

## 已知限制

- `str[i]` 從 code 端無法 lift 為 `cpp_string_at`（型別資訊不足）
- 往後若導入型別推斷，可升級 lift 路徑

## 測試檔

`tests/integration/roundtrip-cpp-string-at.test.ts`（10 個測試案例）
