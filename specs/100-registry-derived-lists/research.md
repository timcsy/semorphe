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

---

## ⚠️ 更正（規劃階段第二次實測）：拿不到的是 **10 顆，7 顆是真的**

決定 1 的數字是**低估的**。那一版掃描只餵了單一 topic 的 `visibleConcepts`，
被課程可見度擋掉的積木沒被數到。改用**全部概念可見**重測：

```
積木 183｜可拿到 173｜拿不到 10
  cpp_getline                    ← 忘了工具箱（**新發現**）
  cpp_string_find_first_not_of   ← 093 加的，忘了
  cpp_string_find_last_not_of    ← 093 加的，忘了
  c_map_assign                   ← 098（本 session）加的，忘了
  cpp_istringstream_declare      ← 095（本 session）加的，忘了
  cpp_ifstream_declare           ← 忘了（**新發現**）
  cpp_ofstream_declare           ← 忘了（**新發現**）
  ─────────────────────────────
  c_container_push               ← 中性形態，刻意（097）
  c_container_pop                ← 中性形態，刻意（097）
  u_if_else                      ← 在 excludeTypes 裡，刻意（被三個 u_if 變體取代）
```

**`<fstream>` 整個模組使用者拿不到**——兩顆積木，五路齊備，零入口。

### 這是**量測工具第一版又量錯了一次**（第 13 次）

而抓到它的方式與第 12 次相同：**新掃描的結果與既有的實測互相矛盾**
（一支只讀 `extraTypes` 的正則掃描報 25 顆拿不到，與決定 1 的 6 顆對不上），
於是兩支都重做。

> 護欄的價值不在它第一次給的數字，在**它與別的量測對不上的時候**。

## ⚠️ 決定 3 作廢（superseded）：「讓 `registryCategories` 支援更細的比對」是**做不到的**

決定 3 說要「讓 `registryCategories` 支援更細的比對，而細分規則本身是宣告的資料」。
**量了之後那句話沒有指涉物。**

`containers` 這個 `category` 底下有 **49 顆積木**，手工散進**四個**工具箱分類
（陣列與列表／文字／對應與集合／堆疊與佇列）。而那 49 顆積木身上，
**除了 conceptId 之外沒有任何欄位分得開它們**——

而「用 conceptId 前綴比對」正是決定 3 自己否決的做法（把元件身分寫進呈現層）。

> 一個沒有指涉物的設計，讀起來與一個有指涉物的完全一樣。**只有去實作它才會發現。**

### 取而代之：模組**就是**那個宣告

`src/languages/cpp/std/` 底下已經是**一個模組一個資料夾**：`stack/`、`map/`、
`vector/`、`string/`……而 `StdModule` 已經有 `header`。實測每個模組的積木落點：

```
純的（13/17）  algorithm cctype cmath cstdio map numeric queue set
               sstream stack string utility vector
散的（2/17）   cstdlib → 運算(3) 控制(1) 文字(2)
               cstring → 文字(10) 指標與記憶體(2)
空／全缺（2）  iostream(0 顆)  fstream(2 顆全部拿不到)
```

**13 個模組是純的。** 那 13 個各宣告一次，就取代掉 55 筆手寫積木型別。

而 `cstdlib` 散成三路是**真的**：`abs` 是運算、`exit` 是控制、`atoi` 是文字
——那是三個不同的教學意圖，本來就該逐顆宣告。

### 決定

**積木的工具箱分類 = 積木自己宣告 → 沒宣告就用它所屬模組的宣告 → 再沒有就用 `category`。**

| | 要編輯什麼 | 合不合 FR-003 |
|---|---|---|
| 往既有模組加一顆積木 | **零** | ✅ |
| 加一個新模組 | 模組**自己的**宣告一欄 | ✅（不是編輯清單） |
| 一顆積木要跟模組不同家 | **那顆積木自己的**宣告一欄 | ✅ |

核心與通用積木不走這條——它們的 `category`（`data`／`operators`／…）
已經被 `registryCategories` 導出，而且已經是對的。**不動它。**

- **替代方案（已否決）**：**改積木 JSON 的 `category` 讓它更細**——那個欄位
  還有別的消費者，而且會把「這顆屬於 containers」（登錄表知道的）和
  「這顆該放在堆疊與佇列」（教學決定的）壓成同一個欄位。**兩種真相不該同名。**
