# Phase 0 研究：那 58 個執行器該搬到哪

**日期**：2026-08-06 ｜ **方法**：用概念註冊表決定歸屬，不用檔名猜

---

## F1：歸屬由 `concepts.json` 決定，不由執行器檔名決定

執行器檔案是**按實作方便**分的（`strings.ts`、`containers.ts`），概念的**歸屬**則寫在各模組的 `concepts.json` 裡。兩者不一致。

用註冊表比對之後：

| 執行器檔 | 概念數 | 實際歸屬 |
|---|---|---|
| `strings.ts` | 27 | `std/string` **17** ＋ `std/cstring` **10** |
| `containers.ts` | 20 | `std/vector` 4、`std/queue` 3、`std/map` 2、`std/set` 2、`std/stack` 2 ＋ **語言核心 7** |
| `pointers.ts` | 8 | 語言核心 8 |
| `cmath.ts` | 3 | `std/cmath` 3 |

**兩份跨模組，不是一份。** spec 寫的是「`strings.ts` → `std/string/executors.ts`」——**那是錯的**，它跨兩個標準函式庫模組。FR-003（涵蓋多模組者必須拆開）本來就涵蓋這種情況，只是適用範圍比 spec 想的大一倍。

> **用檔名推歸屬會錯。** 檔名反映的是誰跟誰寫在一起比較方便，不是誰屬於誰。

---

## F2：七個跨容器的泛用操作屬於語言核心

`cpp_container_empty` / `push` / `pop` / `clear` / `push_back` / `erase` / `count` 這七個**不在任何 `std/*/concepts.json` 裡**。

查證：它們宣告在 `src/languages/cpp/core/concepts.json`，`layer: lang-core`，而且**它們的 generator 早就在 `core/generators/statements.ts`**。

所以它們的執行器歸語言核心，與 generator 同一層——這不是「找不到家所以丟核心」，是**它們的家本來就在核心**，只有執行那一路走丟了。

FR-004 正好接住這種情況。

---

## F3：最終落點（58 個，一個不漏）

```
std/string    17      std/cstring   10      std/cmath      3
std/vector     4      std/queue      3      std/map        2
std/set        2      std/stack      2
語言核心      15      （指標 8 ＋ 跨容器泛用操作 7）
                                            ───────────────
                                            合計          58
```

---

## F4：模組型別要加的那一欄

```ts
export interface StdModule {
  header: string
  concepts: ConceptDefJSON[]
  blocks: BlockProjectionJSON[]
  registerGenerators: (g, style) => void
  registerLifters: (lifter) => void
  registerExecutors: (register) => void   // ← 新增，與前兩者同形
}
```

**同形是重點**：既有兩條路已經是「模組提供一個註冊函式，載入時被呼叫」。第三條照辦，不發明新形狀。

`registerExecutors` **設為必填**，不是選填。選填的話，忘記接上的模組會靜靜地少一條路——那正是這個專案反覆遇到的病。編譯器擋得住的東西不要留給人。

---

## F5：漏失的主防線——集合比對，不是輸出比對

搬移最可能的錯是**某個概念的執行器掉了**，而測試剛好沒覆蓋它。

| 防線 | 漏一個會怎樣 |
|---|---|
| 逐一比對輸出 | **不會現形**（測試沒覆蓋到就過了） |
| **比對「執行引擎認得哪些概念」的集合** | **現形**，而且說得出少了哪一個 |

所以主防線是集合比對。做法：搬移**之前**把當前集合寫成一份固定清單，搬移後斷言相同。

這與既有教訓同一招——**換一個讓錯誤無法被表達的形式**。

---

## F6：影響範圍已量過

建立執行引擎**卻沒載入語言套件**的測試檔：**3 個**（`execution-cpp-containers`、`skip-declaration-gate`、`audit-executor-duplicates`）。

上一輪同類改動一次讓 144 個測試變紅，因為當時多數測試都沒載入。那一輪已經替它們補上，所以這次的面積小得多。

**但錯誤訊息仍然只說「未知概念」**——看不出真正原因是沒載入。US3 要修的是這個。

---

## 自我否證：這份研究若在什麼情況下是錯的

- **F1／F2 的歸屬靠 `concepts.json`**。若某個概念在多個模組的 `concepts.json` 裡重複宣告，這份對照表會給出任意一個答案。**實作第一步要先驗證「每個概念只屬於一個模組」**，驗不過的話 F3 的落點表要重來。
- **F3 的 58 個是從註冊呼叫數來的**。若某份執行器用迴圈或表格批次註冊（不是逐行 `register('x', ...)`），正規表示式會漏掉。**集合比對（F5）會抓到這種漏失**——那正是它當主防線的理由。
