---
name: concept-generate
description: >
  為概念探索報告中定義的概念產生 BlockSpec JSON、程式碼產生器、提升器和渲染映射。
  產生在 Semorphe 語義樹管線中支援新概念所需的所有產出物。
  在 /concept.discover 之後使用，用於建立實作產出物。支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

# 概念產生

## 使用者輸入

```text
$ARGUMENTS
```

參數應為概念探索報告的路徑（來自 `/concept.discover`），或 `{lang} {concept_name}` 格式（例如 `cpp do_while`、`python list_comprehension`）。

## 背景

你正在為新的 Semorphe 概念產生完整的實作產出物。每個概念需要 6 個產出物才能端到端運作：

1. **BlockSpec JSON** — 定義概念如何渲染為 Blockly 積木
2. **程式碼產生器** — 將 SemanticNode → 目標語言原始碼
3. **提升器（Lifter）** — 將語言 AST → SemanticNode（透過 tree-sitter）
4. **渲染映射** — 將 SemanticNode 屬性 → 積木欄位/輸入
5. **Interpreter Executor** — 將 SemanticNode → 執行行為（在 `src/interpreter/executors/` 中註冊）。可執行概念需實作計算邏輯，宣告性概念（如 `#include`）需註冊 noop executor。見 `docs/technical-experiences.md` §20
6. **測試** — 基本的 round-trip 測試（含執行測試）

## 前置作業

產生前，請先閱讀這些檔案以理解現有模式：

- `src/core/types.ts` — SemanticNode 結構、現有概念
- `docs/first-principles.md` — P2（概念代數）的屬性結構規則

然後閱讀目標語言的既有實作：
- 核心概念：`src/languages/{lang}/core/blocks.json` — 現有 BlockSpec 範例
- STD 模組：`src/languages/{lang}/std/{module}/blocks.json` — 標準庫 BlockSpec
- `src/languages/{lang}/core/generators/` — 現有 generator 模式
- `src/languages/{lang}/core/lifters/` — 現有 lifter 模式
- `src/core/projection/pattern-renderer.ts` — 渲染映射如何運作

如果是全新語言（`src/languages/{lang}/` 不存在），先參考現有語言模組（如 `src/languages/cpp/`）的目錄結構來建立骨架。

## 工作流程

### 步驟一：解析概念定義

從探索報告或使用者輸入中，為每個概念提取（命名慣例見 `/concept.discover` 階段四）：
- 概念名稱
- 概念類型：通用（universal）還是語言特定（`{lang}:concept`）
- 建議歸屬的 Topic 層級樹節點
- 目標語言的語法模式
- 屬性（積木上的欄位）
- 子節點（子表達式/語句的輸入槽）
- 工具箱分類

### 步驟二：產生 BlockSpec JSON

概念所屬層級決定檔案存放位置：核心概念放 `src/languages/{lang}/core/blocks.json`，STD 模組概念放 `src/languages/{lang}/std/{module}/blocks.json`。

```json
{
  "type": "{prefix}_{concept_name}",
  "conceptId": "{concept_name}",
  "category": "{category}",
  "message0": "{帶 %1 %2 佔位符的積木標籤}",
  "args0": [
    { "type": "field_input", "name": "FIELD_NAME", "text": "default" },
    { "type": "input_value", "name": "INPUT_NAME" }
  ],
  "output": null,
  "previousStatement": null,
  "nextStatement": null,
  "colour": "{category_colour}",
  "renderMapping": {
    "fields": { "FIELD_NAME": "property_name" },
    "inputs": { "INPUT_NAME": "child_slot" }
  }
}
```

