# `@cos-mos/arduino` 詞彙套件——第一版的格式草案

> 狀態：🟡 草案（2026-11-04）。給 cos-mos 對欄位（它的 specs/017 T004 等這一份）。
> 來源：使用者 2026-11-04 定的三題（cos-mos history/014）→ vision〈`@cos-mos/arduino` 詞彙套件第一版〉。
> 已和 cos-mos 對齊的（訊息往來，2026-11-04）：動作清單從程式來、值用字串、`{ expr }`、kind 必寫、params 順序有意義、`at` 是遞增整數、走宿主層的結構頻道。
> ⚠️ 發布前要問使用者：第一版交給 cos-mos 的主持人，不自己發。

## 量到的現況（2026-11-04，`owner = (arduino)` 的 43 顆）

| | 數量 |
|---|---|
| 敘述（statement） | 28 |
| 運算式（expression） | 15 |
| 屬性（properties） | 32 個：`literal` 17（多半是接收者 `obj`：`Serial`、`lcd`…）、`enum` 7、`identifier` 4、`number` 4 |
| 接點（slots） | 53 個單一運算式 ＋ 3 個可變長度（裝置宣告的建構參數 `initializer`） |

🔴 **接點在宣告裡沒有型別**（`"pin": "expression"`）。cos-mos 的核對器要型別（`pin` 是 int、0–31），所以第一版要先回答「型別從哪裡來」——見下面的推薦。

## 套件形狀

```jsonc
{
  "name": "@cos-mos/arduino",
  "version": "0.1.0",
  "contentHash": "sha256:…",          // components 的正規化 JSON（鍵排序）之雜湊；版本不變而雜湊變了 ⟹ 拒絕
  "components": {
    "arduino:digital_write": {
      "kind": "statement",              // 必寫：statement | expression
      "params": {                       // 順序有意義（C++ 呼叫依位置）；核對器不重排
        "pin":   { "type": "int" },
        "value": { "type": "enum", "values": ["HIGH", "LOW"] }
      },
      "pins": "未定"                    // 接點第一版留空，ArduinoCAD 合流時補
    },
    "arduino:serial_print": {
      "kind": "statement",
      "params": {
        "obj":     { "type": "string", "default": "Serial" },   // 接收者
        "value":   { "type": "expr" },
        "format":  { "type": "expr", "required": false },
        "newline": { "type": "bool", "default": false }
      },
      "pins": "未定"
    }
  }
}
```

另附一份對照表（同一個套件裡的 `semorphe-map.json`）：`"arduino:digital_write" ↔ "cpp:digital_write"`，一對一；之後正本翻轉到詞彙套件時，semorphe 讀它對齊。

## params 從哪裡來

| 來源 | 規則 |
|---|---|
| 屬性（properties） | 照宣告順序；`identifier`／`literal` → `string`、`enum` → `enum`（`values` 取積木下拉的選項）、`number` → `int` |
| 接點（slots） | 接在屬性之後、照宣告順序；**型別見下** |
| 可變長度接點（`expressions`） | 第一版標 `{ "type": "expr", "variadic": true }`——裝置宣告的建構參數（`DHT dht(2, DHT11)`），長度依裝置 |

### 🟡 接點的型別——推薦 (b)

| 選項 | 做法 | 代價 |
|---|---|---|
| (a) 一律 `expr` | 不宣告型別 | cos-mos 量不到 `pin` 的範圍——結構頻道等於只核名字 |
| **(b) 在元件宣告裡補型別**（推薦） | `component.json` 的接點從 `"pin": "expression"` 擴成 `"pin": { "role": "expression", "type": "int" }`；只補這 43 顆用得到的 53 個 | 一次性的宣告擴充（四路與形態的讀法要容許新形狀），但型別住在正本裡，詞彙套件抽出來就有；翻轉正本時直接搬 |
| (c) 匯出器裡手寫一張表 | 53 筆寫在匯出工具裡 | 第二份真相——宣告改了表不會跟著動 |

推薦 (b)：型別是元件的事實，應該住在元件的宣告裡；(c) 會在翻轉正本前多出一份會漂的表。第一版的型別只有 `int`、`string`、`bool`、`enum`、`expr` 五種（對齊 cos-mos 的核對器）。

## 動作清單（結構頻道）

```jsonc
{
  "vocab": "@cos-mos/arduino@0.1.0",
  "at": 42,                                   // 樹的版本，單調遞增；接收端丟 at ≤ last().at 的
  "actions": [
    { "op": "arduino:pin_mode",      "args": { "pin": "13", "mode": "OUTPUT" },          "at": "node_3" },
    { "op": "arduino:digital_write", "args": { "pin": "13", "value": { "expr": "state" } }, "at": "node_7" }
  ],
  "unmapped": [ { "at": "node_9", "componentId": "cpp:raw_code" } ]
}
```

- **只放敘述**；運算式元件出現在別的動作的 `args` 裡，寫成 `{ "expr": "<原始碼>" }`。
- 值一律字串（整數十進位、布林是布林）；不是字面值的寫 `{ "expr": … }`。
- 每筆 `at` 是語意樹的節點 id（積木點得回去）；外層的 `at` 是樹的版本。
- 翻不出的（沒有詞彙名字的元件）進 `unmapped`，不靜默丟。
- 推送：semorphe 在宿主層提供 `onStructure(cb)`，樹每變一次推一份（SemanticBus 的樹變事件）。

## 還沒做的（實作那一刀，約 1 天）

1. 依 (b) 補 53 個接點的型別（或使用者選別的選項）。
2. 匯出工具：`tools/export-arduino-vocab.ts` → `build/cos-mos-arduino/`（套件 JSON ＋ 對照表 ＋ 雜湊）；護欄：43 顆都在、對照表一對一、每個 param 都有型別。
3. `onStructure`：語意樹 → 動作清單的投影，附單元測試（含 `unmapped`、`{ expr }`、版本遞增）。
4. 交給 cos-mos 的主持人；發布前由主持人問使用者。
