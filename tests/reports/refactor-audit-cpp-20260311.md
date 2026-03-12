# 概念重構審計報告（C++）

產生日期：2026-03-11

## 概念矩陣

### 具有雙重/三重註冊的 AST NodeType

| AST NodeType | Hand-Written | JSON Pattern | BlockSpec astPattern | 狀態 |
|---|---|---|---|---|
| `number_literal` | expressions.ts:12 | cpp_number_literal (simple) | - | SHADOW |
| `identifier` | expressions.ts:17 | cpp_identifier (simple) + cpp_endl/cpp_eof/cpp_null_id (constrained, p5) | - | SHADOW |
| `true` | expressions.ts:25 | cpp_true (simple) | - | SHADOW |
| `false` | expressions.ts:26 | cpp_false (simple) | - | SHADOW |
| `null` | expressions.ts:27 | cpp_null (simple) | - | SHADOW |
| `nullptr` | expressions.ts:28 | cpp_nullptr (simple) | - | SHADOW |
| `binary_expression` | expressions.ts:30 | cpp_binary_dispatch (opDispatch, p5) + cpp_cout_chain (chain, p15) + cpp_cin_chain (chain, p15) | - | FALLBACK |
| `unary_expression` | expressions.ts:72 | cpp_unary_not + cpp_unary_negate (opDispatch, p5) | c_bitwise_not | FALLBACK |
| `parenthesized_expression` | expressions.ts:133 | cpp_unwrap_parens (unwrap) | - | SHADOW |
| `condition_clause` | statements.ts:130 | cpp_unwrap_condition_clause (unwrap) | - | SHADOW |
| `break_statement` | statements.ts:94 | cpp_break (simple) | - | SHADOW |
| `continue_statement` | statements.ts:95 | cpp_continue (simple) | - | SHADOW |
| `if_statement` | statements.ts:18 | cpp_if_statement (simple) | - | SHADOW |
| `while_statement` | statements.ts:39 | cpp_while_statement (simple) | - | SHADOW |
| `for_statement` | statements.ts:52 | cpp_count_for (composite, p10, liftStrategy) | c_for_loop | FALLBACK |
| `translation_unit` | statements.ts:5 | cpp_translation_unit (simple) | - | SHADOW |
| `expression_statement` | declarations.ts:7 | cpp_expression_statement (unwrap, p1) | - | SHADOW |

**雙重註冊總數：17**（14 個 SHADOW + 3 個 FALLBACK）

### 僅有 Hand-Written（無 JSON pattern）

| AST NodeType | 檔案 | 概念 | 遷移性 |
|---|---|---|---|
| `update_expression` | expressions.ts:109 | cpp_increment | L3-strategy（陣列元素偵測） |
| `pointer_expression` | expressions.ts:142 | cpp_address_of, cpp_pointer_deref | L2-dispatch |
| `comma_expression` | expressions.ts:160 | cpp_comma_expr | L2-chain |
| `cast_expression` | expressions.ts:166 | cpp_cast | L1-ready |
| `conditional_expression` | expressions.ts:177 | cpp_ternary | L1-ready |
| `subscript_expression` | expressions.ts:191 | array_access | L1-ready |
| `compound_statement` | statements.ts:10 | _compound | L1-ready |
| `switch_statement` | statements.ts:98 | cpp_switch | 不可遷移（case 收集邏輯） |
| `do_statement` | statements.ts:116 | cpp_do_while | L1-ready |
| `assignment_expression` | declarations.ts:20 | var_assign, cpp_compound_assign, array_assign, cpp_pointer_assign | 不可遷移（多型別分派） |

### 僅有 JSON Pattern（無 hand-written）

| ID | AST NodeType | 概念 | Pattern 類型 |
|---|---|---|---|
| cpp_string_literal | string_literal | string_literal | simple |
| cpp_char_literal | char_literal | string_literal | simple |
| cpp_return_statement | return_statement | return | simple |
| cpp_function_definition | function_definition | func_def | simple + liftStrategy |
| cpp_doc_comment | comment | doc_comment | constrained + liftStrategy |
| cpp_block_comment | comment | block_comment | constrained |
| cpp_comment | comment | comment | simple |
| cpp_preproc_include | preproc_include | cpp_include | simple + liftStrategy |
| cpp_declaration | declaration | var_declare | simple + liftStrategy |
| cpp_preproc_def | preproc_def | cpp_define | simple |
| cpp_parameter_pack_expansion | parameter_pack_expansion | unwrap | unwrap |

