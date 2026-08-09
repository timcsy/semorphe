# Research：F 垂直切片的五個未知

每一條附查證位置。**沒有查證的一律標為未驗。**

---

## R1：lift 不是一個可以搬走的函式，是共用函式裡的**一筆資料**

### 查到什麼

`src/languages/cpp/core/lifters/strategies.ts:652-658`：

```ts
const containerConcepts: Record<string, string> = {
  'vector': 'cpp:vector_declare',
  'stack': 'cpp:stack_declare',
  'queue': 'cpp:queue_declare',
  'priority_queue': 'cpp:priority_queue_declare',
  'set': 'cpp:set_declare',
  'map': 'cpp:map_declare',
  'pair': 'cpp:pair_declare',
}
```

**七顆容器共用同一個 strategy 函式**，差別只有這張表的一列（`map` 另有一段分歧）。
而 `std/vector/lifters.ts` 是一個具名的空函式，註解寫著
「This module's concepts use pattern-based lifting」——**lift 那一路根本不在模組資料夾裡。**

### 決定：共用函式**塌成路由器**，映射資料由膠囊登錄

```
搬前：strategies.ts 內含 7 列硬編映射
搬後：strategies.ts 讀一份「容器樣板名 → conceptId」的登錄表
      components/cpp/vector_declare/  登錄 { template: 'vector' }
      其餘 6 顆暫時由一份「尚未膠囊化」的過渡表提供
```

**理由**：這個形狀專案做過兩次且都成功——P3「`io.ts` 塌成路由器」、
E 項「工具箱從手寫 80 筆改成 45 段有序來源」。而它剛好符合膠囊契約的判準：
碎裂的痛在「**碰幾個既有的共用檔**」，塌成路由器之後加一顆容器是**加一個膠囊**，
不是編輯 `strategies.ts`。

**否決的替代方案**

| 方案 | 為什麼不 |
|---|---|
| 把 strategy 拆成 7 個函式 | 要動 6 顆**不在本切片範圍內**的元件，違反「搬一顆＝一個可還原單位」 |
| lift 留在原地不搬 | SC-001（自己資料夾外 → 0）達不到，切片就沒有量到真正的成本 |
| 整個容器族一起搬 | 這就不是垂直切片了，成本量不出「一顆」的數字 |

⚠️ **這是本切片最大的卡點，也是它最有價值的產出**——`lift` 這一路在很多元件上
都不是「一個屬於我的函式」，而是「共用判別式裡的一列」。這個形狀會重複多少次，
要在切片結束時數出來。

---

## R2：膠囊必須帶得動 `header`，否則產生的碼會少 `#include`

### 查到什麼

`src/languages/cpp/std/index.ts:133-151`：

```ts
function makeModule(header: string, ...) {
  return {
    header,
    // ⚠️ 蓋 owner 章。工具箱靠它把 `<map>` 的容器與 `<stack>` 的容器分開——
    // 兩者的 `category` 都是 `'containers'`，而它們該去不同的工具箱分類。
    blocks: (blocks as BlockProjectionJSON[]).map((b) => ({ ...b, owner: header })),
```

`header` 有**兩個消費者**：`#include` 的依賴解析、工具箱分類。
它今天由**模組**提供，而膠囊化之後沒有模組了。

### 決定：`component.json` 帶一個 `requires` 槽，值是 `['<vector>']`

這不是新發明——膠囊契約的五槽本來就有 `requires`／`provides`。
本切片只實作它**被真的用到的那一面**（依賴解析 ＋ owner 章）。

⚠️ **不要從資料夾名推 header。** `components/cpp/vector_declare/` 推不出 `<vector>`，
而 `cpp:pair_declare` 的 header 是 `<utility>` 不是 `<pair>`——
**檔名長得像歸屬，但歸屬寫在宣告裡**（`experience.md`：「重構前先問這個東西屬於誰，
答案要從宣告來，不從檔案位置來」）。

---

## R3：標籤是每個語言一份扁平檔，動態載入

### 查到什麼

`src/i18n/loader.ts:47`：`const blocksModule = await import(\`./${localeId}/blocks.json\`)`

`src/i18n/{zh-TW,en}/blocks.json` 各一份扁平字典。`cpp:vector_declare` 佔 8 個鍵
（`CPP_VECTOR_DECLARE_MSG0`／`_TOOLTIP`／6 個型別選項），**兩檔共 16 筆**。
而這兩個檔裡**沒有任何 conceptId 字串**，所以就近性、中立性、語法耦合三條護欄都數不到。

### 決定：`components/cpp/vector_declare/labels/<locale>.json`，一個語言一個檔

