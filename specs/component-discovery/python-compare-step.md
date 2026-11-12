# 概念探索：Python — 三段以上的比較鏈（compare_step）

## 摘要
- 語言：Python
- 目標：比較鏈（`a < b < c < d`、`0 < x < 20 != 21`）——Python 語言參考 6.10「Comparisons」：`a op1 b op2 c ... y opN z` 等於 `a op1 b and b op2 c and ... y opN z`，中間每一項只算一次。
- 發現概念總數：1（語言特定：`python:compare_step`）；另修改 1 顆既有元件（`python:compare_chain`）
- 建議歸屬：`python-beginner.json` 中 `python:compare_chain` 所在的同一節點（運算）

## 現況（2026-11-12 量）
- `python:compare_chain` 只收兩個運算子（積木上 A／OP／B／OP2／C）；三段以上 lift 時**主動變灰**（`buildRawExpression`），理由是同族一般比較會安靜地砍掉後半段。
- Cella：`eCompare { left, ops[], comparators[] }`——本來就收任意長；`formalize.json` 寫死兩個。
- 來源：盲測第二批 fuzz_5 的 `0 < x < 20 != 21`（照實保留）。

## 概念目錄

### 運算（與 compare_chain 同一節點）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `python:compare_step` | 鏈裡第三段起的 `op z` | 「然後再比：op z」——鏈上的下一段 | 運算子下拉＋一格值 | lang-core | 特定 | raw_expression（整條鏈一起降級） | 只活在比較鏈的 `more` 插槽裡（`insideParentOnly`），不單獨 lift |

`python:compare_chain` 的改動：加可增減的尾巴 `STEP{i}`（`builder: variadic`、`attachVariadic`、最少 0 格、`slotCheck: CompareStep`、`childSlot: more`）；
兩個下拉與 A／B／C 三格不動 ⟹ **存檔格式不變**（沒有 extraState 的舊檔載入時 0 格）。

## 設計取捨
- ❌ 把整條鏈改成「可增減的運算子＋值」：要動既有的存檔格式（需遷移），而且最常見的兩段（`0 ≤ x ≤ 100`）會變難用。
- ❌ 運算子存成字串清單屬性：需要 parse 回結構的字串不該是字串（experience）。
- ✅ 一段一顆 `compare_step`：結構化（運算子是屬性、值是接點），積木上讀起來是原始碼裡就有的那一段（Sc2）。

## 依賴關係
`compare_step` ← `compare_chain`（父）。

## 建議實作順序
1. `python:compare_step` 膠囊（render／extract／generate；lift 為 null 由父產生；formalize 由父的具名轉換處理）
2. `compare_chain`：lift 收三段以上、generate 接尾巴、formalize 改用具名轉換、積木加尾巴

## 跨語言對應
C++ 沒有（`0 < x < 10` 在 C++ 是 `(0<x) < 10`），不建等價邊。

## 邊界案例
- 混 `in`／`is`／`not in` 的鏈（`a < b in c`）：`ROUTED` 外的運算子 → 照舊不歸這顆（降級）。
- 任一段認不出來 → 整條降級，不收一半。
- 優先序：每一段的值與 `middle`／`right` 同（`prec + 1`）。
