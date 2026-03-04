# Data Model: 架構重構 — 四維分離與語義模型

**Feature**: [spec.md](spec.md) | **Date**: 2026-03-04

## 實體關係圖

```
┌──────────────────────────────────────────────────────────────────┐
│                        SemanticModel                             │
│  program: SemanticNode (root)                                    │
│  metadata: ProgramMetadata                                       │
└────────────────────────┬─────────────────────────────────────────┘
                         │ contains
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SemanticNode                              │
│  concept: ConceptId                                              │
│  properties: Record<string, PropertyValue>                       │
│  children: Record<string, SemanticNode | SemanticNode[]>         │
│  metadata?: NodeMetadata                                         │
└──────────────────────────────────────────────────────────────────┘
                         │ references
                         ▼
┌───────────────┐   ┌──────────────┐   ┌─────────────┐
│  ConceptId    │   │ TypeEntry    │   │ CodingStyle │
│  (enum/union) │   │ value        │   │ ioPreference│
│               │   │ labelKey     │   │ naming      │
└───────────────┘   └──────────────┘   │ braceStyle  │
                         ▲              │ indent      │
                         │ provides     │ ...         │
                         │              └─────────────┘
┌──────────────────────────────────────────┐        ▲ uses
│            LanguageModule                │        │
│  languageId: string                      │────────┘
│  types: TypeEntry[]                      │
│  supportedConcepts: ConceptId[]          │
│  additionalConcepts: ConceptDefinition[] │
│  generator: Generator                    │
│  parser: Parser                          │
│  tooltipOverrides: Record<string, string>│
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│            LocaleBundle                  │
│  blocks: Record<string, string>          │
│  types: Record<string, string>           │
└──────────────────────────────────────────┘
```

---

## 實體定義

### 1. SemanticModel

程式的完整語義表示，是系統中的唯一真實來源（P1）。

| 欄位 | 型別 | 說明 |
|------|------|------|
| program | SemanticNode | 根節點，通常是 'program' 概念 |
| metadata | ProgramMetadata | 程式級呈現資訊（偵測到的風格、原始碼格式等） |

**驗證規則**:
- `program` 不可為 null
- `program.concept` 必須是 'program'

**狀態轉換**:
```
Empty → Code Input → Parsed → SemanticModel
Empty → Block Drag → Read from Workspace → SemanticModel
SemanticModel → Generate → Code Output
SemanticModel → Render → Block Output
```

---

### 2. SemanticNode

語義模型中的單一節點，代表一個程式概念。

| 欄位 | 型別 | 說明 |
|------|------|------|
| concept | ConceptId | 此節點代表的概念 |
| properties | Record<string, PropertyValue> | 語義屬性（變數名、運算子、常數值等） |
| children | Record<string, SemanticNode \| SemanticNode[]> | 子節點（函式體、條件、迴圈體等） |
| metadata? | NodeMetadata | 呈現資訊（原始碼行號、積木位置等） |

**PropertyValue 型別**: `string | number | boolean`

**NodeMetadata 型別**:
| 欄位 | 型別 | 說明 |
|------|------|------|
| sourceRange? | { start: number, end: number } | 原始碼行號範圍 |
| blockPosition? | { x: number, y: number } | 積木在 workspace 中的位置 |
| blockId? | string | 對應的 Blockly block ID |

**驗證規則**:
- `concept` 必須是已註冊的 ConceptId
- `properties` 的 key 必須符合該概念的屬性定義
- `children` 的 key 必須符合該概念的子節點定義

---

### 3. ConceptId

所有程式概念的唯一識別碼，分為 universal 和 language-specific 兩層。

**Universal 概念（所有語言共通）**:

| ConceptId | 說明 | properties | children |
|-----------|------|-----------|----------|
| program | 程式根節點 | — | body: SemanticNode[] |
| var_declare | 變數宣告 | name, type | initializer?: SemanticNode |
| var_assign | 變數賦值 | name | value: SemanticNode |
| var_ref | 變數引用 | name | — |
| number_literal | 數字常數 | value | — |
| string_literal | 字串常數 | value | — |
| arithmetic | 四則運算 | operator | left, right: SemanticNode |
| compare | 比較運算 | operator | left, right: SemanticNode |
| logic | 邏輯運算 | operator | left, right: SemanticNode |
| logic_not | 邏輯否定 | — | operand: SemanticNode |
| if | 條件判斷 | — | condition, then_body: SemanticNode, else_body?: SemanticNode |
| count_loop | 計次迴圈 | var_name | from, to: SemanticNode, body: SemanticNode[] |
| while_loop | 條件迴圈 | — | condition, body: SemanticNode[] |
| break | 中斷迴圈 | — | — |
| continue | 繼續迴圈 | — | — |
| func_def | 函式定義 | name, return_type, params | body: SemanticNode[] |
| func_call | 函式呼叫 | name | args: SemanticNode[] |
| return | 回傳 | — | value?: SemanticNode |
| print | 輸出 | — | values: SemanticNode[] |
| input | 輸入 | variable | — |
| endl | 換行 | — | — |
| array_declare | 陣列宣告 | name, type, size | — |
| array_access | 陣列存取 | name | index: SemanticNode |

**C++ 特有概念（language-specific）**:

