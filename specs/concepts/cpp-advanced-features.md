# C++ 進階語言特性 — 概念盤點與工件完整性報告

> 產生日期：2026-03-12
> 掃描範圍：`src/languages/cpp/`、`src/blocks/`、`src/interpreter/`

---

## 概覽

本報告涵蓋 11 個 C++ 進階語言概念，針對每個概念檢查 6 項工件（artifact）是否存在：

| # | 工件 | 檔案位置 |
|---|------|---------|
| 1 | **concept.json** | `src/languages/cpp/core/concepts.json` |
| 2 | **blocks.json** | `src/languages/cpp/core/blocks.json` |
| 3 | **generator** | `src/languages/cpp/core/generators/*.ts` |
| 4 | **lifter（lift-pattern 或 strategy）** | `src/languages/cpp/lift-patterns.json` + `src/languages/cpp/core/lifters/strategies.ts` |
| 5 | **executor** | `src/interpreter/executors/*.ts` |
| 6 | **lift-pattern（JSON 宣告式）** | `src/languages/cpp/lift-patterns.json` |

---

## 逐概念 6 工件狀態

### 1. lambda（`cpp_lambda`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_lambda`, role=expression, capture/return_type props, params+body children |
| blocks.json | OK | `cpp_lambda` 積木定義於 `core/blocks.json:3021` |
| generator | OK | `expressions.ts:174` — `g.set('cpp_lambda', ...)` |
| lifter/strategy | OK | `strategies.ts` 有 `cpp:liftLambda` 策略函式 |
| executor | **缺少** | 無 `register('cpp_lambda', ...)` |
| lift-pattern | OK | `lift-patterns.json:465` — `cpp_lambda_expr`, astNodeType=`lambda_expression` |

### 2. namespace（`cpp_namespace_def`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_namespace_def`, role=statement, name prop, body children |
| blocks.json | OK | `core/blocks.json:3056` |
| generator | OK | `statements.ts:330` — `g.set('cpp_namespace_def', ...)` |
| lifter/strategy | OK | `strategies.ts` 有 `cpp:liftNamespace` 策略函式 |
| executor | **缺少** | 無 `register('cpp_namespace_def', ...)` |
| lift-pattern | OK | `lift-patterns.json:472` — `cpp_namespace_definition`, astNodeType=`namespace_definition` |

### 3. try-catch（`cpp_try_catch`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_try_catch`, role=statement, catch_type/catch_name props |
| blocks.json | OK | `core/blocks.json:2677` |
| generator | OK | `statements.ts:313` — `g.set('cpp_try_catch', ...)` |
| lifter/strategy | OK | `strategies.ts` 有 `cpp:liftTryCatch` 策略函式 |
| executor | OK | `control-flow.ts:177` — `register('cpp_try_catch', ...)` |
| lift-pattern | OK | `lift-patterns.json:442` — `cpp_try_statement`, astNodeType=`try_statement` |

### 4. throw（`cpp_throw`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_throw`, role=statement, value child |
| blocks.json | OK | `core/blocks.json:2718` |
| generator | OK | `statements.ts:341` — `g.set('cpp_throw', ...)` |
| lifter/strategy | OK | 使用 fieldMappings 直接對應，無需 strategy |
| executor | OK | `control-flow.ts:197` — `register('cpp_throw', ...)` |
| lift-pattern | OK | `lift-patterns.json:449` — `cpp_throw_statement`, astNodeType=`throw_statement` |

### 5. static_cast（`cpp_static_cast`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_static_cast`, role=expression, target_type prop, value child |
| blocks.json | OK | `core/blocks.json:3084` |
| generator | OK | `expressions.ts:191` — `g.set('cpp_static_cast', ...)` |
| lifter/strategy | **缺少** | 無 strategy 函式，也無 lift-pattern |
| executor | **缺少** | 無 `register('cpp_static_cast', ...)` |
| lift-pattern | **缺少** | 無 `static_cast_expression` 等 AST 節點的 lift-pattern |

### 6. dynamic_cast（`cpp_dynamic_cast`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_dynamic_cast`, role=expression, target_type prop, value child |
| blocks.json | OK | `core/blocks.json:3116` |
| generator | OK | `expressions.ts:197` — `g.set('cpp_dynamic_cast', ...)` |
| lifter/strategy | **缺少** | 同 static_cast，無 lift-pattern |
| executor | **缺少** | 無 register |
| lift-pattern | **缺少** | 缺少對應 AST 節點 pattern |

### 7. reinterpret_cast（`cpp_reinterpret_cast`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_reinterpret_cast`, role=expression, target_type prop, value child |
| blocks.json | OK | `core/blocks.json:3148` |
| generator | OK | `expressions.ts:203` — `g.set('cpp_reinterpret_cast', ...)` |
| lifter/strategy | **缺少** | 同上 |
| executor | **缺少** | 無 register |
| lift-pattern | **缺少** | 缺少對應 AST 節點 pattern |

### 8. const_cast（`cpp_const_cast`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_const_cast`, role=expression, target_type prop, value child |
| blocks.json | OK | `core/blocks.json:3180` |
| generator | OK | `expressions.ts:209` — `g.set('cpp_const_cast', ...)` |
| lifter/strategy | **缺少** | 同上 |
| executor | **缺少** | 無 register |
| lift-pattern | **缺少** | 缺少對應 AST 節點 pattern |

