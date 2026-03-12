# 概念探索：C++ — const, constexpr, auto, typedef, using alias

## 摘要
- 語言：C++
- 目標：型別修飾詞和型別別名（const, constexpr, auto, typedef, using alias）
- 發現概念總數：5
- 通用概念：0、語言特定概念：5
- 建議歸屬的 Topic 層級樹節點：L1c（型別系統，新節點）

## 概念目錄

### L1c: 型別系統 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_const_declare` | `const int MAX = 100;` | 宣告不可變常數 | TYPE, NAME, VALUE(expr) | lang-core | 特定 | var_declare | qualifier = const |
| `cpp_constexpr_declare` | `constexpr int SIZE = 10;` | 宣告編譯期常數 | TYPE, NAME, VALUE(expr) | lang-core | 特定 | var_declare | qualifier = constexpr |
| `cpp_auto_declare` | `auto x = expr;` | 自動推導型別宣告 | NAME, VALUE(expr) | lang-core | 特定 | var_declare | 必須有初始值 |
| `cpp_typedef` | `typedef int myint;` | 定義型別別名（舊式） | ORIG_TYPE, ALIAS | lang-core | 特定 | raw_code | 純宣告，無初始值 |
| `cpp_using_alias` | `using ll = long long;` | 定義型別別名（新式） | ALIAS, ORIG_TYPE | lang-core | 特定 | raw_code | C++11 語法 |

## 依賴關係圖
無互相依賴，全部獨立於現有概念。

## 建議實作順序
1. cpp_const_declare（最常用）
2. cpp_auto_declare（教育價值高）
3. cpp_constexpr_declare（與 const 類似模式）
4. cpp_typedef（簡單 codeTemplate）
5. cpp_using_alias（簡單 codeTemplate）

## 需注意的邊界案例
- const 在 tree-sitter 中表現為 `type_qualifier` 節點，需在 liftDeclaration 中偵測
- auto 在 tree-sitter 中的 type 節點為 `auto` 關鍵字
- typedef 在 tree-sitter 中為 `type_definition` AST 節點
- using alias 在 tree-sitter 中為 `alias_declaration` AST 節點
- const 變數初始化是必要的（`const int x;` 無意義）
- constexpr 值必須是編譯期可求值的表達式
