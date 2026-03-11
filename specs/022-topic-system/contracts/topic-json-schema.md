# Topic JSON 定義檔契約

**Date**: 2026-03-11

## 檔案位置

`src/languages/{lang}/topics/{topic-id}.json`

## Schema

```json
{
  "id": "cpp-beginner",
  "language": "cpp",
  "name": "初學 C++",
  "default": true,
  "description": "適合程式設計初學者的 C++ 積木配置",
  "levelTree": {
    "id": "L0",
    "level": 0,
    "label": "L0: 基礎輸出入",
    "concepts": ["print", "var_declare", "var_assign", "if", "while", "arithmetic", "comparison"],
    "children": [
      {
        "id": "L1a",
        "level": 1,
        "label": "L1a: 函式與迴圈",
        "concepts": ["func_def", "func_call", "for_loop", "logical_op", "break", "continue"],
        "children": [
          {
            "id": "L2a",
            "level": 2,
            "label": "L2a: 陣列與字串",
            "concepts": ["array_declare", "array_access", "string_ops"],
            "children": []
          }
        ]
      },
      {
        "id": "L1b",
        "level": 1,
        "label": "L1b: 進階控制流",
        "concepts": ["switch_case", "do_while", "ternary"],
        "children": [
          {
            "id": "L2b",
            "level": 2,
            "label": "L2b: 指標與參考",
            "concepts": ["pointer", "reference", "pass_by_ref"],
            "children": []
          }
        ]
      }
    ]
  },
  "blockOverrides": {
    "print": {
      "message": "輸出 %1",
      "tooltip": "使用 cout 輸出到螢幕"
    }
  }
}
```

## 欄位規則

### 頂層欄位

| 欄位 | 型別 | 必填 | 驗證 |
|------|------|------|------|
| id | string | ✅ | 格式 `{lang}-{name}`，全域唯一 |
| language | string | ✅ | 必須是已註冊的語言 ID |
| name | string | ✅ | 非空 |
| default | boolean | ❌ | 每語言恰好一個為 true |
| description | string | ❌ | — |
| levelTree | LevelNode | ✅ | 有效的樹結構 |
| blockOverrides | object | ❌ | key 為 ConceptId |

### LevelNode 欄位

| 欄位 | 型別 | 必填 | 驗證 |
|------|------|------|------|
| id | string | ✅ | 在同一 Topic 內唯一 |
| level | number | ✅ | 非負整數，根 = 0 |
| label | string | ✅ | 非空 |
| concepts | string[] | ✅ | 可為空陣列 |
| children | LevelNode[] | ✅ | 可為空陣列 |

### BlockOverride 欄位

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| message | string | ❌ | 覆蓋積木顯示標題 |
| tooltip | string | ❌ | 覆蓋提示文字 |
| args | BlockArgOverride[] | ❌ | 合併語義，見下方 |
| renderMapping | object | ❌ | 部分覆蓋 RenderMapping |

### BlockArgOverride（args 合併語義）

```json
{
  "args": [
    { "name": "SERIAL_PORT", "type": "field_dropdown", "options": [["Serial", "Serial"]], "_insert": "after:VALUE" },
    { "name": "OLD_FIELD", "_remove": true }
  ]
}
```

- 同名 arg → 整體覆蓋
- 新名 arg → 追加（`_insert` 指定位置，預設追加到末尾）
- `_remove: true` → 從 base 移除該 arg

## 載入驗證

載入 Topic JSON 時執行以下驗證：

1. ✅ id 格式正確且唯一
2. ✅ language 已註冊
3. ✅ levelTree 是有效樹（無循環、id 唯一）
4. ✅ blockOverrides 的 key 都是已註冊的 ConceptId
5. ⚠️ 倍增軟指引：每層 concepts 數量約為上層 1.5~2.5 倍（warning，不阻擋載入）
6. ⚠️ 概念覆蓋率：levelTree 中的概念覆蓋了該語言大部分已註冊概念（warning）
