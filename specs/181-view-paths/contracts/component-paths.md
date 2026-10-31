# Contract: `component.json` 的 `paths`（第 181 號 spec 之後）

一顆典型的 C++ 元件：

```json
"paths": {
  "views": {
    "blocks": { "render": "./forms/blocks.json", "lift": "./forms/blocks.json" },
    "code":   { "render": "./generate.ts", "lift": "./lift-pattern.json", "liftStrategy": "./lift-strategy.ts" }
  },
  "formalize": "./formalize.ts",
  "execute": "./execute.ts"
}
```

刻意沒有某一路（顯式的空）：

```json
"code": { "render": "./generate.ts", "lift": null, "_lift_why": "這顆只由別顆的辨識產生，不單獨從程式碼辨識" }
```

單向視圖（今天沒有；示意）：

```json
"diagnostics": { "render": "./diagnostics.ts" }
```

違約（載入時擲錯，訊息說出元件與視圖）：

- 平鋪的舊鍵：`"paths": { "generate": "./generate.ts", … }`
- 雙向視圖少了 `lift` 鍵；單向視圖出現 `lift`
- `null` 而沒有同層的 `_why`
- 視圖名不在核心的視圖表上
