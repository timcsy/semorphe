# 研究紀錄：補齊轉換管線（完全重寫版）

## R1: 現有手寫邏輯的模式分析

**目的**: 分析所有現有手寫 lifter/generator/renderer/extractor 的模式，以設計能涵蓋它們的 JSON pattern 語法。

**分析結果**:

### Lifter 模式（4 檔案，~25 個 handler）

| 模式類型 | 現有 handler | JSON pattern 類型 |
|---------|-------------|------------------|
| 1:1 映射 | number_literal, identifier, string_literal, char_literal, true, false, break, continue | `simple` |
| 運算子分派 | binary_expression (→ arithmetic/compare/logic) | `operatorDispatch` |
| 鏈偵測 | binary_expression << (cout), binary_expression >> (cin) | `chain` |
| 組合匹配 | for_statement (counting for) | `composite` |
| 結構提取 | if_statement, while_statement, return_statement, function_definition | `simple` + `fieldMappings` |
| 透明解包 | parenthesized_expression, condition_clause, compound_statement | `unwrap` |
| 上下文轉換 | expression_statement (func_call_expr → func_call) | `contextTransform` |
| 函式名分派 | call_expression (printf/scanf/general) | `constrained`（不同 constraints → 不同 pattern）|
| 多結果展開 | declaration (多 declarator → _compound) | `multiResult` |
| 特殊前處理 | preproc_include, preproc_def, using_declaration, comment | `simple` + custom extract |

**結論**: 需要 8 種 pattern 類型才能涵蓋所有現有邏輯。

### Generator 模式（4 檔案，~20 個 handler）

| 模式類型 | 現有 handler | 對應 JSON 方案 |
|---------|-------------|---------------|
| 簡單屬性替換 | var_ref, number_literal, string_literal | `${FIELD}` |
| 二元運算 | arithmetic, compare, logic | `${LEFT} ${OP} ${RIGHT}` |
| 一元運算 | logic_not, negate | `!${OPERAND}`, `-${VALUE}` |
| 區塊結構 | if, while_loop, count_loop, func_def | 帶 `${BODY}` 的模板 |
| 風格分支 | print (cout vs printf), input (cin vs scanf) | `styleVariants` |
| 陣列展開 | func_call (args.join(', ')) | `${ARGS:, }` 語法 |
| 多變數 | var_declare (declarators) | `${DECLARATORS:, }` |
| 無參數 | break, continue, endl | 固定字串 |

**結論**: 擴充 codeTemplate 語法需增加：分隔符 join (`${F:sep}`)、條件區塊 (`${?F:...}`)、風格分支 (`styleVariants`)。

### Renderer 模式（1 檔案，~30 個 case）

| 模式類型 | 現有 case | 對應 JSON 方案 |
|---------|----------|---------------|
| 簡單欄位 | var_ref, number_literal, string_literal | `renderMapping.fields` |
| 二元運算 | arithmetic, compare, logic | fields + inputs |
| 單子節點 | logic_not, negate, return | inputs |
| 區塊 + 子語句 | if, while_loop, count_loop | inputs + statementInputs |
| 多變數 | var_declare (declarators → NAME_0/INIT_0) | 特殊 renderMapping |
| 可變參數 | func_call (args), func_def (params), print (values) | extraState + 動態 inputs |
| 無欄位 | break, continue, endl | 空 renderMapping |

**結論**: 大多數可用 renderMapping 自動推導。多變數/可變參數的動態 inputs 需要 `dynamicMapping` 機制。

## R2: astPattern 六種模式的 JSON schema 設計

**決策**: 設計六種（加上 contextTransform 和 multiResult 為八種）pattern 類型，以 `patternType` 欄位區分。

### 完整 AstPattern Schema

```typescript
interface AstPattern {
  nodeType: string
  constraints?: AstConstraint[]
  patternType?: 'simple' | 'operatorDispatch' | 'chain' | 'composite' | 'unwrap' | 'contextTransform' | 'multiResult'

  // fieldMappings: AST → 語義欄位對應
  fieldMappings?: FieldMapping[]

  // operatorDispatch 專用
  operatorDispatch?: {
    operatorField: string                // AST 中運算子的取得方式
    routes: Record<string, string>       // "op1,op2": conceptId
    fieldMappings?: FieldMapping[]       // 各 route 共用的欄位映射
  }

  // chain 專用
  chain?: {
    operator: string                     // 鏈運算子
    direction: 'left' | 'right'          // 遞迴方向
    rootMatch: { text: string }          // 鏈根節點匹配
    collectField: string                 // 收集哪個子欄位
    specialNodes?: Record<string, string> // 特殊節點映射（如 endl → endl 概念）
  }

  // composite 專用
  composite?: {
    checks: Array<{
      field: string                      // AST 子欄位名
      typeIs?: string                    // 預期的 nodeType
      operatorIn?: string[]              // 運算子在此集合中
    }>
    extract: Record<string, ExtractRule> // 屬性提取規則
  }

  // unwrap 專用
  unwrapChild?: number | string          // 解包第 N 個 named child 或指定欄位名

  // contextTransform 專用
  contextTransform?: {
    liftChild: number | string           // lift 哪個子節點
    transformRules: Array<{
      fromConcept: string                // 如果 lift 結果是此概念
      toConcept: string                  // 轉換為此概念
    }>
  }

  // multiResult 專用
  multiResult?: {
    iterateOver: string                  // 遍歷哪些子節點
    perItemExtract: Record<string, ExtractRule>
    wrapInCompound: boolean              // 多結果時包裝為 _compound
  }
}

interface FieldMapping {
  semantic: string                       // 語義屬性/子節點名
  ast: string                            // AST 路徑（如 "left", "argument.text"）
  extract: 'text' | 'lift' | 'liftBody' | 'liftChildren'
}

interface ExtractRule {
  source: 'text' | 'lift' | 'liftBody' | 'path' | 'nodeText'
  path?: string                          // AST 路徑
  field?: string                         // AST 欄位名
}
```

