# Concept Refactor Audit Report (C++)

Generated: 2026-03-11

## Concept Matrix

### AST NodeTypes with Dual/Triple Registration

| AST NodeType | Hand-Written | JSON Pattern | BlockSpec astPattern | Status |
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

**Total dual registrations: 17** (14 SHADOW + 3 FALLBACK)

### Hand-Written Only (no JSON pattern)

| AST NodeType | File | Concept(s) | Migration |
|---|---|---|---|
| `update_expression` | expressions.ts:109 | cpp_increment | L3-strategy (array element detection) |
| `pointer_expression` | expressions.ts:142 | cpp_address_of, cpp_pointer_deref | L2-dispatch |
| `comma_expression` | expressions.ts:160 | cpp_comma_expr | L2-chain |
| `cast_expression` | expressions.ts:166 | cpp_cast | L1-ready |
| `conditional_expression` | expressions.ts:177 | cpp_ternary | L1-ready |
| `subscript_expression` | expressions.ts:191 | array_access | L1-ready |
| `compound_statement` | statements.ts:10 | _compound | L1-ready |
| `switch_statement` | statements.ts:98 | cpp_switch | unmovable (case collection) |
| `do_statement` | statements.ts:116 | cpp_do_while | L1-ready |
| `assignment_expression` | declarations.ts:20 | var_assign, cpp_compound_assign, array_assign, cpp_pointer_assign | unmovable (multi-type dispatch) |

### JSON Pattern Only (no hand-written)

| ID | AST NodeType | Concept | Pattern Type |
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

## Dual Registration Details (needs cleanup)

### SHADOW (hand-written never triggers, safe to remove)

| NodeType | HW Location | JSON Pattern ID | Recommendation |
|---|---|---|---|
| `number_literal` | expressions.ts:12 | cpp_number_literal | Remove HW |
| `identifier` | expressions.ts:17 | cpp_identifier + constrained variants | Remove HW |
| `true` | expressions.ts:25 | cpp_true | Remove HW |
| `false` | expressions.ts:26 | cpp_false | Remove HW |
| `null` | expressions.ts:27 | cpp_null | Remove HW |
| `nullptr` | expressions.ts:28 | cpp_nullptr | Remove HW |
| `parenthesized_expression` | expressions.ts:133 | cpp_unwrap_parens | Remove HW |
| `condition_clause` | statements.ts:130 | cpp_unwrap_condition_clause | Remove HW |
| `break_statement` | statements.ts:94 | cpp_break | Remove HW |
| `continue_statement` | statements.ts:95 | cpp_continue | Remove HW |
| `if_statement` | statements.ts:18 | cpp_if_statement | Remove HW |
| `while_statement` | statements.ts:39 | cpp_while_statement | Remove HW |
| `translation_unit` | statements.ts:5 | cpp_translation_unit | Remove HW |
| `expression_statement` | declarations.ts:7 | cpp_expression_statement | Remove HW |

### FALLBACK (hand-written serves as safety net)

| NodeType | HW Handles | JSON Handles | Recommendation |
|---|---|---|---|
| `binary_expression` | All operators + cout/cin chains | dispatch(+,-,*,/,%,&&,\|\|,==,!=,<,>,<=,>=) + chains(<<,>>) | Keep HW as fallback for edge cases |
| `unary_expression` | !, -, ~, &, * | !, - only | Expand JSON dispatch OR keep HW |
| `for_statement` | count_loop detection + general for_loop | count_loop only (composite) | Keep HW for general for_loop fallback |

---

## Migratable Concepts

| Concept | Current Location | Migration Target | Difficulty |
|---|---|---|---|
| `cast_expression` → cpp_cast | expressions.ts:166 | JSON simple (2 field mappings) | L1-ready |
| `conditional_expression` → cpp_ternary | expressions.ts:177 | JSON simple (3 field mappings) | L1-ready |
| `subscript_expression` → array_access | expressions.ts:191 | JSON simple (2 field mappings) | L1-ready |
| `compound_statement` → _compound | statements.ts:10 | JSON simple (liftBody) | L1-ready |
| `do_statement` → cpp_do_while | statements.ts:116 | JSON simple (2 field mappings) | L1-ready |
| `comma_expression` → cpp_comma_expr | expressions.ts:160 | JSON chain pattern | L2-chain |
| `pointer_expression` → address_of/deref | expressions.ts:142 | JSON operatorDispatch | L2-dispatch |
| `update_expression` → cpp_increment | expressions.ts:109 | JSON composite + liftStrategy | L3-strategy |
| `switch_statement` → cpp_switch | statements.ts:98 | Keep hand-written (case collection) | unmovable |
| `assignment_expression` → var_assign etc | declarations.ts:20 | Keep hand-written (multi-type dispatch) | unmovable |