規則：
- `type` 是**投影層**的積木類型名稱，前綴：`u_` 為通用積木，語言特定用語言縮寫（如 `c_` for C++、`py_` for Python、`j_` for Java）
- `conceptId` 是**語義層**的概念識別碼，格式為 `snake_case`（通用）或 `{lang}:snake_case`（語言特定）
- **注意兩者的區別**：`conceptId: "cpp:vector_push"` 對應 `type: "c_vector_push"`；`conceptId: "sort_range"` 對應 `type: "u_sort_range"`。conceptId 用於語義樹，type 用於 Blockly 積木
- **i18n 必須使用 `%{BKY_...}` key**：`message0`、`tooltip`、以及 `field_dropdown` 的 options 顯示文字，一律使用 `%{BKY_KEY_NAME}` 格式引用，不可硬編碼任何語言的文字。同時在 `src/i18n/zh-TW/blocks.json` 和 `src/i18n/en/blocks.json` 中新增對應的翻譯條目。參考現有 STD 模組（如 vector、cstring）的 i18n 模式。
- `message0` 在目標語系中應盡可能易讀
- 最小化 args 數量 — 認知負載原則
- 語句積木：設定 `previousStatement`/`nextStatement`
- 表達式積木：設定 `output`（型別或 null 代表任意）
- 如果概念同時有語句和表達式形式，用 `expressionCounterpart` 產生兩者。對應 P2 概念角色語境依賴（§2.2）——statement/expression 版本的 extraState 格式必須完全相同
- 如果此概念在不同 Topic 下需不同積木形狀，在 Topic JSON 加 `blockOverrides`（§2.4）

### 步驟三：產生程式碼產生器

在 `src/languages/{lang}/core/generators/` 的適當檔案中加入 generator 函式。

```typescript
generators.set('{concept_name}', (node, ctx) => {
  // 提取屬性
  const prop = node.properties.prop_name
  // 產生子節點
  const child = generateExpression(node.children.child_slot?.[0], ctx)
  // 回傳格式化的目標語言程式碼
  return `${indent(ctx)}${formatted_code}\n`
})
```

規則：
- 語句層級輸出使用 `indent(ctx)`
- 子表達式使用 `generateExpression()`
- 子語句列表使用 `generateBody()`
- 妥善處理缺失的子節點（空字串或預設值）
- 遵循 `ctx.style` 的格式偏好
- 注意語言特有的語法（如 Python 的縮排、Java 的分號）

### 步驟四：產生提升器

在 `src/languages/{lang}/core/lifters/` 的適當檔案中加入 lifter 註冊。

```typescript
lifter.register('{tree_sitter_node_type}', (node, context) => {
  // 從 AST 節點提取
  const prop = node.childForFieldName('field')?.text ?? ''
  // 建構語義節點
  return createNode('{concept_name}', { prop }, {
    child_slot: context.liftChildren(node, 'body_field'),
  })
})
```

**Layer 引導**：Layer 1 純 JSON（astPattern）、Layer 2 JSON + transform（TransformRegistry）、Layer 3 JSON + strategy（LiftStrategyRegistry）。見 §2.3。

**Confidence 引導**：composite pattern 必須先過語義驗證才能設 `high`（§2.1）；推測性對應設 `inferred`；無法結構化則降級為 `raw_code`。

規則：
- 第一個參數是 **tree-sitter 節點類型**（不是概念名稱）— 每個語言的 tree-sitter grammar 不同
- 子節點使用 `context.liftChildren()`
- 具名欄位使用 `node.childForFieldName()`
- 可選欄位使用 `?? defaultValue` 處理
- 多個 tree-sitter 類型可映射到同一個概念
- 通用概念在不同語言中會有不同的 tree-sitter 映射

### 步驟五：產生 Interpreter Executor

在 `src/interpreter/executors/` 的適當檔案中加入 executor 註冊。

**可執行概念**（如數學運算、I/O、控制流程）：
```typescript
register('{concept_name}', async (node, ctx) => {
  // 評估子節點
  const arg = await ctx.evaluate((node.children.arg ?? [])[0])
  // 執行計算
  const result = someComputation(ctx.toNumber(arg))
  // 回傳結果
  return { type: 'double', value: result }
})
```

**宣告性概念**（如 `#include`、`using namespace`、註解）：
```typescript
register('{concept_name}', async () => {})  // noop
```

