# Data Model: 概念式積木系統重新設計

**Feature**: 002-concept-blocks-redesign
**Date**: 2026-03-03

## Entity: BlockSpec（積木定義）

**Description**: 描述一個積木的完整規格。分為共用積木（universal）和語言特殊積木（language-specific）。

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | 唯一識別碼，如 `u_var_declare`（共用）或 `cpp_pointer_deref`（C++ 特殊） |
| language | string | Yes | `"universal"` 或語言 ID（如 `"cpp"`、`"python"`） |
| category | string | Yes | 概念類別：`data`、`control`、`functions`、`io`、`operators`、`arrays` |
| version | string | Yes | 格式版本 |
| blockDef | object | Yes | Blockly JSON 定義（message、args、connections、colour、tooltip） |

**共用積木額外說明**:
- 不含 `codeTemplate` 和 `astPattern`
- `blockDef.message0` 使用自然語言（繁體中文），如 `"建立 %1 變數 %2 = %3"`
- 程式碼生成和 AST 匹配由各語言模組提供

**語言特殊積木額外說明**:
- 含 `codeTemplate`（程式碼模板）和 `astPattern`（AST 匹配模式）
- 也使用自然語言標籤，但描述語言特有概念
- `blockDef.message0` 如 `"格式化輸出 ( \"%1\" %2 )"`

**Naming Convention**:
- 共用積木 ID 前綴 `u_`（universal）
- C/C++ 特殊積木 ID 前綴 `cpp_` 或 `c_`

## Entity: CodeTemplate（程式碼模板）

**Description**: 語言特殊積木的程式碼生成規則。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pattern | string | Yes | 模板字串，如 `"printf(\"${FORMAT}\"${ARGS});"` |
| imports | string[] | Yes | 需要的引入，如 `["stdio.h"]` |
| order | number | Yes | 運算子優先序（0=最低，20=原子） |

## Entity: AstPattern（AST 匹配模式）

**Description**: 語言特殊積木的 AST 節點匹配規則。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| nodeType | string | Yes | tree-sitter 節點類型，如 `"for_statement"` |
| constraints | AstConstraint[] | Yes | 消歧約束條件陣列 |

## Entity: AstConstraint（AST 約束）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field | string | Yes | tree-sitter field 名稱 |
| nodeType | string | No | 預期的子節點類型 |
| text | string | No | 預期的文字值 |

## Entity: LanguageModule（語言模組）

**Description**: 一個語言的完整支援單元。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| languageId | string | Yes | 語言 ID，如 `"cpp"` |
| parser | ParserModule | Yes | 程式碼解析器 |
| generator | GeneratorModule | Yes | 程式碼生成器 |
| blockSpecs | BlockSpec[] | Yes | 該語言的特殊積木定義 |
| adapter | LanguageAdapter | Yes | AST 欄位萃取和積木映射邏輯 |

## Entity: LanguageAdapter（語言適配器）

**Description**: 將語言特定的 AST 結構映射到共用積木欄位的適配層。

**Responsibilities**:
- 定義 AST 節點類型到共用積木 ID 的映射
- 提供 AST 節點欄位萃取邏輯（如 for_statement → 取出 initializer、condition、update）
- 辨識計數式 for 迴圈 vs 三段式 for 迴圈
- 提供共用積木 ID 到程式碼生成邏輯的映射

## Entity: SourceMapping（原始碼映射）

**Description**: 積木與原始碼行號的對應關係，用於雙向對照高亮。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| blockId | string | Yes | Blockly 積木 ID |
| startLine | number | Yes | 原始碼起始行（0-based） |
| endLine | number | Yes | 原始碼結束行（0-based） |

## Entity: WorkspaceState（工作區狀態）

**Description**: 持久化的工作區狀態（localStorage）。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| blocklyState | object | Yes | Blockly 序列化 JSON |
| code | string | Yes | 當前程式碼文字 |
| languageId | string | Yes | 當前語言模式 |
| customBlockSpecs | BlockSpec[] | Yes | 使用者上傳的自訂積木 |
| lastModified | string | Yes | ISO 時間戳 |

## Relationships

```
BlockSpec (universal) ──< LanguageAdapter >── LanguageModule
                                                    │
BlockSpec (language)  ────────────────────────── LanguageModule
                                                    │
                                              ┌─────┴─────┐
                                              │            │
                                          ParserModule  GeneratorModule
                                              │            │
                                              └──── Converter ────┘
                                                      │
                                                SourceMapping[]
```

## 共用積木完整清單（21 塊）

| ID | 類別 | 積木標籤（message0） | 欄位 |
|----|------|---------------------|------|
| u_var_declare | data | 建立 %1 變數 %2 = %3 | TYPE(dropdown), NAME(input), INIT(value) |
| u_var_assign | data | 把 %1 設成 %2 | NAME(input), VALUE(value) |
| u_var_ref | data | %1 | NAME(input) |
| u_number | data | %1 | NUM(number) |
| u_string | data | " %1 " | TEXT(input) |
| u_arithmetic | operators | %1 %2 %3 | A(value), OP(dropdown:+-*/%), B(value) |
| u_compare | operators | %1 %2 %3 | A(value), OP(dropdown:><=>=<=!===), B(value) |
| u_logic | operators | %1 %2 %3 | A(value), OP(dropdown:而且/或者), B(value) |
| u_logic_not | operators | 不是 %1 | A(value) |
| u_if | control | 如果 %1 就 %2 | COND(value), BODY(statement) |
| u_if_else | control | 如果 %1 就 %2 否則 %3 | COND(value), THEN(statement), ELSE(statement) |
| u_count_loop | control | 重複：%1 從 %2 到 %3 %4 | VAR(input), FROM(value), TO(value), BODY(statement) |
| u_while_loop | control | 當 %1 持續執行 %2 | COND(value), BODY(statement) |
| u_break | control | 跳出迴圈 | — |
| u_continue | control | 跳至下一次 | — |
| u_func_def | functions | 定義函式 %1 %2 回傳 %3 %4 | NAME(input), PARAMS(input), RETURN_TYPE(dropdown), BODY(statement) |
| u_func_call | functions | 呼叫 %1（%2） | NAME(input), ARGS(input) |
| u_return | functions | 回傳 %1 | VALUE(value) |
| u_print | io | 輸出 %1 | EXPR(value) |
| u_input | io | 讀取輸入 → %1 | NAME(input) |
| u_array_declare | arrays | 建立 %1 陣列 %2 大小 %3 | TYPE(dropdown), NAME(input), SIZE(value) |
| u_array_access | arrays | %1 的第 %2 個 | ARRAY(input), INDEX(value) |