**否決 `labels.json` 內含所有語言**（`{"MSG0": {"zh-TW": ..., "en": ...}}`）：
那樣「加一個語言」＝編輯全部 177 個既有檔。

膠囊契約 §二的判準直接給出答案：

> 差別是它長成 **N 個新檔、各在明顯位置**（可以看、可以刪、可以數），
> 還是 **N 次對既有共用檔的編輯**。

一個語言一個檔 → 加語言＝每個膠囊**新增**一個檔，零編輯。

**合併機制**：一支收集器把所有膠囊的 `labels/<locale>.json` 合成 loader 要的那份字典。
⚠️ 合併時**鍵撞了要爆，不得後者覆蓋前者**——靜默覆蓋會讓兩顆元件搶同一個標籤，
而症狀是「某顆積木顯示別人的字」，那是使用者看得到、護欄看不到的那一類。

---

## R4：宣告拆一顆出去之後，模組陣列怎麼辦

### 查到什麼

`std/vector/concepts.json` 是 **4 顆**的陣列（`vector_declare`／`vector_size`／
`vector_pop`／`vector_back`），由 `std/index.ts:157` 的
`makeModule('<vector>', vectorConcepts, vectorBlocks, ...)` 一次註冊。

### 決定：膠囊自我登錄，模組陣列少一筆——**不改載入架構**

```
std/vector/concepts.json   4 顆 → 3 顆
components/cpp/vector_declare/component.json   新增，自己登錄
```

**理由**：本切片要量的是「搬一顆的成本」。順手把 `std/index.ts` 改成「掃描膠囊」
會讓成本數字混進一次架構改動——那正是 `history/018` 記的「用宣告刷數字」的另一面。
**架構收斂等膠囊夠多再做。**

⚠️ **不得留下空陣列的殼**：若某個模組的元件被搬光，該模組要整個移除，
不是留一個 `[]`。本切片不會發生（還剩 3 顆），但要寫進 skill 的步驟。

---

## R5：兩條防線的具體形式，以及各自抓不到什麼

### 防線一：**集合比對**（抓「漏失」）

搬前搬後各錄一次：

- 系統認得的全部 `conceptId` 集合
- `cpp:vector_declare` 的五路可及性（各路是否註冊得到）
- 該元件的實際輸出（產生的碼、執行結果、來回轉換）

**它抓不到**：實作跑進**錯的**元件底下。前例（`specs/054`）——拆分工具用括號深度
找區塊邊界，字串裡的括號把計數弄歪，**兩筆註冊被併成一塊跑進錯的模組**，
而概念**還在**：集合完全相同，防線全綠。

### 防線二：**註冊來源**（抓「錯置」）

膠囊登錄時記下來源，護欄斷言：

```
註冊 cpp:vector_declare 的來源 === components/cpp/vector_declare
```

這同時是 FR-011（反方向護欄）的地基——「膠囊資料夾裡的東西都屬於這顆元件嗎」
問的就是同一份來源標記的反向。

**它抓不到**：來源標記本身被寫錯（有人複製膠囊時忘了改）。
→ 對策是讓來源**從路徑推導**而不是手寫，但那與「不從檔名推歸屬」（R2）張力，
所以要**兩者都有並互相核對**：路徑推導的來源 vs 宣告裡的 `componentId`，不一致就紅。

⚠️ **這兩條的分工要寫進交付**（FR-009）。`experience.md` 的原話：
「**沒說出來的話，全綠會被讀成『都對了』。**」

---

## R6：新護欄的維度，以及怎麼不讓它污染 F 的成績

### 查到什麼

`tests/integration/audit-locality.test.ts:56`：`if (classifyFile(file) !== '實作') continue`

現行就近性**只算「實作」類**。而 `concepts.json`／`blocks.json` 被分類為「宣告」，
標籤檔不在任何分類裡——**碎裂的最大來源正好在維度外**。

### 決定：新開一條護欄，不改舊的

| | 現行就近性 | 新的「膠囊就近性」 |
|---|---|---|
| 算什麼 | 只算「實作」類 | 宣告 ＋ 實作 ＋ 標籤 |
| 量什麼 | 散在幾個檔 | **自己資料夾以外**幾個檔 |
| 基線 | 3.46（177 顆） | 待第一次跑（**必須是紅的**） |

**不動舊護欄**的理由：兩個維度混進同一個數字，F 收工時的漲幅會分不出
「實作真的變集中」與「換了一個維度」。`history/018` 的直接處方。

---

## 未驗的一項

**兄弟元件之間有沒有隱含依賴。** `vector_size`／`vector_pop`／`vector_back` 的
執行器讀 `node.properties.obj`，看起來不共用執行期狀態；但**沒有實測**。
→ 進 tasks：搬完之後跑一次同時用到四顆的程式，比對輸出。
