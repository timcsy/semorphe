# Contract: Block Spec JSON 格式

新增套件積木時，開發者只需建立符合此格式的 JSON 檔案。系統啟動時自動掃描並載入。

## 完整範例

```jsonc
{
  "id": "cpp:stdlib:sort",
  "language": "cpp",
  "category": "algorithms",
  "level": 2,
  "version": "1.0.0",

  "concept": {
    "conceptId": "cpp:stdlib:sort",
    "abstractConcept": "collection_sort"
  },

  "blockDef": {
    "type": "cpp_sort",
    "message0": "%{BKY_CPP_SORT_MSG0}",
    "args0": [
      { "type": "input_value", "name": "BEGIN", "check": "Expression" },
      { "type": "input_value", "name": "END", "check": "Expression" }
    ],
    "previousStatement": "Statement",
    "nextStatement": "Statement",
    "colour": "#4C97FF",
    "tooltip": "%{BKY_CPP_SORT_TOOLTIP}"
  },

  "codeTemplate": {
    "pattern": "sort(${BEGIN}, ${END});",
    "imports": ["algorithm"],
    "order": 0
  },

  "astPattern": {
    "nodeType": "call_expression",
    "constraints": [
      { "field": "function", "text": "sort" }
    ]
  }
}
```

## 欄位規則

### 必填欄位

| 欄位 | 規則 |
|------|------|
| id | 格式：`language:package:concept`（Universal 概念可省略 language 和 package） |
| language | 必須是已註冊的語言模組 ID |
| category | 用於工具箱分類（如 `variables`、`operators`、`control`、`io`、`algorithms`） |
| level | `0`（L0 初學）、`1`（L1 進階）、`2`（L2 高階） |
| version | 語意化版本號 |
| concept.conceptId | 與 id 一致 |
| blockDef | 合法的 Blockly block JSON 定義 |
| codeTemplate.pattern | 含 `${FIELD}` 佔位符的模板字串 |
| codeTemplate.imports | 字串陣列（可為空 `[]`） |
| astPattern.nodeType | tree-sitter 的 AST 節點類型名稱 |

### 選填欄位

| 欄位 | 預設值 | 說明 |
|------|--------|------|
| concept.abstractConcept | null | Universal 概念不需要映射 |
| codeTemplate.order | 0 | 運算子優先順序（0 = statement，數字越大優先順序越高） |
| astPattern.constraints | [] | 無額外匹配條件 |

## 檔案放置規則

```
src/
├── blocks/
│   └── universal.json          ← Universal 概念（level 0/1/2）
└── languages/
    └── cpp/
        └── blocks/
            ├── core.json       ← Lang-Core 概念
            ├── stdlib/
            │   ├── io.json     ← 標準函式庫 I/O
            │   ├── containers.json
            │   └── algorithms.json
            └── external/       ← 第三方函式庫（未來擴充點）
```

系統啟動時掃描 `src/blocks/**/*.json` 和 `src/languages/*/blocks/**/*.json`，自動載入所有 BlockSpec。
