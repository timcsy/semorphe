# Quickstart: Semantic Tree Restructure

**Branch**: `008-semantic-tree-restructure`

## 開發環境

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 執行測試
npm test

# 建置
npm run build
```

## 新增一個套件積木（開發者指南）

### 步驟 1：建立 JSON 定義檔

在 `src/languages/cpp/blocks/` 下建立 JSON 檔案：

```json
[
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
      "constraints": [{ "field": "function", "text": "sort" }]
    }
  }
]
```

### 步驟 2：新增翻譯字串

在 `src/i18n/zh-TW/blocks.json` 和 `src/i18n/en/blocks.json` 中新增：

```json
{
  "CPP_SORT_MSG0": "排序 從 %1 到 %2",
  "CPP_SORT_TOOLTIP": "對指定範圍的元素進行排序"
}
```

### 步驟 3：驗證

```bash
# 執行測試確認 round-trip 正確
npm test

# 啟動 dev server 確認積木在工具箱中出現
npm run dev
```

不需要修改任何既有的 TypeScript 原始碼。

## 專案結構概覽

```
src/
├── core/               ← 語義樹、概念註冊表、投影管線
│   ├── semantic-tree.ts
│   ├── concept-registry.ts
│   ├── projection.ts
│   └── lift.ts
├── blocks/             ← Universal 積木定義（JSON）
│   └── universal.json
├── languages/          ← 語言模組
│   └── cpp/
│       ├── module.ts
│       ├── lifters/    ← AST → SemanticNode 的各 lifter
│       ├── generators/ ← SemanticNode → code 的各 generator
│       ├── blocks/     ← C++ 積木定義（JSON）
│       └── styles/     ← Style preset 定義
├── i18n/               ← 翻譯字串
│   ├── en/
│   └── zh-TW/
├── ui/                 ← VSCode 風格 UI
│   ├── app.ts
│   ├── blockly-panel.ts
│   ├── monaco-panel.ts
│   ├── toolbar.ts
│   ├── sidebar.ts
│   └── console-panel.ts
├── interpreter/        ← 程式執行引擎
└── main.ts             ← 進入點
```
