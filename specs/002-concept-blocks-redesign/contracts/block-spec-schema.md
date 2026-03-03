# Block Spec Schema: 概念式積木系統

**Feature**: 002-concept-blocks-redesign
**Date**: 2026-03-03

## 共用積木定義格式

```json
{
  "id": "u_count_loop",
  "language": "universal",
  "category": "control",
  "version": "1.0.0",
  "blockDef": {
    "type": "u_count_loop",
    "message0": "重複：%1 從 %2 到 %3",
    "args0": [
      { "type": "field_input", "name": "VAR", "text": "i" },
      { "type": "input_value", "name": "FROM", "check": "Expression" },
      { "type": "input_value", "name": "TO", "check": "Expression" }
    ],
    "message1": "%1",
    "args1": [
      { "type": "input_statement", "name": "BODY" }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "計數式重複迴圈"
  }
}
```

**注意**：共用積木**沒有** `codeTemplate` 和 `astPattern`。

## 語言特殊積木定義格式

```json
{
  "id": "cpp_for_3part",
  "language": "cpp",
  "category": "control",
  "version": "1.0.0",
  "blockDef": {
    "type": "cpp_for_3part",
    "message0": "三段式迴圈 初始化 %1 條件 %2 更新 %3",
    "args0": [
      { "type": "input_value", "name": "INIT", "check": "Expression" },
      { "type": "input_value", "name": "COND", "check": "Expression" },
      { "type": "input_value", "name": "UPDATE", "check": "Expression" }
    ],
    "message1": "%1",
    "args1": [
      { "type": "input_statement", "name": "BODY" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "C/C++ 三段式 for 迴圈"
  },
  "codeTemplate": {
    "pattern": "for (${INIT}; ${COND}; ${UPDATE}) {\n${BODY}\n}",
    "imports": [],
    "order": 0
  },
  "astPattern": {
    "nodeType": "for_statement",
    "constraints": []
  }
}
```

## BlockSpec 欄位驗證規則

| 欄位 | 共用積木 | 語言特殊積木 |
|------|---------|------------|
| id | 必填，前綴 `u_` | 必填，前綴為語言 ID（如 `cpp_`） |
| language | 必填，值為 `"universal"` | 必填，值為語言 ID |
| category | 必填 | 必填 |
| version | 必填 | 必填 |
| blockDef | 必填 | 必填 |
| blockDef.type | 必須等於 id | 必須等於 id |
| codeTemplate | 不允許 | 必填 |
| astPattern | 不允許 | 必填 |

## 概念類別色彩對照

| 類別 ID | 中文名稱 | 色相值（Hue） |
|---------|---------|-------------|
| data | 資料 | 330（紫） |
| control | 流程控制 | 40（橙） |
| functions | 函式 | 60（黃） |
| io | 輸入輸出 | 180（青） |
| operators | 運算 | 210（藍） |
| arrays | 陣列 | 260（靛） |
| loops | 迴圈 | 120（綠） |
