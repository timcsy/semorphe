# 概念探索：C++ — 寫入 ostream 參數

## 摘要
- 語言：C++
- 目標：`os << a << b;`，`os` 是宣告為 `ostream`／`ostream&` 的參數或區域變數
- 發現概念總數：1（語言特定）
- 建議歸屬：與 `cpp:friend_function` 同一層（cpp-beginner／cpp-advanced／arduino 三份課程清單）

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 降級路徑 | 備註 |
|---|---|---|---|---|---|
| `cpp:stream_write` | `os << a << b;` | 把值依序寫到串流 `os` | 串流名稱（文字）＋可增減的值 | `raw_code`（今天落在 `<<` 位移運算） | 對應 Cella `sOut { n, stream, items }`，`cout` 仍走 `cpp:print` |

## 為什麼不是位移也不是 print
- `os << a.x` 今天 lift 成算術 `<<`，積木寫「位移」，對學生是錯的（Sc2），送給 Cella 會變成 `operator<<` 找不到或遞迴。
- `cpp:print` 的語義是標準輸出，沒有「寫到哪」這個接點，而 `os` 是參數，由呼叫端決定。

## 判別（區別於自訂類別的 `Log& operator<<`）
只認：最左端是識別字，且該識別字在所在函式的參數或前面的區域宣告中，型別寫作 `ostream`、`ostream&`、`std::ostream`、`std::ostream&`。其他一律維持原本的 `<<`。

## 依賴
- 型別表 `ostream → tOstream`（`src/providers/cella/formalize/index.ts`）
- `cpp:func_def`、`cpp:friend_function` 的參數型別字串已能存 `ostream&`

## 需注意的邊界案例
- `return os << x;`：運算式位置，Cella 的 `sOut` 是敘述。formalize 照實 unknown，不送位移，否則誤判 reject。
- `endl`、`setw` 這類操控子在串流上：`endl` 比照 `cpp:print`（`eEndl`）。
- 串流不是識別字（`*out`、`obj.os`）：不認，留在範圍外。
- `cerr`／`clog`：不在這顆，宣告才算。
- 帶本體的 friend：另一刀。

## 跨語言對應
Python 的 `print(x, file=f)` 語義相近，今天沒有對應元件，不做等價邊。

## 研究來源
語言事實取自 C++ 標準 [ostream.inserters]；未另做網路搜尋（範圍已定，探索從簡）。實測來源：`tests/fixtures/fuzz-cpp-friend.json` 的 fuzz_2。
