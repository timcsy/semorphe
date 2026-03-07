# Data Model: First Principles Compliance

## 擴展的實體

### NodeMetadata（擴展）

**位置**: `src/core/types.ts`

```
NodeMetadata
├── confidence: ConfidenceLevel      # 擴展：'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'
├── degradationCause?: DegradationCause  # 新增：僅當 confidence 為 'raw_code' 時設定
├── rawCode?: string                 # 不變
├── sourceRange?: SourceRange        # 不變
├── syntaxPreference?: string        # 不變
└── blockId?: string                 # 不變
```

**驗證規則**:
- `confidence` 為 `'raw_code'` 時，`degradationCause` MUST NOT 為 undefined
- `confidence` 不為 `'raw_code'` 時，`degradationCause` SHOULD 為 undefined
- `degradationCause` 為 `'syntax_error'` 時，對應 AST 節點 MUST 包含 tree-sitter ERROR

### ConfidenceLevel（新增 type）

```
ConfidenceLevel = 'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'
```

| 值 | 語義 | 設定時機 |
|----|------|---------|
| `high` | 精確 pattern 匹配 | lift Level 1-2 |
| `warning` | 結構匹配但語義可疑 | composite pattern 部分驗證失敗 |
| `inferred` | 推斷（部分子節點可 lift）| lift Level 3 |
| `user_confirmed` | 使用者手動確認 | 未來：UI 互動 |
| `llm_suggested` | LLM 推薦 | 未來：LLM 層 |
| `raw_code` | 無法結構化 | lift Level 4 |

### DegradationCause（新增 type）

```
DegradationCause = 'syntax_error' | 'unsupported' | 'nonstandard_but_valid'
```

| 值 | 判定規則 | 積木視覺 |
|----|---------|---------|
| `syntax_error` | tree-sitter 產生 ERROR 節點 | 紅色背景 #FF6B6B |
| `unsupported` | AST 節點類型對應 ConceptRegistry 已知概念但寫法不匹配 | 灰色背景 #9E9E9E |
| `nonstandard_but_valid` | AST 節點類型完全不在 ConceptRegistry 中 | 綠色邊框 #4CAF50 |

### Annotation（已存在，確認不變）

```
Annotation
├── type: 'comment' | 'pragma' | 'lint_directive'
├── text: string
└── position: 'before' | 'after' | 'inline'
```

**語義對應**:
- 行尾註解 `x = 1; // set x` → `{ type: 'comment', text: ' set x', position: 'inline' }` 附著在 var_assign 節點
- 獨立註解 `// header` → 獨立 `comment` 語義節點（`properties.text = ' header'`）
- 表達式內部 `/* important */` → `{ type: 'comment', text: ' important ', position: 'before' }` 附著在對應子節點

### ConceptPathReport（驗證腳本內部）

```
ConceptPathReport
├── conceptId: string
├── sources: string[]              # 哪些檔案定義了此概念
├── paths:
│   ├── lift: boolean
│   ├── render: boolean
│   ├── extract: boolean
│   └── generate: boolean
└── missing: string[]              # 缺失路徑名稱列表
```

## 實體關係

```
SemanticNode
  ├── metadata: NodeMetadata
  │     ├── confidence: ConfidenceLevel
  │     └── degradationCause?: DegradationCause
  └── annotations?: Annotation[]

ConceptRegistry
  └── concepts: Map<string, ConceptDef>
        └── 被 verify-concept-paths 腳本掃描

CodingStyle（不變）
  └── 被 generate() 讀取，影響程式碼輸出格式
```

## 狀態轉換

### Confidence 在 lift 流程中的設定

```
AST 節點進入 lift
  │
  ├─ PatternLifter 匹配成功 → confidence: 'high'
  │   └─ composite 部分驗證失敗 → confidence: 'warning'
  │
  ├─ 手寫 lifter 匹配成功 → confidence: 'high'
  │
  ├─ 部分子節點可 lift → confidence: 'inferred'
  │
  └─ 完全無法匹配 → confidence: 'raw_code'
      ├─ AST 含 ERROR → degradationCause: 'syntax_error'
      ├─ nodeType 對應已知概念 → degradationCause: 'unsupported'
      └─ nodeType 完全未知 → degradationCause: 'nonstandard_but_valid'
```
