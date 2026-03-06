# Data Model: Semantic Tree Restructure

**Branch**: `008-semantic-tree-restructure` | **Date**: 2026-03-06

## Core Entities

### SemanticNode（語義樹節點）

語義樹的基本單元。每個節點代表一個「概念」的實例。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | 是 | 唯一識別碼（UUID），用於追蹤同一節點跨投影 |
| concept | ConceptId | 是 | 概念類型（如 `var_declare`、`if`、`arithmetic`） |
| properties | Record<string, PropertyValue> | 是 | 屬性 map（如 `{name: 'x', type: 'int'}`） |
| children | Record<string, SemanticNode[]> | 是 | 子節點 map（如 `{body: [...], condition: [...]}`） |
| annotations | Annotation[] | 否 | 附著型元資訊（註解、pragma 等） |
| metadata | NodeMetadata | 否 | 語法偏好、confidence 等非語義資訊 |

**PropertyValue**: `string | number | boolean | string[]`

### Annotation（附著型元資訊）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| type | 'comment' \| 'pragma' \| 'lint_directive' | 是 | 元資訊類型 |
| text | string | 是 | 內容文字 |
| position | 'before' \| 'after' \| 'inline' | 是 | 相對於宿主節點的位置 |

### NodeMetadata（節點元資料）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| syntaxPreference | string | 否 | 語法偏好標籤（如 `compound_assign`） |
| confidence | 'high' \| 'inferred' | 否 | lift() 的辨識信心度 |
| rawCode | string | 否 | 降級時保留的原始程式碼文字 |
| sourceRange | SourceRange | 否 | 原始程式碼中的位置範圍 |

### ConceptDef（概念定義）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | ConceptId | 是 | 完整 ID（如 `cpp:stdlib:sort`） |
| layer | 'universal' \| 'lang-core' \| 'lang-library' | 是 | 概念分層 |
| level | 0 \| 1 \| 2 | 是 | 認知層級（L0/L1/L2） |
| abstractConcept | ConceptId | 否 | 映射的抽象概念（Universal 概念此欄位為空） |
| propertyNames | string[] | 是 | 允許的屬性名稱 |
| childNames | string[] | 是 | 允許的子節點名稱 |
| semanticContract | SemanticContract | 否 | 語義契約（用於跨語言映射阻抗偵測） |

### SemanticContract（語義契約）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| effect | 'pure' \| 'mutate_self' \| 'mutate_arg' | 是 | 副作用類型 |
| returnSemantics | 'void' \| 'self' \| 'new_value' | 是 | 回傳語義 |
| chainable | boolean | 是 | 是否可鏈式呼叫 |

### BlockSpec（積木規格，JSON 定義）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | 是 | 積木 ID |
| language | string | 是 | 所屬語言（如 `cpp`、`universal`） |
| category | string | 是 | 工具箱分類 |
| level | 0 \| 1 \| 2 | 是 | 認知層級 |
| version | string | 是 | 語意化版本號 |
| concept | ConceptMapping | 是 | 語義概念映射 |
| blockDef | object | 是 | Blockly block 定義（type、message、args、colour 等） |
| codeTemplate | CodeTemplate | 是 | 程式碼生成模板 |
| astPattern | AstPattern | 是 | AST 辨識模式 |

### ConceptMapping（概念映射）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| conceptId | ConceptId | 是 | 對應的概念 ID |
| abstractConcept | ConceptId | 否 | 映射的抽象概念 |

### CodeTemplate（程式碼模板）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| pattern | string | 是 | 模板字串（含 `${FIELD}` 佔位符） |
| imports | string[] | 是 | 需要的 include/import |
| order | number | 是 | 運算子優先順序（用於括號判斷） |

### AstPattern（AST 辨識模式）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| nodeType | string | 是 | tree-sitter AST 節點類型 |
| constraints | AstConstraint[] | 是 | 額外匹配條件 |

### StylePreset（風格預設）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | 是 | 風格 ID（如 `apcs`、`competitive`、`google`） |
| name | Record<string, string> | 是 | 各 locale 的顯示名稱 |
| io_style | 'cout' \| 'printf' | 是 | I/O 風格 |
| naming_convention | 'camelCase' \| 'snake_case' | 是 | 新建變數命名建議 |
| indent_size | number | 是 | 縮排空格數 |
| brace_style | 'K&R' \| 'Allman' | 是 | 大括號風格 |
| namespace_style | 'using' \| 'explicit' | 是 | namespace 使用方式 |
| header_style | 'bits' \| 'individual' | 是 | include 風格 |

### LiftContext（lift 上下文）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| declarations | Declaration[] | 是 | 變數/函式宣告（帶作用域） |
| usingDirectives | string[] | 是 | using namespace 指令 |
| includes | string[] | 是 | include 的 header |
| macroDefinitions | string[] | 是 | 已定義的巨集名稱 |
| scopeStack | Scope[] | 是 | 作用域棧 |

### WorkspaceState（工作區持久化狀態）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| version | number | 是 | 格式版本號（用於未來遷移） |
| tree | SemanticNode | 是 | 語義樹根節點 |
| language | string | 是 | 當前程式語言 |
| style | string | 是 | 當前風格 preset ID |
| locale | string | 是 | 當前介面語言 |
| level | 0 \| 1 \| 2 | 是 | 當前認知層級 |

## Entity 關係

```
WorkspaceState
  └── SemanticNode (tree)
        ├── concept → ConceptDef (via ConceptRegistry)
        ├── children → SemanticNode[] (遞迴)
        ├── annotations → Annotation[]
        └── metadata → NodeMetadata

ConceptDef
  ├── abstractConcept → ConceptDef (映射)
  └── semanticContract → SemanticContract

BlockSpec
  ├── concept → ConceptMapping → ConceptDef
  ├── blockDef → Blockly block definition
  ├── codeTemplate → CodeTemplate
  └── astPattern → AstPattern

StylePreset ──→ project() 參數
LiftContext ──→ lift() 內部狀態
```

## 狀態轉換

### 語義樹生命週期

```
空 → [使用者拖入積木] → 有內容
有內容 → [使用者修改積木] → 更新（新版本）
有內容 → [使用者按同步] → 從程式碼重建（新樹）
有內容 → [瀏覽器關閉] → 序列化到 localStorage
序列化 → [瀏覽器開啟] → 反序列化恢復
有內容 → [使用者匯出] → JSON 檔案
JSON 檔案 → [使用者匯入] → 恢復為新樹
```

### 同步狀態機

```
[同步中] ──積木操作──→ [積木已修改] ──自動project()──→ [同步中]
[同步中] ──程式碼編輯──→ [程式碼已修改（未同步）]
[程式碼已修改] ──按同步按鈕──→ [解析中]
[解析中] ──無錯誤──→ [同步中]
[解析中] ──有錯誤──→ [顯示錯誤提示]
[顯示錯誤提示] ──使用者確認繼續──→ [部分同步] → [同步中]
[顯示錯誤提示] ──使用者取消──→ [程式碼已修改（未同步）]
```
