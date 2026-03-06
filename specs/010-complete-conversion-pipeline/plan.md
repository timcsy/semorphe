# 實作計畫：補齊轉換管線（完全重寫版）

**分支**: `010-complete-conversion-pipeline` | **日期**: 2026-03-06 | **規格**: [spec.md](./spec.md)

## 摘要

嚴格從第一性原理推導，將四方向轉換管線從「TypeScript 手寫為主、JSON 為輔」重構為「JSON 定義為唯一真相來源、TypeScript 引擎只做通用演算法」。目標：新增任何積木只加 JSON，零 TypeScript 修改（P3 完全達成）。

## 從第一性原理推導架構

### 根公理推導

> 程式是一棵語義樹。程式碼和積木都是它的參數化投影。

```
四方向轉換管線（P1 投影定理）：
  積木 → 語義樹 → 程式碼   （Extractor → Generator）
  程式碼 → AST → 語義樹 → 積木  （Parser → Lifter → Renderer）
```

每個方向都應由 JSON 定義驅動。TypeScript 只寫通用引擎，不寫特定積木邏輯。

### P3 推導

> 系統可以在不修改既有程式碼的前提下，加入新概念。

**判定法**: 如果加一個外部套件的積木需要改 TypeScript，代表架構有耦合。

**現狀違反**:
- Lifter: 每個 AST nodeType 一個手寫 `lifter.register()` → 新積木必須改 TypeScript
- Renderer: `CONCEPT_TO_BLOCK` 硬編碼 + `renderBlock()` switch-case → 新概念必須改 TypeScript
- Generator: 每個概念一個手寫 `g.set()` → 新概念必須改 TypeScript
- Extractor: 每個積木一個手寫 `extractBlock()` case → 新積木必須改 TypeScript

**目標**: 四個方向全部由 JSON 定義驅動。

## 技術背景

**語言/版本**: TypeScript 5.x
**主要依賴**: Blockly 12.4.1, web-tree-sitter 0.26.6, Vite
**測試**: Vitest
**目標平台**: 瀏覽器（SPA）

## 憲法檢查

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ | 四個通用引擎取代 ~100 個手寫 handler。JSON 定義反而比 TypeScript 更簡單 |
| II. TDD | ✅ | 每個積木至少一個來回轉換測試 |
| III. Git 紀律 | ✅ | 按引擎分階段 commit |
| IV. 規格文件保護 | ✅ | 不修改既有規格 |
| V. 繁體中文優先 | ✅ | 所有文件繁體中文 |

## 新架構設計

### JSON 積木定義的五個維度

每個積木的 JSON 定義包含五個維度（擴充現有四維為五維）：

```jsonc
{
  "id": "c_increment",
  "language": "cpp",
  "category": "operators",
  "level": 1,

  // 1. 語義層：這個概念是什麼
  "concept": {
    "conceptId": "cpp_increment",        // 語義概念 ID
    "abstractConcept": "increment",       // 映射到的抽象概念
    "properties": ["name", "operator"],   // 語義屬性列表
    "children": {},                       // 語義子節點列表
    "role": "statement_or_expression"     // statement | expression | both
  },

  // 2. 積木層：使用者看到什麼（已有，不變）
  "blockDef": { "type": "c_increment", "message0": "...", "args0": [...] },

  // 3. 程式碼產生層：產生什麼 code（已有，不變）
  "codeTemplate": { "pattern": "${NAME}${OP}", "imports": [], "order": 8 },

  // 4. AST 辨識層：怎麼從 code 認回來（擴充）
  "astPattern": {
    "nodeType": "update_expression",
    "constraints": [],
    "fieldMappings": [                    // 【新增】AST→語義欄位映射
      { "semantic": "name", "ast": "argument", "extract": "text" },
      { "semantic": "operator", "ast": "$operator", "extract": "text" }
    ]
  },

  // 5. 渲染映射層：語義→積木欄位對應（【新增】）
  "renderMapping": {
    "fields": { "NAME": "name", "OP": "operator" },
    "inputs": {},
    "statementInputs": {}
  }
}
```

### 四個通用引擎

#### 引擎 1：通用 Lifter（Code → Semantic）

**檔案**: `src/core/lift/pattern-lifter.ts`

從 JSON 定義中讀取 `astPattern`，建立 `nodeType → Pattern[]` 索引。當 AST 節點到達：

