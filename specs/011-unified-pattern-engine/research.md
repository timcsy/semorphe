# Research: 統一 Pattern Engine 三層表達能力架構

## 決策 1：三個獨立 Registry vs 單一統一 Registry

**Decision**: 三個獨立 Registry（TransformRegistry、LiftStrategyRegistry、RenderStrategyRegistry）

**Rationale**:
- 三者的函數簽名完全不同：`string→string`、`(AstNode, LiftContext)→SemanticNode|null`、`(SemanticNode)→BlockState|null`
- 獨立 Registry 提供型別安全，不需要 union type 或 type guard
- 各自可獨立測試
- 符合憲法 I. 簡約優先：三個簡單的 Map wrapper 比一個複雜的泛型 Registry 更易理解

**Alternatives**:
- 單一 `PluginRegistry<T>`：增加泛型複雜度，gain 很小（都是 Map wrapper）
- 不用 Registry 類別，直接用全域 Map：失去封裝和命名空間驗證能力

## 決策 2：Strategy 和 Transform 的存放位置（JSON 中）

**Decision**:
- `liftStrategy` 放在 `lift-patterns.json` 的 pattern entry 中（取代 fieldMappings）
- `renderStrategy` 放在 BlockSpec 的新 `renderMapping.strategy` 欄位中
- `transform` 放在 `fieldMappings` 的個別 mapping entry 中

**Rationale**:
- `lift-patterns.json` 已經是 Lifter 的 JSON 配置中心，strategy 自然屬於此處
- BlockSpec 已經是 Renderer 的映射來源，renderStrategy 自然屬於此處
- transform 是 fieldMapping 的欄位級增強，不是概念級的

**Alternatives**:
- 所有 strategy/transform 集中在一個新的 JSON 檔：過度抽象，分散注意力

## 決策 3：$namedChildren[N] 的 AST 欄位解析擴展

**Decision**: 在 `resolveAstField` 中新增 `$namedChildren[N]` 語法，支援位置索引存取

**Rationale**:
- tree-sitter 某些節點（如 `return_statement`）沒有命名欄位，只能靠位置存取
- 語法 `$namedChildren[0]` 直觀，與現有 `$text`、`$operator` 風格一致
- 也支援 `$namedChildren[N]` 在 lift 模式下（回傳 AstNode 供 lift 使用）

**Alternatives**:
- 用 composite pattern 的 path 語法：太重量級，一個簡單的位置存取不需要 composite
- 加入 `$children[N]`（所有子節點含 unnamed）：風險較高，unnamed 子節點順序不穩定

## 決策 4：Lifter.ts 的角色

**Decision**: 保留 Lifter 類別作為管線入口點，但移除 hand-written lifter Map 和 preferHandWritten set

**Rationale**:
- Lifter 仍負責 Level 3（unresolved）和 Level 4（raw_code）的降級邏輯
- PatternLifter 負責 Level 1（pattern + transform + strategy）
- 保留 Lifter 作為編排層，PatternLifter 作為實際引擎，職責清晰

**Alternatives**:
- 完全合併 Lifter 和 PatternLifter：Level 3/4 降級邏輯會污染 PatternLifter 的職責
- 移除 Lifter，在外部處理降級：調用者需要知道太多細節

## 決策 5：block-renderer.ts 的角色

**Decision**: 保留 `renderBlock` 函數作為入口點，但移除整個 switch-case 和 CONCEPT_TO_BLOCK map。所有渲染邏輯由 PatternRenderer 處理（含 renderStrategy）。`renderBlock` 只負責調用 PatternRenderer 和處理 raw_code/unresolved 降級。

**Rationale**:
- 與 Lifter 決策一致：入口函數負責編排和降級，PatternRenderer 負責實際渲染
- renderExpression 的 raw_code→raw_expression 轉換仍需保留

**Alternatives**:
- 完全移除 block-renderer.ts：renderExpression 和 renderStatementChain 的輔助邏輯仍有價值
- 將降級邏輯也放入 PatternRenderer：會污染 PatternRenderer 的純渲染職責

## 決策 6：遷移策略——每個 hand-written 節點的目標層級

| 節點/概念 | 現狀 | 目標層級 | 遷移方式 |
|-----------|------|---------|---------|
| `string_literal` | preferHandWritten（去引號） | Layer 2 | JSON + `transform: "stripQuotes"` |
| `char_literal` | preferHandWritten（去引號） | Layer 2 | JSON + `transform: "stripQuotes"` |
| `comment` | preferHandWritten（去前綴） | Layer 2 | JSON + `transform: "cpp:stripComment"` |
| `return_statement` | preferHandWritten（$namedChildren） | Layer 1 | JSON + `ast: "$namedChildren[0]"` |
| `preproc_include` | preferHandWritten（條件路由） | Layer 3 | `liftStrategy: "cpp:liftPreprocInclude"` |
| `function_definition` | preferHandWritten（深層提取） | Layer 3 | `liftStrategy: "cpp:liftFunctionDef"` |
| `declaration` | preferHandWritten（多變數） | Layer 3 | `liftStrategy: "cpp:liftDeclaration"` |
| `input` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderInput"` |
| `var_declare` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderVarDeclare"` |
| `print` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderPrint"` |
| `func_def` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderFuncDef"` |
| `func_call` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderFuncCall"` |
| `func_call_expr` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderFuncCall"` |
| `if` (render) | SWITCH_CASE_CONCEPTS | Layer 3 | `renderStrategy: "cpp:renderIf"` |
