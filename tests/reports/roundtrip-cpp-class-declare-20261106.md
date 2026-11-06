# Round-Trip 測試報告 — C++ `cpp:class_declare`（類別的前置宣告）— 2026-11-06

測試檔：`tests/integration/roundtrip-cpp-class-declare.test.ts`（14 支，0 todo；2 支以 knownCellaGap 釘住 Cella 那側的誤判）

## 結果

| # | 程式 | 前置宣告數 | 身分／降級 | 產碼一字不差 | 不動點 | Cella（輸出） | 結果 |
|---|------|---|---|---|---|---|---|
| 1 | 互相指到的兩個類別 | 1 | ✅／0 | ✅ | ✅ | accept（`34`） | ✅ PASS |
| 2 | 從未定義，只拿來宣告指標 | 1 | ✅／0 | ✅ | ✅ | accept（`1`）——送 `iClassDecl` | ✅ PASS |
| 3 | 先宣告兩次再定義 | 2 | ✅／0 | ✅ | ✅ | accept（`5`）——兩次都不送 | ✅ PASS |
| 4 | 鏈結串列的節點先宣告 | 1 | ✅／0 | ✅ | ✅ | accept（`3`） | ✅ PASS |
| 5 | 指標當參數、定義在呼叫之後 | 1 | ✅／0 | ✅ | ✅ | accept（`11`） | ✅ PASS |

預期輸出用本機 clang（`-I tests/fixtures/refcc-shim`）逐支對過。

摘要：5/5 PASS。信心分布：前置宣告節點全為 high（結構唯一：沒有本體、獨立成一句）；raw_code 0。

## 不完整型別（Cella 2026-11-06 給的規則，逐條量）

| 寫法 | 標準（clang） | Cella | |
|---|---|---|---|
| 指標宣告、互相指派、和 nullptr 比較 | 合法 | accept | ✅ |
| `p->v`（取成員） | 不合法 | reject | ✅ |
| `Helper h;`（以值宣告變數） | 不合法 | reject | ✅ |
| `void touch(Helper* p) { *p; }`（只產生左值） | **合法**（warning） | **reject** | 🟡 Cella 誤判（說合法的程式有錯）——已回報、knownCellaGap |
| `void take(Helper h) { }`（函式定義的參數以值） | **不合法** | **accept** | 🟡 Cella 誤判（放過）——已回報、knownCellaGap |
| `sizeof(*p)` | 不合法 | —— | 我們這側翻不出（`sizeof` 的對象是運算式時是文字屬性，既有缺口） |

## 已知限制

- `for (struct T; ;)`：文法上合法（clang 收），而 tree-sitter 以容錯解析補了一個 MISSING 的識別字 ⟹ 落到一般的變數宣告；文字照樣產得回去。沒有人這樣寫，不修。
- 樣板的前置宣告 `template <class T> class X;`：照舊降級成原文（由類別定義那一顆的降級分支處理）。
- C 的程式裡從未定義的 `struct S;`：之後有定義時照樣不送；從未定義時照實標 unknown（C 那側的建構子沒對過）。
