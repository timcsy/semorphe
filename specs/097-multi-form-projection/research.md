# Phase 0 研究：多形態機制

## ⚠️ 先更正規格裡的一個事實

規格寫著阻斷點是 `src/core/block-spec-registry.ts:6` 的 `byConceptId`。**那是對的一半。**

實測：`getByConceptId` / `getBlockTypeForConcept` / `getConceptToBlockMap` **在 `src/` 裡零呼叫者**。
`BlockSpecRegistry` 的 conceptId 索引是**宣告的真相，不是活的路徑**——又一個「機制有了，沒人接上」。

**真正的渲染路徑是 `PatternRenderer.renderSpecs`：**

```ts
// src/core/projection/pattern-renderer.ts:69
this.renderSpecs.set(conceptId, { blockType, mapping })
// :108
const spec = this.renderSpecs.get(node.conceptId)
```

→ **兩個地方都要改**，但只有後者會改變行為。前者不改的話，宣告與實作會分歧（而那正是雙重真相護欄在看的東西）。

---

## 決定 1：多形態不是新機制，是把既有的特例一般化

### 發現

`renderMapping.expressionCounterpart` **已經存在**，而且是宣告式的、住在 JSON 裡：

```json
// src/blocks/projections/blocks/universal-blocks.json:20
"expressionCounterpart": "c_var_declare_expr"
```

目前 5 處在用：`c_var_declare_expr`、`u_input_expr`、`c_increment_expr`、`c_compound_assign_expr`、`c_scanf_expr`。

而 `PatternRenderer` 還自動推導出兩個集合：

```ts
// blockDef 有 output 沒 previousStatement → 只能當運算式
this.expressionOnlyBlockTypes.add(blockType)
// 有 previousStatement 沒 output → 只能當敘述
this.statementOnlyBlockTypes.add(blockType)
```

**所以「一個概念、兩個形態、依位置選」這件事系統已經在做了**——只是：

1. 它**只支援 statement/expression 這一種選擇軸**
2. 它的鍵是 **blockType** 而不是 conceptId，所以那兩顆積木在登錄表裡仍是兩個獨立的 conceptId

### 決定

**把 `expressionCounterpart` 一般化成「形態集合 ＋ 具名的選擇軸」**，而不是另造一套。

- **理由**：既有的做法已經證明「宣告式、住 JSON、渲染時選」這條路可行且有 5 個活的使用者。另造一套會產生兩套並存的選擇機制——那是碎裂。
- **替代方案（已否決）**：
  - **在渲染層加 `switch (conceptId)`** — 違反 FR-003，而且中立性護欄會叫（核心層出現具體元件身分）。
  - **用 blockDef 的 mutator 讓一顆積木變形** — Blockly 做得到，但它把「兩個形態」藏進積木的執行期狀態，登錄表看不見，圖鑑也顯示不出來。而圖鑑正是這個功能要服務的東西之一。
  - **保留兩個 conceptId，只修標籤** — 那是 `ab84f6c` 已經做的止血，但它不解決 B 項的阻斷。

---

## 決定 2：抽取那一側**不用改**

### 發現

```ts
// src/core/projection/pattern-extractor.ts:59
this.extractSpecs.set(blockType, { conceptId, mapping })
```

抽取的鍵**本來就是 blockType**，而值裡帶著 conceptId。

→ **多個積木型別對同一個 conceptId 在抽取側天然成立**，第二次 `set` 不會蓋掉第一次（鍵不同）。

### 決定

FR-005（反向從任一形態都得到同一個 componentId）**不需要新程式碼，只需要一支測試釘住它**。

- **理由**：這是免費拿到的性質，但**免費的性質最容易在日後被改壞而沒人發現**。釘住它的成本是一支測試。

---

## 決定 3：選擇形態所需的脈絡，在辨識時寫進節點

### 發現

`cpp_container_push` 的節點只有 `properties.obj`（變數名）。渲染時要知道 `st` 是堆疊還是佇列，而渲染路徑**沒有宣告脈絡**。

而辨識時查得到——`LiftContextData.getType()` 已於 076 接上，095 的 `istringstream` 就是用它分辨 `in >> a`（串流讀取）與 `num >> 1`（位移）。

### 決定

**辨識時把容器種類寫進節點屬性**，與 095 的 `input.from` 同型。

- **理由**：投影需要的資訊必須在節點上，因為投影是無脈絡的。這條在 095 已經走過一次且有效。
- **這不是雙重真相**：容器種類確實可以從宣告節點推導，但**推導需要走整棵樹**，而投影是逐節點的。與 095 的 `from` 完全同一個論證。
- **替代方案（已否決）**：
  - **渲染時回頭查樹** — 渲染是逐節點的，沒有樹的引用；硬給它一個等於讓投影依賴脈絡。
  - **在 UI 層依連接的變數即時決定** — 那把規則放進呈現層，違反 FR-003，而且產生的積木存進存檔之後型別是什麼就不確定了。

### 查不到型別時

**必須有一個不宣稱位置的預設形態**（FR-007）。`ab84f6c` 已經把共用標籤改成中性的「加入 %2 到 %1」，那一顆正好就是這個預設。

---

## 決定 4：存檔轉換有現成的家，而且它是空的

### 發現

```ts
// src/core/storage-version.ts:16
export const CURRENT_VERSION = 1
// :71
export const UPGRADES: Record<number, Upgrade> = {}
```

而且檔頭寫著：

> 「`CURRENT_VERSION` 首次調成 2 的那天，那等於拒絕掉每一位既有使用者的存檔」

且 `storage-version.test.ts` 有一支測試**釘住「從 1 到 `CURRENT_VERSION` 的每一階都要有 Upgrade」**。

### 決定

**`CURRENT_VERSION: 1 → 2`，並在 `UPGRADES[1]` 寫積木型別的轉換。**

- **理由**：機制是為這一天設計的，而且既有測試會強迫我們把它填滿——**忘記寫轉換會直接紅**。
- **順序**：先寫 `UPGRADES[1]` 與它的測試，**再**改積木型別。這樣任何時間點存檔都載得起來。
- **P8 的授權**：`knowledge/history/026` 已釐清 P8 的範圍不含語義詞彙本身；一次性升級（載入時轉換、舊格式隨即消失）仍是乾淨的切割。

---

## 決定 5：選擇軸要具名，而且要能不只兩個

### 決定

選擇軸宣告成 `{ 軸名, 依據, 各值對應的形態 }`，而非硬編兩個欄位。

- **理由**：目前有兩條軸（位置：statement/expression；容器種類：stack/queue/…）。**寫死兩個欄位的話，第三條軸來時要再改一次核心。** 而 P3 說「新增不得改變既有」。
- **但不過度設計**：驗收只要求兩條軸各驗一個案例。機制不假設只有二，但也不為想像中的第三條軸建抽象——**軸的解析器就是一張表，不是一個外掛系統**。

---

## 未解（不阻斷本功能）

- **`BlockSpecRegistry` 的 conceptId 索引零呼叫者**——本功能會讓它變成一對多，但它仍然沒有消費者。要不要刪掉是 E 項（登錄表與清單導出）的事。
- **`toolbox` 怎麼顯示兩個形態**——目前 `toolbox-categories.ts` 手寫，提到 44 顆元件。E 項會改成從登錄表導出，那時一起處理。本功能只保證兩個形態都**存在且可用**，不保證工具箱長怎樣。