---

## Render Strategy Audit

### Strategies in Use (10 registered)

| Strategy | Used By | Dynamic State | Can Auto-Derive? |
|---|---|---|---|
| cpp:renderPrint | u_print | itemCount (extraState) | No (dynamic inputs) |
| cpp:renderInput | u_input | args[] with mode (extraState) | No (dynamic three-mode args) |
| cpp:renderVarDeclare | u_var_declare | items[] (extraState) | No (multi-declarator) |
| cpp:renderFuncDef | u_func_def | paramCount (extraState) | No (dynamic params) |
| cpp:renderFuncCall | u_func_call, u_func_call_expr | argCount (extraState) | No (dynamic args) |
| cpp:renderIf | u_if | elseifCount, hasElse (extraState) | No (dynamic else-if chains) |
| cpp:renderPrintf | (style variant) | args[] with mode (extraState) | No (dynamic three-mode args) |
| cpp:renderScanf | (style variant) | args[] with mode (extraState) | No (dynamic three-mode args) |
| cpp:renderForwardDecl | c_forward_decl | paramCount (extraState) | No (dynamic params) |
| cpp:renderDocComment | c_comment_doc | paramCount, hasReturn (extraState) | No (dynamic params) |

### Missing Strategies (potential issues)

| Block Type | Concept | Issue |
|---|---|---|
| c_switch | cpp_switch | Has dynamic cases — may need strategy for proper rendering |
| c_increment | cpp_increment | Array element variant — BlockSpec may not capture all variants |

### Sc4 Consistency

All 10 strategies appear consistent with their generators. Each strategy's extraState fields match the dynamic input patterns expected by the corresponding generator output.

---

## Statistics

| Metric | Before | After |
|---|---|---|
| Hand-written lifter registrations | 27 | 8 |
| liftStrategy registrations | 5 | 5 |
| JSON pattern entries | 34 | 42 (+8) |
| BlockSpec astPattern entries | 44 | 44 |
| SHADOW (HW shadowed by JSON) | 14 | **0 (all removed)** |
| FALLBACK (HW as safety net) | 3 | 3 (kept) |
| HW-only (no JSON equivalent) | 10 | 5 |
| Render strategies | 10 | 10 (all justified) |
| **Declarative ratio** | **77%** | **89%** |

### Dedup Results (Phase 2)

Removed 14 SHADOW hand-written lifters (dead code, never triggered):
- expressions.ts: number_literal, identifier, true, false, null, nullptr, parenthesized_expression
- statements.ts: translation_unit, if_statement, while_statement, break_statement, continue_statement, condition_clause
- declarations.ts: expression_statement

### Migration Results (Phase 3)

Migrated 5 HW-only concepts to JSON patterns:
- `do_statement` → cpp_do_while (L1 simple, 2 field mappings)
- `cast_expression` → cpp_cast_expr (L1 simple, 2 field mappings)
- `conditional_expression` → cpp_ternary_expr (L1 simple, 3 field mappings)
- `compound_statement` → cpp_compound_stmt (L1 simple, liftChildren)
- `pointer_expression` → cpp_address_of_ptr + cpp_pointer_deref_ptr (L1 constrained, 2 patterns)

Kept as HW (justified):
- `subscript_expression` — tree-sitter wraps index in subscript_argument_list
- `comma_expression` — no root match, doesn't fit chain pattern
- `update_expression` — array element detection logic (L3-strategy candidate)
- `switch_statement` — complex case collection (unmovable)
- `assignment_expression` — multi-type dispatch with array/pointer/compound variants (unmovable)
- `binary_expression` — FALLBACK for edge cases not covered by JSON dispatch/chains
- `unary_expression` — FALLBACK; JSON only handles !, - (not ~, &, *)
- `for_statement` — FALLBACK for general for-loops (JSON only handles count_for)

### Render Audit Results (Phase 4)

All 10 render strategies are justified — each uses dynamic extraState that cannot be auto-derived.

### Verification

- TypeScript compilation: PASS
- Test suite: 98 files, 1695 tests — ALL PASSED (same as baseline)
