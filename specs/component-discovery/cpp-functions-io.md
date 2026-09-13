# 概念探索：C++ — 函式與 I/O

## 摘要
- 語言：C++
- 目標：function definition, function call, return, cout, cin, endl, #include, using namespace, comment
- 發現概念總數：12
- 通用概念：6（func_def, func_call, func_call_expr, return, print, input, endl）
- 語言特定概念：5（cpp_include, cpp_using_namespace, comment, block_comment, doc_comment, cpp_define）
- 建議歸屬的 Topic 層級樹節點：L0（7 個）、L1a（3 個）、L2a（3 個）

## 概念目錄

### L0: 基礎

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| print | `cout << expr << expr2;` | 輸出一個或多個值到標準輸出 | values(value_input, 可鏈式) | universal | 通用 | raw_code | 已存在。C++ 語法為 `cout <<` 鏈式串接，語義上是「輸出多個值」。對應 printf 風格時為 `printf(fmt, args...)` |
| input | `cin >> x;` | 從標準輸入讀取一個值到變數 | name(field) | universal | 通用 | raw_code | 已存在。C++ 語法為 `cin >>` 鏈式串接，語義上是「讀取到指定變數」。對應 scanf 風格時為 `scanf(fmt, &x)` |
| endl | `endl` | 換行並清除輸出緩衝區 | （無） | universal | 通用 | raw_expression | 已存在。在 print 鏈式串接中使用，語義上等同 `'\n'` + flush。作為 expression 嵌入 print 的 values 中 |
| cpp_include | `#include <iostream>` | 引入系統標頭檔 | header(field) | lang-core | 特定 | raw_code | 已存在。前置處理器指令，屬於結構性依賴宣告（見 first-principles §1.3）。L0 隱藏→L1 ghost→L2+ 手動 |
| cpp_using_namespace | `using namespace std;` | 宣告使用命名空間，避免前綴 | ns(field) | lang-core | 特定 | raw_code | 已存在。通常搭配 `#include` 使用，L0 時可自動產生 |
| cpp_define | `#define PI 3.14159` | 定義前置處理器巨集 | name(field), value(field) | lang-core | 特定 | raw_code | 已存在。前置處理器文字替換，非型別安全。進階用途有函式巨集、條件編譯守衛等 |

### L1a: 函式與迴圈

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| func_def | `int add(int a, int b) { ... }` | 定義一個函式，含回傳型別、名稱、參數列表、函式體 | name(field), params(field), return_type(field), body(statement_input) | universal | 通用 | raw_code | 已存在。introduces_scope = true，cognitive_level = 2。params 目前存為字串（技術債，見 MEMORY.md） |
| func_call | `doSomething(a, b);` | 函式呼叫作為述句（忽略回傳值） | name(field), args(field) | universal | 通用 | raw_code | 已存在。role = expression（可同時用於 statement context）。args 存為字串 |
| func_call_expr | `add(a, b)` | 函式呼叫作為運算式（使用回傳值） | name(field), args(field) | universal | 通用 | raw_expression | 已存在。與 func_call 語義相同，差異在 role：expression context 中使用回傳值 |
| return | `return expr;` | 從函式回傳值（或無值回傳 `return;`） | value(value_input, 可選) | universal | 通用 | raw_code | 已存在。value 子節點可為空（void 函式的 return;）。必須在 func_def 的 body 內使用 |

### L2a: 陣列與字串

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| comment | `// 這是註解` | 單行註解 | text(field) | lang-core | 特定 | （不生成程式碼即消失） | 已存在。C++ 使用 `//` 語法。不影響語義，僅影響程式碼可讀性。role = statement |
| block_comment | `/* 多行\n   註解 */` | 多行區塊註解 | text(field) | lang-core | 特定 | comment | 已存在。C/C++ 使用 `/* ... */` 語法。可跨越多行 |
| doc_comment | `/** @brief 簡介 */` | 文件註解（Doxygen 風格） | brief(field) | lang-core | 特定 | block_comment → comment | 已存在。Doxygen 慣例使用 `/** ... */`，支援 @brief, @param, @return 等標籤 |

## 依賴關係圖

```
cpp_include ──────────▶ print, input（cout/cin 需要 #include <iostream>）
cpp_using_namespace ──▶ print, input（省略 std:: 前綴需要 using namespace std;）
cpp_define ───────────▶ （獨立，但常用於 #include 守衛和常數定義）

number_literal ──┐
string_literal ──┤
var_ref ─────────┼──▶ print.values（作為輸出值）
endl ────────────┘

input ◄── var_declare（必須先宣告變數才能 cin >> x）

func_def ──▶ return（return 必須在函式體內）
           ──▶ func_call, func_call_expr（定義後才能呼叫）

func_call ◄── 需要 expression 作為 args
func_call_expr ◄── 同上，但用於 expression context

comment, block_comment, doc_comment ──▶ （獨立，無語義依賴）
```