### 9. range-for（`cpp_range_for`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_range_for`, role=statement, var_type/var_name/container props, body children |
| blocks.json | OK | `core/blocks.json:2479` |
| generator | OK | `declarations.ts:112` — `g.set('cpp_range_for', ...)` |
| lifter/strategy | OK | `strategies.ts` 有 `cpp:liftRangeFor` 策略函式 |
| executor | OK | `control-flow.ts:150` — `register('cpp_range_for', ...)` |
| lift-pattern | OK | `lift-patterns.json:400` — `cpp_for_range_loop`, astNodeType=`for_range_loop` |

### 10. template function（`cpp_template_function`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `cpp_template_function`, role=statement, t/return_type/func_name/param_type/param_name props |
| blocks.json | OK | `core/blocks.json:1795` |
| generator | **缺少** | 無 `g.set('cpp_template_function', ...)` |
| lifter/strategy | **缺少** | 無 strategy，也無 lift-pattern |
| executor | **缺少** | 無 register |
| lift-pattern | **缺少** | 無 `template_declaration` 等 AST 節點 pattern |

### 11. forward declaration（`forward_decl`）

| 工件 | 狀態 | 備註 |
|------|------|------|
| concept.json | OK | `forward_decl`, role=statement, return_type/name/params props |
| blocks.json | OK | `core/blocks.json:716` |
| generator | OK | `declarations.ts:70` — `g.set('forward_decl', ...)` |
| lifter/strategy | OK | 由 `cpp:liftDeclaration` 策略內部處理（偵測 function_declarator 子節點後產出 `forward_decl`） |
| executor | OK | `functions.ts:108` — `register('forward_decl', ...)` (no-op) |
| lift-pattern | **間接** | 無獨立 pattern；透過 `cpp_declaration` pattern（astNodeType=`declaration`）進入 `cpp:liftDeclaration` 後內部分派 |

---

## 彙總矩陣

| 概念 | concept | blocks | generator | lifter | executor | lift-pattern | 完整度 |
|------|---------|--------|-----------|--------|----------|-------------|--------|
| lambda | OK | OK | OK | OK | **缺少** | OK | 5/6 |
| namespace | OK | OK | OK | OK | **缺少** | OK | 5/6 |
| try-catch | OK | OK | OK | OK | OK | OK | **6/6** |
| throw | OK | OK | OK | OK | OK | OK | **6/6** |
| static_cast | OK | OK | OK | **缺少** | **缺少** | **缺少** | 3/6 |
| dynamic_cast | OK | OK | OK | **缺少** | **缺少** | **缺少** | 3/6 |
| reinterpret_cast | OK | OK | OK | **缺少** | **缺少** | **缺少** | 3/6 |
| const_cast | OK | OK | OK | **缺少** | **缺少** | **缺少** | 3/6 |
| range-for | OK | OK | OK | OK | OK | OK | **6/6** |
| template function | OK | OK | **缺少** | **缺少** | **缺少** | **缺少** | 2/6 |
| forward declaration | OK | OK | OK | OK | OK | 間接 | 5.5/6 |

---

## 已知缺口分析

### 高優先：template function（完整度 2/6）

- 最不完整的概念。concept 和 blocks 定義存在，但 **generator、lifter、executor、lift-pattern 全部缺失**。
- 目前僅在 topics JSON 中被參考（`cpp-beginner.json`、`cpp-competitive.json`），但積木無法產生程式碼也無法從程式碼反向提升。
- tree-sitter C++ 對應的 AST 節點類型為 `template_declaration`。

### 中優先：四種具名轉型（完整度各 3/6）

- `static_cast`、`dynamic_cast`、`reinterpret_cast`、`const_cast` 四個概念結構相同，都缺少 **lifter、executor、lift-pattern**。
- Generator 已實作（可從積木生成程式碼），但 code→blocks 反向路徑不通。
- tree-sitter C++ 中這四種轉型的 AST 節點分別為：
  - `static_cast_expression`
  - `dynamic_cast_expression`
  - `reinterpret_cast_expression`
  - `const_cast_expression`
- 四者結構完全對稱，可用同一 pattern 模板批量產生 lift-pattern。

### 低優先：lambda 與 namespace（完整度各 5/6）

- 僅缺 **executor**。雙向轉換（code↔blocks）已完整支援。
- 對教學場景而言，executor 不是必須（直譯器未必需要支援所有概念）。
- 但若需執行包含 lambda/namespace 的程式，會導致執行時期錯誤。

### forward declaration（完整度 5.5/6）

- 幾乎完整。唯一的非理想之處是沒有獨立的 lift-pattern，而是依附於 `cpp_declaration` 的 `liftDeclaration` 策略內部分派。
- 這是合理的設計（forward declaration 在 tree-sitter 中就是 `declaration` 節點），但不容易從 lift-pattern.json 中直接查閱。

---

## 完全通過的概念

以下概念 6 項工件全部齊備：

- **try-catch**（`cpp_try_catch`）
- **throw**（`cpp_throw`）
- **range-for**（`cpp_range_for`）