1. 查找 nodeType 對應的 Pattern 列表
2. 按優先級排序（constraints 越多越優先）
3. 檢查 constraints → 第一個匹配的勝出
4. 根據 `fieldMappings` 從 AST 提取 properties 和 children
5. 產生 SemanticNode

**astPattern 擴充：六種 Pattern 類型**

為了涵蓋所有現有手寫 lifter 的能力，astPattern 支援六種模式：

**類型 1: simple** — 直接 nodeType 匹配（大多數積木）
```jsonc
{ "nodeType": "char_literal", "constraints": [] }
```

**類型 2: constrained** — nodeType + 欄位值約束（printf、scanf 等）
```jsonc
{ "nodeType": "call_expression", "constraints": [{ "field": "function", "text": "printf" }] }
```

**類型 3: operatorDispatch** — 按運算子分派到不同概念
```jsonc
{
  "nodeType": "binary_expression",
  "patternType": "operatorDispatch",
  "operatorField": "$operator",     // 如何取得運算子
  "routes": {
    "+,-,*,/,%": "arithmetic",
    ">,<,>=,<=,==,!=": "compare",
    "&&,||": "logic"
  }
}
```

**類型 4: chain** — 左遞迴鏈偵測（cout/cin）
```jsonc
{
  "nodeType": "binary_expression",
  "patternType": "chain",
  "chain": {
    "operator": "<<",
    "direction": "left",
    "rootMatch": { "text": "cout" },
    "collectField": "right",
    "endlMatch": { "text": "endl", "concept": "endl" }
  },
  "concept": { "conceptId": "print" },
  "extract": { "values": "$chainCollected" }
}
```

**類型 5: composite** — 多子節點聯合匹配（計數 for 迴圈）
```jsonc
{
  "nodeType": "for_statement",
  "patternType": "composite",
  "composite": {
    "checks": [
      { "field": "initializer", "typeIs": "declaration" },
      { "field": "condition", "typeIs": "binary_expression", "operatorIn": ["<", "<="] },
      { "field": "update", "typeIs": "update_expression" }
    ]
  },
  "concept": { "conceptId": "count_loop" },
  "extract": {
    "var_name": { "source": "path", "path": "initializer.init_declarator.declarator", "extract": "text" },
    "from": { "source": "lift", "path": "initializer.init_declarator.value" },
    "to": { "source": "lift", "path": "condition.right" },
    "body": { "source": "liftBody", "path": "body" }
  }
}
```

**類型 6: unwrap** — 透明解包（括號、compound_statement）
```jsonc
{
  "nodeType": "parenthesized_expression",
  "patternType": "unwrap",
  "unwrapChild": 0   // 解包第 N 個 named child
}
```

**優先級規則**:
1. composite > chain > operatorDispatch > constrained > simple
2. 同類型中，constraints 越多越優先
3. 語言模組的 lift patterns 優先於積木 JSON 的 astPattern（允許覆蓋）

#### 引擎 2：通用 Generator（Semantic → Code）

**檔案**: `src/core/projection/template-generator.ts`

從 JSON 定義中讀取 `codeTemplate`，建立 `conceptId → CodeTemplate` 索引。

**模板語法**（擴充現有 `${FIELD}` 語法）：

| 語法 | 說明 | 範例 |
|------|------|------|
| `${FIELD}` | 替換為 properties[FIELD] | `${NAME}` → `"i"` |
| `${CHILD}` | 替換為 generateExpression(children[CHILD][0]) | `${VALUE}` → `"5"` |
| `${BODY}` | 替換為 generateBody(children[BODY]) + 縮排 | `${BODY}` → `"  x++;\n"` |
| `${CHILDREN:sep}` | 替換為 children[CHILDREN].join(sep) | `${VALUES: << }` → `"x << y"` |

**statement vs expression**: `codeTemplate.order === 0` → statement（自動加 indent + `;` + `\n`），否則為 expression。

**Universal 概念的 code template**: 放在語言模組的 JSON 中（`cpp/templates/universal-templates.json`），因為 universal 概念的程式碼是語言相關的：