| ConceptId | 說明 |
|-----------|------|
| cpp:include | 前處理器引入 |
| cpp:using_namespace | using namespace |
| cpp:char_literal | 字元常數 |
| cpp:increment | 遞增/遞減 |
| cpp:compound_assign | 複合賦值 |
| cpp:switch | switch 語句 |
| cpp:case | case 標籤 |
| cpp:for_loop | C-style for 迴圈 |
| cpp:do_while | do-while 迴圈 |
| cpp:printf | printf 格式化輸出 |
| cpp:scanf | scanf 格式化輸入 |
| cpp:raw_code | 原始碼片段 |
| cpp:raw_expression | 原始表達式 |
| cpp:define | 巨集定義 |
| cpp:ifdef / cpp:ifndef | 條件編譯 |
| cpp:comment | 註解 |
| cpp:pointer_declare | 指標宣告 |
| cpp:pointer_deref | 指標解引用 |
| cpp:address_of | 取址 |
| cpp:malloc / cpp:free | 動態記憶體 |
| cpp:struct_declare | 結構定義 |
| cpp:struct_member_access | 成員存取 |
| cpp:vector / cpp:map / cpp:stack / cpp:queue / cpp:set | STL 容器 |
| cpp:sort | 排序 |
| cpp:class_def / cpp:new / cpp:delete | 物件導向 |
| cpp:template_function | 模板函式 |

---

### 4. TypeEntry

語言模組提供的型別定義項目。

| 欄位 | 型別 | 說明 |
|------|------|------|
| value | string | 型別的程式碼表示（如 `"int"`） |
| labelKey | string | i18n key（如 `"TYPE_INT"`） |
| category? | 'basic' \| 'advanced' | 分類（用於 UI 分組顯示） |

**C++ 型別清單範例**:

| value | labelKey | category |
|-------|----------|----------|
| int | TYPE_INT | basic |
| double | TYPE_DOUBLE | basic |
| char | TYPE_CHAR | basic |
| bool | TYPE_BOOL | basic |
| string | TYPE_STRING | basic |
| long long | TYPE_LONG_LONG | advanced |
| float | TYPE_FLOAT | advanced |
| void | TYPE_VOID | basic |

---

### 5. LanguageModule

程式語言的完整定義，提供型別、概念、生成器、解析器等。

| 欄位 | 型別 | 說明 |
|------|------|------|
| languageId | string | 語言唯一識別碼（如 `"cpp"`） |
| displayNameKey | string | 語言名稱的 i18n key |
| types | TypeEntry[] | 型別清單 |
| supportedConcepts | ConceptId[] | 此語言支援的 universal 概念 |
| additionalConcepts | ConceptDefinition[] | 此語言專屬的額外概念 |
| tooltipOverrides | Record<string, string> | tooltip key 覆蓋（key → 新 i18n key） |
| blockSpecs | BlockSpec[] | 語言專屬積木定義 |
| getGenerator() | Generator | 程式碼生成器 |
| getParser() | Parser | 程式碼解析器 |
| getAdapter() | LanguageAdapter | AST→SemanticNode 適配器 |

**驗證規則**:
- `languageId` 不可為空
- `types` 至少包含一個型別
- `supportedConcepts` 必須是 universal 概念的子集

---

### 6. CodingStyle

編碼風格配置，控制程式碼生成的格式。

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | string | 風格識別碼 |
| nameKey | string | 風格名稱的 i18n key |
| ioPreference | 'iostream' \| 'cstdio' | I/O 偏好 |
| namingConvention | 'camelCase' \| 'snake_case' \| 'PascalCase' | 命名慣例 |
| braceStyle | 'K&R' \| 'Allman' | 大括號風格 |
| indent | number | 縮排空格數 |
| useNamespaceStd | boolean | 是否使用 `using namespace std` |
| headerStyle | 'iostream' \| 'bits' | 標頭檔風格 |

**驗證規則**:
- `indent` 必須是正整數（1-8）
- `id` 不可為空

---

### 7. LocaleBundle

一個語言環境的完整翻譯資料。

| 欄位 | 型別 | 說明 |
|------|------|------|
| localeId | string | 語言環境識別碼（如 `"zh-TW"`） |
| blocks | Record<string, string> | 積木 message/tooltip 翻譯（key → 文字） |
| types | Record<string, string> | 型別 label 翻譯（key → 文字） |

**Blocks key 命名慣例**:
- Message: `{BLOCK_ID}_MSG` 或 `{BLOCK_ID}_MSG{N}`（多段 message）
- Tooltip: `{BLOCK_ID}_TOOLTIP`
- Dropdown: `{BLOCK_ID}_{FIELD}_{OPTION}`

---

## 實體關係

| 關係 | 說明 |
|------|------|
| SemanticModel contains SemanticNode | 1:N 樹狀結構 |
| SemanticNode references ConceptId | N:1 每個節點對應一個概念 |
| LanguageModule provides TypeEntry[] | 1:N 每個語言模組提供多個型別 |
| LanguageModule supports ConceptId[] | N:N 語言模組聲明支援哪些概念 |
| CodingStyle parameterizes Generator | N:1 風格作為生成器的參數 |
| LocaleBundle provides translations | 1:1 每個 locale 對應一組翻譯 |
| Generator reads CodingStyle | 生成程式碼時讀取風格設定 |
| Parser detects CodingStyle | 解析程式碼時偵測風格 |

---

## 資料流

### Code → Blocks 方向

```
1. 使用者輸入程式碼
2. Parser.parse(code) → CST (tree-sitter)
3. Adapter.toSemanticModel(CST) → SemanticModel
4. Parser.detectStyle(code) → Partial<CodingStyle> (metadata)
5. Renderer.render(SemanticModel, language, locale) → Blockly Workspace
```

### Blocks → Code 方向

```
1. 使用者拖拉積木
2. Reader.read(workspace) → SemanticModel
3. Generator.generate(SemanticModel, language, style) → Code
4. Code 顯示在程式碼編輯器
```

### Style 切換

```
1. 使用者選擇新風格 preset
2. 從當前 workspace 讀取 SemanticModel（不變）
3. Generator.generate(SemanticModel, language, newStyle) → 新格式 Code
4. 積木不動，只更新程式碼編輯器
```