**理由**: 這個 schema 能完整表達現有所有手寫 lifter 的邏輯，同時保持 JSON 的宣告式特性。

## R3: codeTemplate 擴充語法

**決策**: 擴充 codeTemplate pattern 語法以涵蓋所有 generator 需求。

### 語法定義

| 語法 | 說明 | 範例 |
|------|------|------|
| `${PROP}` | 屬性替換 | `${NAME}` → `"x"` |
| `${CHILD}` | 子節點表達式 | `${VALUE}` → `"5"` |
| `${BODY}` | 子語句區塊（自動縮排） | `${BODY}` → `"  x++;\n"` |
| `${CHILDREN:sep}` | 子節點陣列 join | `${VALUES: << }` → `"x << y"` |
| `${?CHILD:template}` | 條件區塊（子節點存在才輸出） | `${?ELSE_BODY: else {\n${ELSE_BODY}\n}}` |
| `\n` | 換行 | — |

### styleVariants

對於因 style 不同而有不同 code 的概念：

```jsonc
{
  "conceptId": "print",
  "styleVariants": {
    "cout": { "pattern": "cout << ${VALUES: << }", "order": 0, "imports": ["iostream"] },
    "printf": { "pattern": "printf(\"${FORMAT}\", ${ARGS:, })", "order": 0, "imports": ["cstdio"] }
  },
  "styleKey": "io_style"  // StylePreset 中的哪個欄位決定分支
}
```

**理由**: 現有 `io.ts` 用 `if (style.io_style === 'cout')` 分支。JSON 的 `styleVariants` 表達同一邏輯但更宣告式。

## R4: renderMapping 自動推導演算法

**決策**: 若 JSON 中未定義 `renderMapping`，從 `blockDef.args0` + `concept.properties` + `concept.children` 自動推導。

**演算法**:

```
for each arg in blockDef.args0:
  if arg.type == 'field_input' || arg.type == 'field_dropdown':
    renderMapping.fields[arg.name] = toSnakeCase(arg.name)
  elif arg.type == 'input_value':
    renderMapping.inputs[arg.name] = toSnakeCase(arg.name)
  elif arg.type == 'input_statement':
    renderMapping.statementInputs[arg.name] = toSnakeCase(arg.name)
```

**名稱轉換**: blockDef 用大寫 `NAME`/`VALUE`，semantic 用小寫 `name`/`value`。直接 toLowerCase 即可（或 toSnakeCase 對多詞欄位）。

**理由**: 大多數積木的 blockDef 欄位名和 semantic 屬性名之間有固定的大小寫對應。自動推導避免了為每個積木都寫 renderMapping。

## R5: Universal 概念與 C++ 概念的關係

**決策**: Universal 概念是抽象層（blockDef 定義在 universal.json），C++ 概念是具體層（codeTemplate + astPattern 定義在 language module）。

**架構**:

```
universal.json:
  - 定義 blockDef（積木長什麼樣）
  - 定義 concept（語義概念 ID + renderMapping）
  - 不定義 codeTemplate（語言相關）
  - 不定義 astPattern（語言相關）

cpp/templates/universal-templates.json:
  - 為 universal 概念提供 C++ 的 codeTemplate
  - 包含 styleVariants（cout vs printf）

cpp/lift-patterns.json:
  - 為 universal 概念提供從 C++ AST 到語義的 lift 模式
  - 包含 chain、composite 等複雜模式

cpp/blocks/*.json:
  - 定義 C++ 特定積木（blockDef + concept + codeTemplate + astPattern）
  - 這些積木有自己的 conceptId（如 cpp_increment）
  - 可透過 abstractConcept 映射到 universal 概念
```

**理由**: 這確保了：
- Universal 概念的 UI 是語言無關的（不同語言共用同一個 blockDef）
- Universal 概念的 code 和 AST pattern 是語言特定的（每個語言模組自己定義）
- C++ 特定積木完全自包含（四維定義都在同一個 JSON 物件中）

## R6: 遷移驗證策略

**決策**: 逐引擎遷移，每遷移一個引擎就跑完整測試確認零回歸。

**遷移順序**:

1. **通用 Renderer** (pattern-renderer.ts) — 最安全，只影響 semantic→blocks 方向
2. **通用 Extractor** (pattern-extractor.ts) — 影響 blocks→semantic 方向
3. **通用 Generator** (template-generator.ts) — 影響 semantic→code 方向
4. **通用 Lifter** (pattern-lifter.ts) — 最複雜，影響 code→semantic 方向

**驗證方法**:
- 每遷移一個引擎，所有現有測試必須通過
- 新增每個積木類型的來回轉換測試
- 最後刪除手寫程式碼前，確認覆蓋率不下降
