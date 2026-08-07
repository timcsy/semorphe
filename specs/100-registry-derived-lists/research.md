# Phase 0 研究：登錄表導出

## 決定 1：先量「拿不到的有幾顆」——答案是 4 顆真的，其中 3 顆是這個 session 加的

### 發現

寫了一支臨時掃描（列出所有積木型別，比對工具箱經 `registryCategories` ＋ `extraTypes` 能拿到的集合）：

```
積木總數 183｜工具箱可拿到 180｜拿不到 6
  c_container_push                  ← 中性形態，**刻意的**（097）
  c_container_pop                   ← 中性形態，**刻意的**（097）
  cpp_string_find_first_not_of      ← 093 加的，忘了工具箱
  cpp_string_find_last_not_of       ← 093 加的，忘了工具箱
  c_map_assign                      ← 098（本 session）加的，忘了工具箱
  cpp_istringstream_declare         ← 095（本 session）加的，忘了工具箱
```

**4 顆是真的拿不到，而 3 顆是我在這個 session 加的。**

### 這就是這個功能的全部理由

095 加 `istringstream` 時：五路齊備、全套綠、十七條護欄零上升、寫了規格、做了反流。
**而使用者拿不到它。** 沒有任何檢查在看這件事。

098 加 `cpp_map_assign` 時，我甚至剛寫完「機制做對了，而使用者拿不到它」那條教訓——**然後又犯了一次**。

> 一條教訓寫進知識庫，不會讓下一次不發生。**只有機械檢查會。**

### 決定

**護欄先做，導出後做。** 順序刻意反過來：

1. 先蓋「每顆積木都拿得到」的護欄 → **立刻紅 4 筆**
2. 補那 4 筆 → 綠
3. 再把 `extraTypes` 換成導出 → 護欄保證等價

**理由**：先導出的話，那 4 筆會被導出「順便」修掉，而**我們永遠不會知道它們曾經存在**。護欄先做，那 4 筆會被指名。

---

## 決定 2：`extraTypes` 有 80 筆，但**不是全部都該消掉**

### 發現

```
data 5｜operators 8｜control 8｜functions 6｜io 10
text 22｜maps_sets 8｜stacks_queues 11｜pointers_memory 2     總計 80
```

而 `ExtraBlockDef` **不只是字串**：

```ts
{ type: 'u_if' },
{ type: 'u_if', extraState: { hasElse: true } },          // if-else
{ type: 'u_if', extraState: { elseifCount: 1, hasElse: true } },  // if-elseif-else
```

**同一顆積木用不同的初始狀態出現三次**——那是**教學設計**（讓學生直接拖到「有 else 的 if」），不是登錄表推得出來的。

（順帶：這也是我的掃描腳本報「3 個幽靈型別 `[object Object]`」的原因——它把物件當字串了。**掃描工具第一版又量錯了一次**，而這次是我在同一支腳本裡同時做對了另一半。）

### 決定

`extraTypes` 分成兩類，**只消掉第一類**：

| | | 處置 |
|---|---|---|
| **純字串**（`'cpp_abs'`） | 「這顆積木屬於這個分類」——**登錄表知道** | **消掉**，改導出 |
| **帶 `extraState`**（`{ type: 'u_if', extraState: {…} }`） | 「這個預設狀態值得單獨給一個入口」——**教學設計** | **保留** |

判準與課程清單同一條：**登錄表知道的導出，人決定的留著。**

---

## 決定 3：分類歸屬用積木 JSON 的 `category` 欄位——它已經在了

### 發現

`ToolboxCategoryDef.registryCategories` 已經在做導出（`'data'`／`'operators'`／…），拉的是 `BlockSpec.category`。而 `maps_sets` 與 `stacks_queues` 兩個分類的 `registryCategories` 是**空的**——它們完全靠 `extraTypes`。

而積木 JSON 裡那些元件的 `category` 是 `'containers'`——**一個分類對到兩個工具箱分類**（映射與堆疊佇列都是容器）。

### 決定

**不改積木 JSON 的 `category`。** 改為讓 `registryCategories` 支援更細的比對——但**細分規則本身是宣告的資料**，不是程式碼裡的 switch。

- **理由**：改 `category` 會動 183 顆積木的宣告，而那個欄位還有別的消費者。而「映射與堆疊該分兩個工具箱分類」是**教學設計**，本來就該是宣告。
- **替代方案（已否決）**：
  - **在工具箱建構器裡寫 `if (conceptId.startsWith('cpp_map'))`** — 那是把元件身分寫進呈現層，中立性護欄會叫。
  - **每顆積木加一個 `toolboxCategory` 欄位** — 與 `category` 雙重真相；而且加一顆元件時要填兩個分類欄位，違反 FR-003 的精神。

---

## 決定 4：課程清單**不導出**——只補兩道檢查

### 發現

`cpp-beginner.json` 的 `levelTree`：

```
L0: 基礎          concepts: 19
  L1a: 函式與迴圈   concepts: 20
    L2a: 陣列與字串  concepts: 33
      L3a: STL 容器   concepts: 25
```

**那是一條教學漸進線。** 「`vector` 屬於 L3a 而不是 L0」導不出來。

### 決定

成員保留，補兩道檢查（FR-007／FR-008）：

- **引用不存在的元件 → 紅**（清單爛掉了）
- **未被任何課程收錄 → 報出，不算違規**（沒收錄是策展決定）

第二條刻意**不是違規**：把它做成違規會逼出「為了讓護欄綠而亂塞課程」——那比不收錄更糟。

---

## 決定 5：就近性把「清單」與「實作」分開計

### 發現

就近性護欄目前把 `topics/*.json` 算成元件的實作擴散（前兩大共用檔，166／164 顆）。**課程清單不是實作。**

而**這個分類我已經寫過一次**——`audit-component-identity-review.test.ts` 為了同一個理由把檔案分成宣告／清單/實作/清冊四類。

### 決定

**把那份分類抽出來共用**，不要在第二條護欄裡再寫一次。

- **理由**：兩條護欄各寫一份分類規則，就是兩份會漂移的真相——而這正是本專案的頭號病。
- ⚠️ **這不是「為了讓數字好看而改量測」**：判準是可機械檢查的（FR-010），而且**改完之後就近性的數字會下降**，所以要**同時說明下降的原因**，並在基線註記——`history/018` 的直接處方。

---

## 未解（不阻斷）

- **`buildContents` 自訂建構器**（`ToolboxCategoryDef` 的可選欄位）目前有沒有人用、用在哪——本功能只保證它的輸出不變，不重構它。
- **圖鑑**：`元件.md` 說 toolbox 與 ArduinoCAD 的 codex 是同一個東西。本功能讓 toolbox 變成導出的，圖鑑因此變便宜——但做圖鑑是硬體域併入時的事。
