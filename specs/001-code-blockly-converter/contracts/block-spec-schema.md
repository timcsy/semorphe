# Block Spec JSON Schema 規範

積木定義檔的格式規範。使用者只要照此格式撰寫 JSON 檔案，即可定義新積木。

## 格式範例

```json
{
  "id": "c_for_loop",
  "category": "loops",
  "version": "1.0.0",
  "blockDef": {
    "type": "c_for_loop",
    "message0": "for %1 ; %2 ; %3",
    "args0": [
      { "type": "input_value", "name": "INIT", "check": "Expression" },
      { "type": "input_value", "name": "COND", "check": "Boolean" },
      { "type": "input_value", "name": "UPDATE", "check": "Expression" }
    ],
    "message1": "do %1",
    "args1": [
      { "type": "input_statement", "name": "BODY" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "C for loop"
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

## 必要欄位

| 欄位           | 型別   | 說明                                    |
| -------------- | ------ | --------------------------------------- |
| `id`           | string | 積木唯一識別碼，不得與已註冊積木衝突    |
| `category`     | string | 工具箱分類名稱                          |
| `version`      | string | 語意化版本號                            |
| `blockDef`     | object | Blockly JSON 積木定義                   |
| `codeTemplate` | object | 程式碼產生模板                          |
| `astPattern`   | object | AST 匹配模式（Code → Block 用）        |

## blockDef 欄位

遵循 Blockly JSON block definition 格式。關鍵欄位：

- `type`: 必須與外層 `id` 一致
- `message0`, `args0`: 積木的外觀和輸入欄位
- `previousStatement` / `nextStatement`: 是否可連接上下積木
- `output`: 若此積木是表達式（有回傳值），設定回傳類型
- `colour`: 積木顏色（HSV 色相值 0-360）

## codeTemplate 欄位

- `pattern`: 程式碼模板，使用 `${INPUT_NAME}` 作為佔位符
- `imports`: 此積木需要的標頭檔（如 `["stdio.h"]`）
- `order`: 運算子優先順序，用於決定是否需要括號

## astPattern 欄位

- `nodeType`: tree-sitter CST 中對應的節點類型
- `constraints`: 子節點額外約束（可選），用於區分相同節點類型但不同語意的情況