```jsonc
// cpp/templates/universal-templates.json
[
  {
    "conceptId": "print",
    "styleVariants": {
      "cout": { "pattern": "cout << ${VALUES: << }", "order": 0 },
      "printf": { "pattern": "printf(\"%d\", ${VALUES:, })", "order": 0 }
    }
  },
  {
    "conceptId": "input",
    "styleVariants": {
      "cout": { "pattern": "cin >> ${VARIABLES: >> }", "order": 0 },
      "printf": { "pattern": "scanf(\"%d\", ${VARIABLES:&,})", "order": 0 }
    }
  },
  {
    "conceptId": "var_declare",
    "pattern": "${TYPE} ${DECLARATORS:, };",
    "order": 0
  },
  {
    "conceptId": "if",
    "pattern": "if (${CONDITION}) {\n${THEN_BODY}\n}${?ELSE_BODY: else {\n${ELSE_BODY}\n}}",
    "order": 0
  },
  {
    "conceptId": "while_loop",
    "pattern": "while (${CONDITION}) {\n${BODY}\n}",
    "order": 0
  },
  {
    "conceptId": "count_loop",
    "pattern": "for (int ${VAR_NAME} = ${FROM}; ${VAR_NAME} < ${TO}; ${VAR_NAME}++) {\n${BODY}\n}",
    "order": 0
  },
  {
    "conceptId": "func_def",
    "pattern": "${RETURN_TYPE} ${NAME}(${PARAMS:, }) {\n${BODY}\n}",
    "order": 0
  }
]
```

**回退**: 若概念沒有 codeTemplate，查找 `abstractConcept` 對應的 universal template。若都沒有，降級為 `/* unknown concept */`。

#### 引擎 3：通用 Renderer（Semantic → Blocks）

**檔案**: `src/core/projection/pattern-renderer.ts`

從 JSON 定義中讀取 `concept.conceptId` + `blockDef` + `renderMapping`，建立 `conceptId → RenderSpec` 索引。

**渲染流程**:
1. 以 `node.concept` 查找 RenderSpec
2. 建立 BlockState，`type` = blockDef.type
3. 遍歷 `renderMapping.fields`：`block.fields[FIELD] = node.properties[prop]`
4. 遍歷 `renderMapping.inputs`：`block.inputs[INPUT] = renderExpression(node.children[child][0])`
5. 遍歷 `renderMapping.statementInputs`：`block.inputs[INPUT] = renderStatementChain(node.children[child])`

**自動推導 renderMapping**: 若 JSON 中未定義 `renderMapping`，從 `blockDef.args0` 和 `concept.properties` 自動推導：
- `field_input`/`field_dropdown` → fields 映射
- `input_value` → inputs 映射（expression child）
- `input_statement` → statementInputs 映射（statement chain child）
- 名稱對應：blockDef field 名稱 (大寫) ↔ semantic property 名稱 (小寫/snake_case)

**Universal 概念的 renderMapping**: 放在 `universal.json` 中，因為 universal 積木的 blockDef 是通用的。

#### 引擎 4：通用 Extractor（Blocks → Semantic）

**檔案**: `src/core/projection/pattern-extractor.ts`

從 JSON 定義中讀取 `blockDef` + `concept` + `renderMapping`（反向使用），建立 `blockType → ExtractSpec` 索引。

**提取流程**（renderMapping 的反向）:
1. 以 `block.type` 查找 ExtractSpec
2. 建立 SemanticNode，`concept` = concept.conceptId
3. 遍歷 `renderMapping.fields`（反向）：`node.properties[prop] = block.fields[FIELD]`
4. 遍歷 `renderMapping.inputs`（反向）：`node.children[child] = [extractExpression(block.inputs[INPUT])]`
5. 遍歷 `renderMapping.statementInputs`（反向）：`node.children[child] = extractStatementChain(block.inputs[INPUT])`

### Lift Patterns：統一的 AST→語義模式定義

為了涵蓋 universal 概念的 C++ 特定 lift 模式（if_statement → if、for_statement → count_loop 等），新增一個獨立的 JSON 檔案：

**檔案**: `src/languages/cpp/lift-patterns.json`

此檔案定義所有「從 C++ AST 到語義概念」的模式，包括：
- universal 概念的 C++ 特定 AST 模式（if, while, for 等）
- 複雜模式（chain、composite、operatorDispatch）
- 結構性操作（unwrap、expression_statement 上下文轉換）

C++ 積木 JSON 中的 `astPattern` 只處理簡單的 1:1 映射。複雜模式統一放在 `lift-patterns.json`。

### 引擎載入與優先級

```
啟動時載入順序：
1. 讀取 universal.json → 建立 renderMapping 索引
2. 讀取 cpp/blocks/*.json → 建立 codeTemplate + astPattern + renderMapping 索引
3. 讀取 cpp/lift-patterns.json → 建立完整的 lift pattern 索引
4. 讀取 cpp/templates/universal-templates.json → 建立 universal 概念的 code template 索引

Lift 優先級（同一 nodeType 有多個 pattern 時）：
  lift-patterns.json 中的 composite/chain >
  lift-patterns.json 中的 operatorDispatch/constrained >
  blocks/*.json 中的 astPattern（simple/constrained）>
  lift-patterns.json 中的 simple
```