---

## 雙重註冊詳情（需清理）

### SHADOW（hand-written 永遠不觸發，可安全移除）

| NodeType | HW 位置 | JSON Pattern ID | 建議 |
|---|---|---|---|
| `number_literal` | expressions.ts:12 | cpp_number_literal | 移除 HW |
| `identifier` | expressions.ts:17 | cpp_identifier + constrained 變體 | 移除 HW |
| `true` | expressions.ts:25 | cpp_true | 移除 HW |
| `false` | expressions.ts:26 | cpp_false | 移除 HW |
| `null` | expressions.ts:27 | cpp_null | 移除 HW |
| `nullptr` | expressions.ts:28 | cpp_nullptr | 移除 HW |
| `parenthesized_expression` | expressions.ts:133 | cpp_unwrap_parens | 移除 HW |
| `condition_clause` | statements.ts:130 | cpp_unwrap_condition_clause | 移除 HW |
| `break_statement` | statements.ts:94 | cpp_break | 移除 HW |
| `continue_statement` | statements.ts:95 | cpp_continue | 移除 HW |
| `if_statement` | statements.ts:18 | cpp_if_statement | 移除 HW |
| `while_statement` | statements.ts:39 | cpp_while_statement | 移除 HW |
| `translation_unit` | statements.ts:5 | cpp_translation_unit | 移除 HW |
| `expression_statement` | declarations.ts:7 | cpp_expression_statement | 移除 HW |

### FALLBACK（hand-written 作為安全網）

| NodeType | HW 處理 | JSON 處理 | 建議 |
|---|---|---|---|
| `binary_expression` | 所有運算子 + cout/cin 鏈 | dispatch(+,-,*,/,%,&&,\|\|,==,!=,<,>,<=,>=) + chains(<<,>>) | 保留 HW 作為邊界案例的 fallback |
| `unary_expression` | !, -, ~, &, * | 僅 !, - | 擴展 JSON dispatch 或保留 HW |
| `for_statement` | count_loop 偵測 + 通用 for_loop | 僅 count_loop（composite） | 保留 HW 作為通用 for_loop 的 fallback |

---

## 可遷移概念

| 概念 | 目前位置 | 遷移目標 | 難度 |
|---|---|---|---|
| `cast_expression` → cpp_cast | expressions.ts:166 | JSON simple（2 個欄位映射） | L1-ready |
| `conditional_expression` → cpp_ternary | expressions.ts:177 | JSON simple（3 個欄位映射） | L1-ready |
| `subscript_expression` → array_access | expressions.ts:191 | JSON simple（2 個欄位映射） | L1-ready |
| `compound_statement` → _compound | statements.ts:10 | JSON simple（liftBody） | L1-ready |
| `do_statement` → cpp_do_while | statements.ts:116 | JSON simple（2 個欄位映射） | L1-ready |
| `comma_expression` → cpp_comma_expr | expressions.ts:160 | JSON chain pattern | L2-chain |
| `pointer_expression` → address_of/deref | expressions.ts:142 | JSON operatorDispatch | L2-dispatch |
| `update_expression` → cpp_increment | expressions.ts:109 | JSON composite + liftStrategy | L3-strategy |
| `switch_statement` → cpp_switch | statements.ts:98 | 保留 hand-written（case 收集邏輯） | 不可遷移 |
| `assignment_expression` → var_assign 等 | declarations.ts:20 | 保留 hand-written（多型別分派） | 不可遷移 |

---

## Render Strategy 審計

### 使用中的 Strategy（10 個已註冊）

