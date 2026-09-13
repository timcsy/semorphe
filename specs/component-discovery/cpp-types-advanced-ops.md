# 概念探索：C++ — 型別系統與進階運算

## 摘要
- 語言：C++
- 目標：const, constexpr, auto, typedef, using alias, sizeof, bitwise, ternary, cast, increment, compound assignment, enum
- 發現概念總數：18（含 statement/expression 雙版本）
- 通用概念：1（bitwise_not）、語言特定概念：17
- 建議歸屬的 Topic 層級樹節點：L1a（4）、L1b（6）、L1c（5）、L3c（4）

## 現有實作狀態

大多數概念在先前的手寫實作中已有完整的 generator、lifter、executor。主要缺口：

| 概念 | Generator | Lifter | Executor | 備註 |
|------|-----------|--------|----------|------|
| cpp_const_declare | ✅ | ✅ | ✅ | |
| cpp_constexpr_declare | ✅ | ✅ | ✅ | |
| cpp_auto_declare | ✅ | ✅ | ✅ | |
| cpp_typedef | ✅ | ✅ | ✅ noop | |
| cpp_using_alias | ✅ | ✅ | ✅ noop | |
| cpp_sizeof | ✅ | ✅ | ✅ | |
| bitwise_not | ✅ | ✅ | ✅ | 通用概念；二元位元運算由 arithmetic 處理 |
| cpp_ternary | ✅ | ✅ | ✅ | |
| cpp_cast | ✅ | ✅ | ✅ | C-style cast |
| cpp_static_cast | ✅ | ❌ | ❌ | **缺 lifter 和 executor** |
| cpp_dynamic_cast | ✅ | ❌ | ❌ | **缺 lifter 和 executor** |
| cpp_reinterpret_cast | ✅ | ❌ | ❌ | **缺 lifter 和 executor** |
| cpp_const_cast | ✅ | ❌ | ❌ | **缺 lifter 和 executor** |
| cpp_increment / _expr | ✅ | ✅ | ✅ | statement + expression 雙版本 |
| cpp_compound_assign / _expr | ✅ | ✅ | ✅ | statement + expression 雙版本 |
| cpp_enum | ✅ | ✅ | ✅ noop | |

## 概念目錄

### L1a: 函式與迴圈 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_increment | `x++` / `++x` | 變數遞增/遞減 | 變數名, 運算子(++/--), 前/後綴 | lang-core | cpp | var_assign | statement 版本 |
| cpp_increment_expr | `x++` / `++x` | 遞增/遞減表達式 | 同上 | lang-core | cpp | arithmetic | expression 版本 |
| cpp_compound_assign | `x += 5` | 複合賦值 | 變數名, 運算子, 值 | lang-core | cpp | var_assign | statement 版本 |
| cpp_compound_assign_expr | `x += 5` | 複合賦值表達式 | 同上 | lang-core | cpp | arithmetic | expression 版本 |

### L1b: 控制流進階 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_sizeof | `sizeof(int)` | 取得型別/表達式大小 | 型別名稱 | lang-core | cpp | func_call_expr | |
| bitwise_not | `~x` | 位元反轉 | 運算元 | lang-core | universal | raw_code | 二元位元運算由 arithmetic 概念處理 |
| cpp_ternary | `a ? b : c` | 條件表達式 | 條件, 真值, 假值 | lang-core | cpp | if | |
| cpp_cast | `(int)x` | C 風格型別轉換 | 目標型別, 表達式 | lang-core | cpp | raw_code | |
| cpp_enum | `enum Color { R, G, B }` | 列舉型別宣告 | 名稱, 值列表 | lang-core | cpp | raw_code | |

### L1c: 型別系統 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_const_declare | `const int x = 5` | 常數宣告 | 型別, 名稱, 初始值 | lang-core | cpp | var_declare | |
| cpp_constexpr_declare | `constexpr int x = 5` | 編譯期常數 | 型別, 名稱, 初始值 | lang-core | cpp | var_declare | |
| cpp_auto_declare | `auto x = 5` | 型別推導宣告 | 名稱, 初始值 | lang-core | cpp | var_declare | |
| cpp_typedef | `typedef int Int` | 型別別名 | 原型別, 新名稱 | lang-core | cpp | raw_code | 宣告性，noop |
| cpp_using_alias | `using Int = int` | 型別別名（現代語法） | 新名稱, 原型別 | lang-core | cpp | raw_code | 宣告性，noop |

### L3c: 例外與進階 — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_static_cast | `static_cast<int>(x)` | 靜態型別轉換 | 目標型別, 表達式 | lang-core | cpp | cpp_cast | **缺 lifter** |
| cpp_dynamic_cast | `dynamic_cast<B*>(p)` | 動態型別轉換 | 目標型別, 表達式 | lang-core | cpp | cpp_cast | **缺 lifter** |
| cpp_reinterpret_cast | `reinterpret_cast<int*>(p)` | 重新解釋轉換 | 目標型別, 表達式 | lang-core | cpp | cpp_cast | **缺 lifter** |
| cpp_const_cast | `const_cast<int*>(p)` | 常數轉換 | 目標型別, 表達式 | lang-core | cpp | cpp_cast | **缺 lifter** |

## 依賴關係圖

```
var_declare ← cpp_const_declare, cpp_constexpr_declare, cpp_auto_declare
var_assign ← cpp_increment, cpp_compound_assign
arithmetic ← cpp_increment_expr, cpp_compound_assign_expr, bitwise_not
if ← cpp_ternary
cpp_cast ← cpp_static_cast, cpp_dynamic_cast, cpp_reinterpret_cast, cpp_const_cast
```

## 建議實作順序

大多數概念已有完整實作，只需驗證 round-trip。需要補完的：

1. **cpp_static_cast** — 補 lifter + executor
2. **cpp_dynamic_cast** — 補 lifter + executor
3. **cpp_reinterpret_cast** — 補 lifter + executor
4. **cpp_const_cast** — 補 lifter + executor

其餘概念按現有順序驗證即可：
5. cpp_const_declare, cpp_constexpr_declare, cpp_auto_declare
6. cpp_typedef, cpp_using_alias
7. cpp_sizeof, cpp_enum
8. bitwise_not, cpp_ternary, cpp_cast
9. cpp_increment, cpp_increment_expr
10. cpp_compound_assign, cpp_compound_assign_expr

## 跨語言對應

| C++ 概念 | 通用等價 | 備註 |
|----------|---------|------|
| bitwise_not | bitwise_not | 已是通用概念 |
| cpp_ternary | — | Python 有 `x if cond else y`，語法不同 |
| cpp_increment | — | Python/Java 有 `++` 但語義微妙不同 |
| cpp_compound_assign | — | 多語言共通但 C++ 有指標版本 |
| cpp_enum | — | 各語言 enum 語法差異大 |

## 需注意的邊界案例

1. **`const` vs `constexpr`**：lifter 需正確區分，都是 `declaration` 節點但有不同 specifier
2. **`auto` 推導**：`auto x = 5` vs `auto& x = y` — 後者涉及引用
3. **ternary 優先序**：`cout << a ? b : c` 需要括號 — generator 已處理
4. **位元運算 vs 邏輯運算**：`&` vs `&&`，lifter 需正確區分
5. **前綴 vs 後綴遞增**：`++i` vs `i++` 在表達式中語義不同
6. **C++ named cast** 的 tree-sitter 節點類型需確認（可能是 `template_function` 或特殊節點）
7. **enum class**（scoped enum）目前不在範疇內
