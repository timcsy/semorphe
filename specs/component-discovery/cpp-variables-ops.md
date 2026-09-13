# 概念探索：C++ — 變數與運算

## 摘要
- 語言：C++
- 目標：variables, assignment, arithmetic, comparison, logical operators
- 發現概念總數：12
- 通用概念：10、語言特定概念：2
- 建議歸屬的 Topic 層級樹節點：L0（10 個）、L1a（2 個）

## 概念目錄

### L0: 基礎

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| var_declare | `int x = 5;` | 宣告一個具名變數並可選地初始化 | type(field), name(field), init(value_input) | universal | 通用 | raw_code | 已存在 |
| var_assign | `x = 10;` | 對已存在的變數賦值 | name(field), value(value_input) | universal | 通用 | raw_code | 已存在 |
| var_ref | `x` | 參照一個變數的值 | name(field) | universal | 通用 | raw_expression | 已存在 |
| number_literal | `42`, `3.14` | 數值字面量 | value(field) | universal | 通用 | raw_expression | 已存在 |
| string_literal | `"hello"` | 字串字面量 | value(field) | universal | 通用 | raw_expression | 已存在 |
| arithmetic | `a + b` | 二元算術運算 (+, -, *, /, %) | operator(field), left(value_input), right(value_input) | universal | 通用 | raw_expression | 已存在 |
| compare | `a < b` | 比較運算 (<, >, <=, >=, ==, !=) | operator(field), left(value_input), right(value_input) | universal | 通用 | raw_expression | 已存在 |
| logic | `a && b` | 邏輯二元運算 (&&, \|\|) | operator(field), left(value_input), right(value_input) | universal | 通用 | raw_expression | 已存在 |
| logic_not | `!x` | 邏輯否定 | operand(value_input) | universal | 通用 | raw_expression | 已存在 |
| negate | `-x` | 一元取負 | value(value_input) | universal | 通用 | raw_expression | 已存在 |

### L1a: 函式與迴圈（部分歸屬此層）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_char_literal | `'A'` | 字元字面量 | char(field) | lang-core | 特定 | string_literal | 已存在 |
| builtin_constant | `true`, `false`, `nullptr`, `NULL`, `EOF` | 內建常數 | value(field) | lang-core | 特定 | raw_expression | 已存在 |

## 依賴關係圖

```
number_literal ──┐
string_literal ──┤
cpp_char_literal ┤
builtin_constant ┤
var_ref ─────────┼──▶ arithmetic, compare, logic (作為運算元)
                 │
var_declare ◄────┼── 需要 number_literal/string_literal 作為初始值
var_assign ◄─────┘── 需要 expression 作為 value

logic_not ◄── 需要 expression 作為 operand
negate ◄── 需要 expression 作為 value
```

## 建議實作順序

1. number_literal（最基礎的值）
2. string_literal
3. cpp_char_literal
4. builtin_constant
5. var_ref
6. var_declare
7. var_assign
8. arithmetic
9. compare
10. logic
11. logic_not
12. negate

## 跨語言對應

所有通用概念已定義在 `universal-concepts.json` 中，Python、Java 等語言未來可直接複用。

## 需注意的邊界案例

1. **var_declare 初始化可選**：`int x;`（無初始值）vs `int x = 5;`（有初始值）
2. **arithmetic 的 % 運算**：整數限定，浮點數行為不同
3. **compare 的 == vs =**：初學者常混淆
4. **logic 的短路求值**：`&&` 和 `||` 有短路語義
5. **char_literal vs string_literal**：`'A'` vs `"A"` 在 C++ 中型別不同
6. **builtin_constant**：`true/false` 是 bool，`nullptr` 是指標，`NULL` 是巨集，`EOF` 是 int (-1)
