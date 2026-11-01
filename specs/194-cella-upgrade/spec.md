# Spec 194：升級 Cella 到 0.1.202610312349——容器、`tAuto`、覆蓋、巨集常數

**路線圖**：vision〈重構〉階段 4 的最後 10 份課文、階段 5 剩下的覆蓋標記（兩者都在等 cella 這一版）。
**版本**：`cella-lang` 0.1.202610312349；`@cella-lang/c` …2350、`cpp`／`arduino` …2349。對我們有影響的不相容改動在 0706 就已跟上（三個分支的入口、`stopKind`）。

## 需求

- **FR-001** 型別：`auto` → `tAuto`；標準類別範本（`pair`／`queue`／`stack`／`priority_queue`／`set`／`map`／`deque`／`greater`／`less`）→ `tTemplate`，
  名字不帶 `std::`、引數依最外層逗號切開（形狀照 Cella 用 clang 轉的課文樹 `packages/cpp/tools/lessons`）。
- **FR-002** 12 顆元件的 formalize：`map／set／stack／queue／priority_queue` 的宣告（沒有初始值＝**預設建構** `sDeclC … []`，不是 `init: null`）、
  `map[k] = v`、`map[k]`、`front()`、`top()`、`make_pair`、`lower_bound`／`upper_bound`。`unordered_map`／`multimap`／`multiset` 照實標 unknown。
- **FR-003** 覆蓋：除錯模組匯出 `stopVisits`，`cella-lang/dap` 的 `coverage()` 隨每個結果回來；標籤收回成語義樹的 id（同一個節點的幾個標籤取最大值，不加總）。
- **FR-004** 「依 …」小標：擔保者照判決說的（`glibc`、`environment` → 執行環境）；新的三種選擇（`rand.sequence`、`time.now`、`sort.order`）有中文說明。
- **FR-005** C／C++ 目標下沒宣告的名字送 `eConst`（`INT_MAX`、`RAND_MAX`…），存不存在由 Cella 依標頭判（cella 2026-11-01 問到、我們答應的那一行）。

## 驗收

- 判決綁定語料 109／109 翻得出（原 99）；Cella 判決 accept 106、輸出與課文全部一致。
- reject 3：`04-set與map` 兩筆是 Cella 的缺陷（範圍 for 的元素宣告標籤 `n` ＝ `x` 時，Cella 合成的 `*it` 暫時物件與它撞名；換標籤即 accept）——cella 修在他們那側；
  我們這側：`ownerOf` 多認 `:` 後綴（範圍 for 合成的 `:begin`、`:element`…對回範圍 for 本身）；
  `12-猜數字/make2.cpp` 沒有測資，`cin >> guess` 在 EOF 不寫入、接著讀 `guess` 是未定義行為——判得對。
- 會話契約多一條覆蓋（兩個提供者都過：迴圈 4 圈記 4 次）。
