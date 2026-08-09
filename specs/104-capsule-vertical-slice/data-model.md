# Data Model：膠囊的宣告格式

## `component.json` — 一顆元件的規格

```jsonc
{
  "componentId": "cpp:vector_declare",   // 身分。與資料夾路徑一致，但路徑不是真相
  "layer": "lang-library",
  "abstractConcept": "cpp:var_declare",
  "requires": ["<vector>"],              // 依賴。#include 與工具箱 owner 章的來源
  "properties": [ /* ParamSpec[]，格式與 C1 定的相同 */ ],
  "children": { /* 接點，格式與現行 concepts.json 相同 */ },
  "role": "statement",
  "paths": {                             // 五路的宣告：有的說怎麼有，沒有的說為什麼沒有
    "generate": "./generate.ts",
    "execute": "./execute.ts",
    "lift": "./lift.ts",
    "render": "./forms/blocks.json",
    "extract": "./forms/blocks.json"
  }
}
```

### 為什麼欄位幾乎與現行 `concepts.json` 的一筆相同

**因為它就是那一筆。** 搬家不重寫——`concepts.json` 陣列裡的那個物件原封搬進來，
只多兩個槽：

| 新槽 | 為什麼現在需要 | 沒有它會怎樣 |
|---|---|---|
| `requires` | 今天由 `makeModule('<vector>', …)` 提供，膠囊化後沒有模組了 | 產出的碼少 `#include <vector>`；工具箱把它與 `<stack>` 的容器混在一起 |
| `paths` | 「宣告了沒實作」要看得出來（膠囊契約：宣告即紅燈） | 少一路只會安靜地不做事——這正是「殼」 |

⚠️ **`paths` 不得省略「沒有的那幾路」。** 沒有就寫 `null` ＋ 理由：

```jsonc
"paths": { "execute": null, "_execute_why": "純宣告式，由 pattern 產生，無執行語義" }
```

理由是 `StdModule.registerExecutors` 註解裡已經寫定的紀律：

> 選填的話，忘了接上的模組會靜靜地少一條路……沒有執行器的模組要交一個**具名**的
> 空函式並說明原因，讓「顯式的空」與「遺漏的空」分得出來。

---

## `labels/<locale>.json` — 一個語言一個檔

```jsonc
// components/cpp/vector_declare/labels/zh-TW.json
{
  "CPP_VECTOR_DECLARE_MSG0": "建立 %1 列表 %2",
  "CPP_VECTOR_DECLARE_TOOLTIP": "建立一個列表（可變長度的陣列）…",
  "CPP_VECTOR_DECLARE_TYPE_INT": "int（整數）"
}
```

**鍵維持現名**，不隨膠囊化改。理由與 D 同一條：改名要付存檔遷移，而這裡沒有必要。

**合併規則**：鍵撞了 **throw**，不得後者覆蓋前者。
靜默覆蓋的症狀是「某顆積木顯示別人的字」——使用者看得到，護欄看不到。

---

## 註冊來源（記憶體中，不落地）

```ts
interface CapsuleRegistration {
  componentId: string     // 宣告裡寫的
  sourceDir: string       // 從檔案路徑推導出來的
}
```

**兩者都要，而且要互相核對。** 只有宣告 → 有人複製膠囊忘了改就抓不到；
只有路徑 → 就變成「從檔名推歸屬」，而那是 `experience.md` 明令禁止的
（054 的 `strings.ts` 橫跨兩個模組）。**不一致就紅。**

---

## Key Entities 對照

| spec 的實體 | 落在哪 |
|---|---|
| 膠囊 | `src/components/<scope>/<name>/` 一個資料夾 |
| 歸屬 | `component.json` 的 `componentId`（唯一真相）＋ 路徑（核對用） |
| 切片紀錄 | `specs/104-capsule-vertical-slice/slice-record.md` |
