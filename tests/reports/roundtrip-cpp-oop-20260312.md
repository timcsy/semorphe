# Round-Trip 測試結果（C++ OOP 概念）

日期：2026-03-12

## 摘要

| # | 程式 | 概念 | 編譯 | Stdout | Raw 節點 | P1 穩定 | 結果 | 問題 |
|---|------|------|------|--------|----------|---------|------|------|
| 1 | simple_struct | cpp_struct_declare | ❌ | - | 0/19 | ✅ | ❌ FAIL | struct 產生為 `/* unknown concept */` |
| 2 | class_basic | cpp_class_def | ✅ | ✅ | 0/20 | ✅ | ✅ PASS | - |
| 3 | constructor | cpp_constructor, cpp_class_def | ✅ | ✅ | 1/18 | ❌ | ⚠️ DRIFT | 建構呼叫 `C(10)` → `C = (10)\n`；P1 第二輪修正為 `C = 10` |
| 4 | destructor | cpp_destructor, cpp_constructor, cpp_class_def | ✅ | ✅ | 1/27 | ❌ | ⚠️ DRIFT | 同上：建構呼叫語法漂移 |
| 5 | virtual_method | cpp_virtual_method, cpp_class_def | ✅ | ✅ | 0/15 | ✅ | ✅ PASS | - |
| 6 | operator_overload | cpp_operator_overload, cpp_class_def | ✅ | ✅ | 0/40 | ✅ | ✅ PASS | - |
| 7 | struct_func | cpp_struct_declare | ❌ | - | 0/22 | ✅ | ❌ FAIL | struct 產生為 `/* unknown concept */` |
| 8 | class_methods | cpp_constructor, cpp_class_def | ✅ | ✅ | 1/27 | ❌ | ⚠️ DRIFT | 建構呼叫語法漂移 |
| 9 | pure_virtual | cpp_pure_virtual, cpp_class_def | ✅ | ✅ | 0/12 | ✅ | ✅ PASS | - |
| 10 | combined_oop | cpp_struct_declare, cpp_class_def, cpp_constructor, cpp_destructor | ❌ | - | 1/38 | ❌ | ❌ FAIL | struct 遺失 + 建構呼叫漂移 |

**結果：4/10 完全通過、3/10 可編譯但有漂移、3/10 編譯失敗**

## 發現的問題

### 問題 1：cpp_struct_declare 無產生器（嚴重）

`cpp_struct_declare` 概念可以成功 lift，但 code generator 產生 `/* unknown concept: cpp_struct_declare */`。struct 定義完全遺失，導致後續使用該 struct 的程式碼無法編譯。

- **影響程式**：simple_struct、struct_func、combined_oop
- **根因**：缺少 cpp_struct_declare 的 code template 或 hand-written generator

### 問題 2：建構式呼叫語法漂移（中等）

`Counter c(10)` 被 lift 為 var_declare，但產生為 `Counter c = (10)\n`（包含多餘括號和換行）。雖然在 C++ 中 `Counter c = 10` 語法等價（隱式轉換），但：

1. 第一輪產生 `= (10)\n`（有括號 + 多餘換行）
2. 第二輪修正為 `= 10`（無括號）
3. P1 漂移：gen1 ≠ gen2（但 gen2 = gen3，漂移在第二輪收斂）

- **影響程式**：constructor、destructor、class_methods、combined_oop
- **根因**：建構呼叫 `Type name(args)` 被 lift 為帶初始化的變數宣告，初始化器包含括號表達式 `(10)` 被視為 parenthesized expression，並被標記為 unresolved

### 問題 3：cpp_struct_member_access 的 lift 成功（正面觀察）

`p.x` 形式的成員存取正確 lift 為 `cpp_struct_member_access` 並正確產生回。

## 驗證層級

| 層級 | 說明 | 結果 |
|------|------|------|
| L1 Stdout 等價性 | 原始 vs 產生的輸出完全相同 | ✅ 7/7（可編譯的程式） |
| L2 語義樹完整性 | 無 unresolved 節點 | ⚠️ 6/10（4 個含 unresolved） |
| L2 Roundtrip 漂移 | 二次 lift 產生結構等價的語義樹 | ⚠️ 6/10（4 個有漂移） |
| L3 編譯檢查 | 產生的程式碼編譯無錯誤 | ⚠️ 7/10（3 個編譯失敗） |

## 各概念狀態

| 概念 | Lift | Generate | Roundtrip | 備註 |
|------|------|----------|-----------|------|
| cpp_struct_declare | ✅ | ❌ | ❌ | 缺產生器 |
| cpp_class_def | ✅ | ✅ | ✅ | 完整支援 |
| cpp_constructor | ✅ | ✅ | ✅ | 定義本身正確 |
| cpp_destructor | ✅ | ✅ | ✅ | 完整支援 |
| cpp_virtual_method | ✅ | ✅ | ✅ | 完整支援 |
| cpp_pure_virtual | ✅ | ✅ | ✅ | 完整支援 |
| cpp_operator_overload | ✅ | ✅ | ✅ | 完整支援 |
| 建構呼叫（`Type v(args)`） | ⚠️ | ⚠️ | ❌ | lift 為 var_declare + unresolved init |
