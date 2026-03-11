---
name: concept-generate
description: >
  為概念探索報告中定義的概念產生 BlockSpec JSON、程式碼產生器、提升器和渲染映射。
  產生在 Semorphe 語義樹管線中支援新概念所需的所有產出物。
  在 /concept.discover 之後使用，用於建立實作產出物。支援任何語言。
user-invocable: true
---

# 概念產生

## 使用者輸入

```text
$ARGUMENTS
```

參數應為概念探索報告的路徑（來自 `/concept.discover`），或 `{lang} {concept_name}` 格式（例如 `cpp do_while`、`python list_comprehension`）。

## 背景

你正在為新的 Semorphe 概念產生完整的實作產出物。每個概念需要 5 個產出物才能端到端運作：

1. **BlockSpec JSON** — 定義概念如何渲染為 Blockly 積木
2. **程式碼產生器** — 將 SemanticNode → 目標語言原始碼
3. **提升器（Lifter）** — 將語言 AST → SemanticNode（透過 tree-sitter）
4. **渲染映射** — 將 SemanticNode 屬性 → 積木欄位/輸入
5. **測試** — 基本的 round-trip 測試

## 前置作業

產生前，請先閱讀這些檔案以理解現有模式：

- `src/core/types.ts` — SemanticNode 結構、現有概念
- `docs/first-principles.md` — P2（概念代數）的屬性結構規則

然後閱讀目標語言的既有實作：
- `src/languages/{lang}/blocks/*.json` — 現有 BlockSpec 範例
- `src/languages/{lang}/core/generators/` — 現有 generator 模式
- `src/languages/{lang}/core/lifters/` — 現有 lifter 模式
- `src/core/projection/pattern-renderer.ts` — 渲染映射如何運作

如果是全新語言（`src/languages/{lang}/` 不存在），先參考現有語言模組（如 `src/languages/cpp/`）的目錄結構來建立骨架。

## 工作流程

### 步驟一：解析概念定義

從探索報告或使用者輸入中，為每個概念提取：
- 概念名稱（snake_case）
- 概念類型：通用（universal）還是語言特定（`{lang}:concept`）
- 認知層級（0/1/2）
- 目標語言的語法模式
- 屬性（積木上的欄位）
- 子節點（子表達式/語句的輸入槽）
- 工具箱分類

### 步驟二：產生 BlockSpec JSON

建立或附加到適當的 block JSON 檔案（`src/languages/{lang}/blocks/`）。

```json
{
  "type": "{prefix}_{concept_name}",
  "conceptId": "{concept_name}",
  "category": "{category}",
  "level": {0|1|2},
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
- `message0` 在目標語系中應盡可能易讀
- 最小化 args 數量 — 認知負載原則
- 語句積木：設定 `previousStatement`/`nextStatement`
- 表達式積木：設定 `output`（型別或 null 代表任意）
- 如果概念同時有語句和表達式形式，用 `expressionCounterpart` 產生兩者

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

規則：
- 第一個參數是 **tree-sitter 節點類型**（不是概念名稱）— 每個語言的 tree-sitter grammar 不同
- 子節點使用 `context.liftChildren()`
- 具名欄位使用 `node.childForFieldName()`
- 可選欄位使用 `?? defaultValue` 處理
- 多個 tree-sitter 類型可映射到同一個概念
- 通用概念在不同語言中會有不同的 tree-sitter 映射

### 步驟五：產生測試

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

### 步驟六：通用概念跨語言產生

**僅適用於通用概念**（conceptId 為 `snake_case`，無語言前綴）：

通用概念必須在所有已支援的語言模組中都有對應實作。檢查 `src/languages/` 下有哪些語言模組，對每個已存在的語言模組：

1. 產生該語言的 generator 函式（語法不同，語義相同）
2. 產生該語言的 lifter 註冊（tree-sitter 節點類型因語言而異）
3. 在該語言的 block spec JSON 中加入對應的積木定義
4. 產生該語言的測試

例如，新增通用概念 `sort_range` 時，若已有 `cpp` 和 `python` 模組，則需同時在兩個語言中產生 generator/lifter/block/test。

### 步驟七：更新註冊

確認新概念需要在哪些地方註冊：
- `src/languages/{lang}/toolbox-categories.ts` 中的工具箱分類
- block JSON 中的認知層級可用性（`level` 欄位）
- concept registry 中的概念定義
- 如果是通用概念，更新 `src/core/types.ts` 的 `UniversalConcept` 型別

### 步驟八：輸出摘要

報告產生了什麼：

```
## {concept_name} 的產出物（{language}）

- [ ] BlockSpec：`src/languages/{lang}/blocks/{file}.json`
- [ ] Generator：`src/languages/{lang}/core/generators/{file}.ts`
- [ ] Lifter：`src/languages/{lang}/core/lifters/{file}.ts`
- [ ] 渲染映射：嵌入在 BlockSpec 中
- [ ] 測試：`tests/unit/languages/{lang}/{concept_name}.test.ts`
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