### 遷移策略

| 現有模組 | 處理方式 |
|---------|---------|
| `cpp/lifters/*.ts` (4 檔案) | 遷移為 `cpp/lift-patterns.json`，完成後刪除 |
| `cpp/generators/*.ts` (4 檔案) | 遷移為 `cpp/templates/universal-templates.json` + 既有 codeTemplate，完成後刪除 |
| `block-renderer.ts` CONCEPT_TO_BLOCK | 自動從 JSON concept.conceptId → blockDef.type 建構，刪除硬編碼 |
| `block-renderer.ts` renderBlock() switch | 改為通用 renderMapping 引擎，刪除 switch |
| `blockly-panel.ts` extractBlock() switch | 改為通用 extractor 引擎，刪除 switch |
| `lifter.ts` Lifter class | 保留 Level 3/4 回退機制，Level 1 改為查詢 pattern 引擎 |

### 保留的手寫邏輯

以下邏輯保留在 TypeScript 引擎中（非特定積木邏輯，而是通用演算法）：

| 引擎邏輯 | 原因 |
|---------|------|
| chain 模式的走訪演算法 | 通用的左遞迴走訪，任何 chain pattern 都用同一份程式碼 |
| composite 模式的多子節點檢查 | 通用的組合驗證邏輯 |
| `_compound` 展平 | 通用的語義樹後處理 |
| Level 3 unresolved + Level 4 raw_code | P1 降級保證 |
| source range metadata 附加 | 通用的 metadata 處理 |
| LiftContext 作用域追蹤 | 通用的語義分析基礎設施 |

**關鍵區分**: 這些都是「引擎層」邏輯，不是「積木層」邏輯。引擎只做一次，所有積木共用。新積木只加 JSON。

## 專案結構

### 文件（本功能）

```text
specs/010-complete-conversion-pipeline/
├── spec.md
├── plan.md              # 本檔案
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### 原始碼

```text
src/
├── core/
│   ├── types.ts                      # 擴充 AstPattern 型別
│   ├── block-spec-registry.ts        # 擴充：自動建構 concept → block 索引
│   ├── lift/
│   │   ├── lifter.ts                 # 重構：Level 1 改為查詢 pattern 引擎
│   │   ├── pattern-lifter.ts         # 【新增】通用 pattern lift 引擎
│   │   ├── lift-context.ts           # 保留
│   │   └── types.ts                  # 擴充 FieldMapping 等型別
│   └── projection/
│       ├── code-generator.ts         # 保留通用架構
│       ├── template-generator.ts     # 【新增】codeTemplate 驅動產生器
│       ├── pattern-renderer.ts       # 【新增】通用 renderMapping 渲染器
│       ├── pattern-extractor.ts      # 【新增】通用 renderMapping 提取器
│       └── block-renderer.ts         # 重構：改為呼叫 pattern-renderer
├── languages/
│   └── cpp/
│       ├── lift-patterns.json        # 【新增】完整 AST→語義模式定義
│       ├── templates/
│       │   └── universal-templates.json  # 【新增】universal 概念的 C++ code template
│       ├── blocks/
│       │   ├── basic.json            # 補齊 concept + fieldMappings
│       │   ├── advanced.json         # 補齊 concept + fieldMappings
│       │   └── special.json          # 補齊 concept + fieldMappings
│       ├── lifters/                  # 遷移完成後刪除整個目錄
│       ├── generators/               # 遷移完成後刪除整個目錄
│       └── module.ts                 # 重構：改為載入 JSON 並註冊引擎
└── blocks/
    └── universal.json                # 補齊 concept + renderMapping

tests/
├── unit/
│   ├── core/
│   │   ├── pattern-lifter.test.ts    # 【新增】
│   │   ├── template-generator.test.ts # 【新增】
│   │   ├── pattern-renderer.test.ts  # 【新增】
│   │   └── pattern-extractor.test.ts # 【新增】
│   └── languages/cpp/
│       └── ...
└── integration/
    ├── roundtrip.test.ts             # 【新增】全積木來回轉換
    └── p3-json-only.test.ts          # 【新增】P3 驗證：純 JSON 積木
```

## 複雜度追蹤

無憲法違反需要說明。