| Strategy | 使用者 | 動態狀態 | 可 Auto-Derive？ |
|---|---|---|---|
| cpp:renderPrint | u_print | itemCount（extraState） | 否（動態 input） |
| cpp:renderInput | u_input | args[]（含 mode，extraState） | 否（動態三模式 args） |
| cpp:renderVarDeclare | u_var_declare | items[]（extraState） | 否（多宣告子） |
| cpp:renderFuncDef | u_func_def | paramCount（extraState） | 否（動態參數） |
| cpp:renderFuncCall | u_func_call, u_func_call_expr | argCount（extraState） | 否（動態引數） |
| cpp:renderIf | u_if | elseifCount, hasElse（extraState） | 否（動態 else-if 鏈） |
| cpp:renderPrintf | （風格變體） | args[]（含 mode，extraState） | 否（動態三模式 args） |
| cpp:renderScanf | （風格變體） | args[]（含 mode，extraState） | 否（動態三模式 args） |
| cpp:renderForwardDecl | c_forward_decl | paramCount（extraState） | 否（動態參數） |
| cpp:renderDocComment | c_comment_doc | paramCount, hasReturn（extraState） | 否（動態參數） |

### 缺失 Strategy（潛在問題）

| 積木類型 | 概念 | 問題 |
|---|---|---|
| c_switch | cpp_switch | 有動態 case — 可能需要 strategy 來正確渲染 |
| c_increment | cpp_increment | 陣列元素變體 — BlockSpec 可能無法涵蓋所有變體 |

### Sc4 一致性

全部 10 個 render strategy 與其對應的 generator 一致。每個 strategy 的 extraState 欄位皆與對應 generator 輸出預期的動態 input 模式吻合。

---

## 統計

| 指標 | 之前 | 之後 |
|---|---|---|
| Hand-written lifter 註冊數 | 27 | 8 |
| liftStrategy 註冊數 | 5 | 5 |
| JSON pattern 條目 | 34 | 42（+8） |
| BlockSpec astPattern 條目 | 44 | 44 |
| SHADOW（HW 被 JSON 遮蔽） | 14 | **0（全部移除）** |
| FALLBACK（HW 作為安全網） | 3 | 3（保留） |
| 僅 HW（無 JSON 等價） | 10 | 5 |
| Render strategy | 10 | 10（全部合理） |
| **宣告式比例** | **77%** | **89%** |

### 去重結果（階段二）

移除 14 個 SHADOW hand-written lifter（死碼，永遠不觸發）：
- expressions.ts：number_literal, identifier, true, false, null, nullptr, parenthesized_expression
- statements.ts：translation_unit, if_statement, while_statement, break_statement, continue_statement, condition_clause
- declarations.ts：expression_statement

### 遷移結果（階段三）

將 5 個僅有 HW 的概念遷移至 JSON pattern：
- `do_statement` → cpp_do_while（L1 simple，2 個欄位映射）
- `cast_expression` → cpp_cast_expr（L1 simple，2 個欄位映射）
- `conditional_expression` → cpp_ternary_expr（L1 simple，3 個欄位映射）
- `compound_statement` → cpp_compound_stmt（L1 simple，liftChildren）
- `pointer_expression` → cpp_address_of_ptr + cpp_pointer_deref_ptr（L1 constrained，2 個 pattern）

保留為 HW（有正當理由）：
- `subscript_expression` — tree-sitter 將 index 包在 subscript_argument_list 中
- `comma_expression` — 無根節點匹配，不適合 chain pattern
- `update_expression` — 陣列元素偵測邏輯（L3-strategy 候選）
- `switch_statement` — 複雜 case 收集邏輯（不可遷移）
- `assignment_expression` — 多型別分派，含陣列/指標/複合賦值變體（不可遷移）
- `binary_expression` — JSON dispatch/chain 未涵蓋的邊界案例的 FALLBACK
- `unary_expression` — FALLBACK；JSON 僅處理 !, -（未處理 ~, &, *）
- `for_statement` — 通用 for 迴圈的 FALLBACK（JSON 僅處理 count_for）

### Render 審計結果（階段四）

全部 10 個 render strategy 皆有正當理由 — 每個都使用無法 auto-derive 的動態 extraState。

### 驗證

- TypeScript 編譯：通過
- 測試套件：98 個檔案，1695 個測試 — 全部通過（與 baseline 相同）