規則：
- 參考 `src/interpreter/executors/` 中的現有 executor 模式
- 子節點評估使用 `ctx.evaluate()`，值轉換使用 `ctx.toNumber()`/`ctx.toBool()`
- 執行結果回傳 `RuntimeValue`（`{ type, value }`）
- 語句型概念不需回傳值（`return` 或 `void`）
- 在 `src/interpreter/interpreter.ts` 的建構函式中 import 並呼叫 `registerXxxExecutors(reg)`
- **絕不靜默跳過概念**——未註冊的概念會觸發 `unknownConceptHandler`（見 `docs/technical-experiences.md` §20）

### 步驟六：產生測試

依照 `tests/` 中的模式建立測試檔案：

```typescript
// tests/unit/languages/{lang}/{concept_name}.test.ts
describe('{concept_name}', () => {
  it('should lift {描述}', () => {
    const code = `{最小範例}`
    // ... 提升並驗證語義樹
  })

  it('should generate {描述}', () => {
    const node = createNode('{concept_name}', { ... }, { ... })
    // ... 產生並驗證目標語言輸出
  })

  it('should round-trip {描述}', () => {
    const code = `{程式碼}`
    // ... lift → generate → 比較
  })
})
```

### 步驟七：通用概念跨語言產生

**僅適用於通用概念**（conceptId 為 `snake_case`，無語言前綴）：

通用概念必須在所有已支援的語言模組中都有對應實作。檢查 `src/languages/` 下有哪些語言模組，對每個已存在的語言模組：

1. 產生該語言的 generator 函式（語法不同，語義相同）
2. 產生該語言的 lifter 註冊（tree-sitter 節點類型因語言而異）
3. 在該語言的 block spec JSON 中加入對應的積木定義
4. 產生該語言的測試

例如，新增通用概念 `sort_range` 時，若已有 `cpp` 和 `python` 模組，則需同時在兩個語言中產生 generator/lifter/block/test。

### 步驟八：更新註冊

確認新概念需要在哪些地方註冊：
- `src/languages/{lang}/toolbox-categories.ts` 中的工具箱分類
- 適當的 Topic JSON 檔案（`src/languages/{lang}/topics/*.json`）中的 `levelTree` 節點，將概念 ID 加入對應節點的 `concepts[]`
- concept registry 中的概念定義
- 如果是通用概念，更新 `src/core/types.ts` 的 `UniversalConcept` 型別
- STD 模組概念需更新 DependencyResolver 映射（§2.3）

**STD 模組結構**：STD 模組使用扁平結構——每個模組目錄下直接放 `generators.ts`、`lifters.ts`、`blocks.json`、`concepts.json`，不再有子目錄。

### 步驟九：輸出摘要

報告產生了什麼：

```
## {concept_name} 的產出物（{language}）

- [ ] BlockSpec：核心 `src/languages/{lang}/core/blocks.json` 或 STD `src/languages/{lang}/std/{module}/blocks.json`
- [ ] Generator：核心 `src/languages/{lang}/core/generators/{file}.ts` 或 STD `src/languages/{lang}/std/{module}/generators.ts`
- [ ] Lifter：核心 `src/languages/{lang}/core/lifters/{file}.ts` 或 STD `src/languages/{lang}/std/{module}/lifters.ts`
- [ ] 渲染映射：嵌入在 BlockSpec 中
- [ ] Executor：`src/interpreter/executors/{file}.ts`（可執行概念需實作邏輯，宣告性概念需 noop）
- [ ] 測試：`tests/unit/languages/{lang}/{concept_name}.test.ts`（含執行測試）
- [ ] 註冊：{加在哪裡}

### 驗證
執行 `npm test` 確認所有測試通過。
執行 `npx tsc --noEmit` 確認無型別錯誤。
```

## 準則

- **一次一個概念** — 先為一個概念產生所有產出物，再處理下一個
- **遵循現有模式** — 匹配該語言模組中鄰近檔案的程式碼風格
- **最小變更** — 產生新概念時不要重構現有程式碼
- **測試優先** — 盡可能在實作之前先寫測試
- **積木 UX** — 在腦中預覽積木：學生第一眼能看懂嗎？
- **通用概念共用** — 如果產生的是通用概念，確保它在已支援的所有語言中都能運作
