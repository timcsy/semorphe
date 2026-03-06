# Data Model: 統一 Pattern Engine 三層表達能力架構

## Entity: TransformRegistry

文字轉換函數的全域登錄表（Layer 2）。

| Field | Type | Description |
|-------|------|-------------|
| transforms | Map<string, TransformFn> | 名稱 → 函數映射 |

**TransformFn**: `(text: string) => string`

**Operations**:
- `register(name, fn)`: 註冊一個具名 transform
- `get(name)`: 取得 transform 函數，不存在回傳 null
- `has(name)`: 檢查是否存在

**Naming Convention**: 核心 transform 不加前綴（`stripQuotes`），語言模組加前綴（`cpp:stripComment`）

**Core Transforms（內建）**:
- `stripQuotes`: `"hello"` → `hello`，`'a'` → `a`
- `stripAngleBrackets`: `<iostream>` → `iostream`

## Entity: LiftStrategyRegistry

AST→Semantic 提升函數的全域登錄表（Layer 3 Lifter 側）。

| Field | Type | Description |
|-------|------|-------------|
| strategies | Map<string, LiftStrategyFn> | 名稱 → 函數映射 |

**LiftStrategyFn**: `(node: AstNode, ctx: LiftContext) => SemanticNode | null`

與現有 hand-written lifter 函數簽名完全一致，可直接遷移。

**Operations**: 同 TransformRegistry（register/get/has）

## Entity: RenderStrategyRegistry

Semantic→Block 渲染函數的全域登錄表（Layer 3 Renderer 側）。

| Field | Type | Description |
|-------|------|-------------|
| strategies | Map<string, RenderStrategyFn> | 名稱 → 函數映射 |

**RenderStrategyFn**: `(node: SemanticNode) => BlockState | null`

**Operations**: 同 TransformRegistry（register/get/has）

## Entity: Enhanced FieldMapping

現有 FieldMapping 的擴展，新增 `transform` 欄位。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| semantic | string | yes | 語義屬性/子節點名稱 |
| ast | string | yes | AST 欄位引用（含新增 `$namedChildren[N]`） |
| extract | string | yes | 提取模式：text, lift, liftBody, liftChildren |
| transform | string | no | TransformRegistry 中的函數名稱（僅 extract=text 時有效） |

## Entity: Enhanced LiftPattern

現有 LiftPattern 的擴展，新增 `liftStrategy` 欄位。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| (existing fields) | ... | ... | 保持不變 |
| liftStrategy | string | no | LiftStrategyRegistry 中的函數名稱。存在時跳過所有 pattern matching |

**行為規則**：若 `liftStrategy` 存在，PatternLifter 直接調用 strategy 函數，忽略 fieldMappings/patternType 等欄位。若 strategy 回傳 null，嘗試 fieldMappings fallback。

## Entity: Enhanced RenderMapping

現有 RenderMapping 的擴展，新增 `strategy` 欄位。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fields | Record<string, string> | yes | 靜態欄位映射 |
| inputs | Record<string, string> | yes | 表達式 input 映射 |
| statementInputs | Record<string, string> | yes | 語句 input 映射 |
| strategy | string | no | RenderStrategyRegistry 中的函數名稱。存在時跳過所有 auto-derive 映射 |

## Relationships

```
TransformRegistry ──used by──▶ PatternLifter.extractField()
LiftStrategyRegistry ──used by──▶ PatternLifter.tryMatch()
RenderStrategyRegistry ──used by──▶ PatternRenderer.render()

Language Module (cpp) ──registers──▶ TransformRegistry
                      ──registers──▶ LiftStrategyRegistry
                      ──registers──▶ RenderStrategyRegistry

FieldMapping.transform ──references──▶ TransformRegistry entry
LiftPattern.liftStrategy ──references──▶ LiftStrategyRegistry entry
RenderMapping.strategy ──references──▶ RenderStrategyRegistry entry
```