## 建議實作順序

以下順序基於依賴關係和教學漸進性：

1. **cpp_include**（基礎設施，所有 I/O 的前提）
2. **cpp_using_namespace**（簡化語法的前提）
3. **print / cout**（最基本的輸出）
4. **endl**（搭配 print 使用）
5. **input / cin**（基本的輸入）
6. **func_def**（函式定義）
7. **return**（函式回傳）
8. **func_call**（函式呼叫 — 述句）
9. **func_call_expr**（函式呼叫 — 運算式）
10. **cpp_define**（前置處理器巨集）
11. **comment**（單行註解）
12. **block_comment**（多行註解）
13. **doc_comment**（文件註解）

**備註**：以上概念全部已存在於 `universal-concepts.json` 和 `cpp/core/concepts.json` 中，無需新增概念定義。

## 跨語言對應

| 通用概念 | C++ | Python | Java | JavaScript |
|---|---|---|---|---|
| print | `cout << v1 << v2;` / `printf(fmt, ...)` | `print(v1, v2)` | `System.out.println(v)` | `console.log(v)` |
| input | `cin >> x;` / `scanf(fmt, &x)` | `x = input()` | `Scanner.nextInt()` | `prompt()` / `readline()` |
| endl | `endl` / `"\n"` | （print 自帶換行） | （println 自帶換行） | `"\n"` |
| func_def | `int f(int a) { }` | `def f(a):` | `int f(int a) { }` | `function f(a) { }` |
| func_call | `f(a);` | `f(a)` | `f(a);` | `f(a);` |
| return | `return expr;` | `return expr` | `return expr;` | `return expr;` |
| comment | `// text` | `# text` | `// text` | `// text` |
| block_comment | `/* text */` | `"""text"""` / 無原生 | `/* text */` | `/* text */` |
| doc_comment | `/** @brief text */` | `"""docstring"""` | `/** @param text */` | `/** @param text */` |

**語義阻抗分析**：
- **阻抗-1（結構等價）**：func_def, func_call, return, comment — 所有語言結構幾乎相同
- **阻抗-2（語義近似）**：print, input — 各語言 I/O 機制差異大（串流 vs 函式 vs 方法），但語義意圖相同
- **阻抗-3（無法映射）**：cpp_include, cpp_using_namespace, cpp_define — C/C++ 前置處理器特有，其他語言用 import/模組系統替代

## 需注意的邊界案例

1. **print 的雙風格問題**：C++ 同時存在 `cout <<`（iostream 風格）和 `printf()`（cstdio 風格）。系統已透過 StylePreset.io_style 處理，但新增 I/O 功能時必須同時測試兩種模式（含 endl 組合）。見 MEMORY.md 的「跨風格測試」注意事項。

2. **print 鏈式串接的 AST 結構**：`cout << a << b << endl;` 在 tree-sitter AST 中是嵌套的 `binary_expression`（left-associative），lift 時需要 chain pattern 展開為平坦的 values 列表。

3. **input 的變數必須已宣告**：`cin >> x` 要求 x 已經透過 var_declare 宣告。語義上 input 是「寫入既有變數」而非「宣告新變數」。

4. **return 的可選值**：void 函式中 `return;` 無值，非 void 函式中 `return expr;` 有值。積木需支援 value 子節點為空的情況。

5. **cpp_include 的漸進揭露**：根據 first-principles §2.4，L0 階段 `#include` 和 `using namespace` 應自動產生（隱藏），L1 階段顯示為 ghost block（可見但不可編輯），L2+ 階段由使用者手動管理。這是 Program Scaffold 機制的範疇。

6. **func_def 的 params 字串解析**：params 目前存為字串（技術債），renderer 的 parseParamTypeAndName 用已知複合型別清單做前綴匹配。見 MEMORY.md。

7. **func_call 與 func_call_expr 的 Statement/Expression 雙版本**：同概念的 statement/expression 版本的 extraState 契約必須完全相同，因為 STATEMENT_TO_EXPRESSION 映射直接搬移 extraState。見 MEMORY.md §21。

8. **comment 不參與語義**：註解在語義樹中存在但不影響程式行為。Lifter 需辨識 `//`、`/* */`、`/** */` 三種語法並分別對應到 comment、block_comment、doc_comment 概念。

9. **cpp_define 的硬邊界**：巨集展開是文字替換，非型別安全。系統目前僅支援簡單的物件式巨集（`#define NAME value`），不支援函式式巨集（`#define MAX(a,b) ...`）。後者屬於 first-principles 所述的「巨集硬邊界」。

10. **endl vs '\n'**：`endl` 除了換行還會 flush 緩衝區，效能上不如 `'\n'`。競賽程式主題可能偏好 `'\n'`，初學者主題偏好 `endl`（語義更清楚）。
