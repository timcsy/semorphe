# Data Model: Concept 與 BlockDef 分離

## Entities

### ConceptDef（語意層）

概念的純語意定義，獨立於任何視圖或 UI 框架。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| conceptId | string | ✅ | 唯一識別碼（如 `var_declare`、`cpp_printf`） |
| layer | `"universal" \| "lang-core" \| "lang-library"` | ✅ | 概念層級 |
| level | `0 \| 1 \| 2` | ✅ | 認知層級 |
| abstractConcept | string \| null | ❌ | 父概念 ID（如 `cpp_printf` → `print`） |
| properties | string[] | ✅ | 語意屬性名稱清單 |
| children | Record<string, string> | ✅ | 子概念名稱 → 角色（如 `{ "init": "expression" }`） |
| role | `"statement" \| "expression" \| "both"` | ✅ | 語法角色 |
| annotations | Record<string, unknown> | ❌ | 額外 metadata（如 control_flow 標記） |

**驗證規則**:
- `conceptId` 不可重複
- `layer` 必須是三個允許值之一
- `level` 必須是 0、1、2 之一

### BlockProjection（投影層）

Blockly 積木的 UI 定義，透過 conceptId 關聯到 ConceptDef。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | ✅ | 積木規格 ID（通常與 blockDef.type 相同） |
| conceptId | string | ✅ | 關聯的 ConceptDef ID |
| category | string | ✅ | toolbox 分類（如 `"io"`、`"variables"`） |
| level | number | ✅ | 認知層級（冗餘，加速查詢） |
| blockDef | object | ✅ | Blockly JSON block definition |
| codeTemplate | CodeTemplate | ✅ | 程式碼產生模板 |
| astPattern | AstPattern | ✅ | AST 匹配模式 |
| renderMapping | RenderMapping | ❌ | 語意→積木映射（可選，可自動推導） |

**驗證規則**:
- `conceptId` 必須對應到某個 ConceptDef（載入時可 warn，但不 block）
- `blockDef.type` 不可重複

### LanguageManifest

語言套件的描述檔，驅動資源載入。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | ✅ | 語言識別碼（如 `"cpp"`） |
| name | string | ✅ | 顯示名稱（如 `"C++"`） |
| version | string | ✅ | 語意版本號 |
| parser | ParserConfig | ✅ | 解析器設定（type + language） |
| provides | ResourceMap | ✅ | 資源路徑宣告 |

**ResourceMap**:
| key | 型別 | 說明 |
|-----|------|------|
| concepts | string[] | concepts.json 路徑清單 |
| blocks | string[] | block-specs.json 路徑清單 |
| templates | string[] | universal-templates.json 路徑清單 |
| liftPatterns | string[] | lift-patterns.json 路徑清單 |

## Relationships

```
ConceptDef 1 ←── 1 BlockProjection  (via conceptId)
LanguageManifest 1 ──→ * ConceptDef  (via provides.concepts)
LanguageManifest 1 ──→ * BlockProjection  (via provides.blocks)
```

## Adapter 層

為向下相容，定義 adapter 函式將拆分後的兩層合併回 `BlockSpec[]`：

```
mergeToBlockSpecs(concepts: ConceptDef[], projections: BlockProjection[]): BlockSpec[]
```

匹配規則：以 `conceptId` 為 key，將 ConceptDef 的欄位注入 BlockProjection 的 `concept` 欄位，重建完整的 BlockSpec 物件。
