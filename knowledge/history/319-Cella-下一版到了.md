# 319 · Cella 下一版到了——階段 4 與 5 收尾，而最後兩筆 reject 是 Cella 那側的

> 日期：2026-11-01（spec 194）
> 轉變：cella-lang 0.1.202610312349 帶來我們等的三樣：容器函式庫（照 libc++ 18）、`tAuto`、除錯的 `coverage()`（`stopVisits`）。
> ⚠️ 這一版其實 10-31 23:51 就發了；我早上用 `npm view` 查到的還是舊版（快取），是使用者提醒的。

## 怎麼對齊形狀：照 Cella 自己用 clang 轉的同一批課文

cella 那側已經把我們卡住的 10 份課文用 `cpp_to_tree.py`（clang 的 AST）轉成程式樹（`packages/cpp/tools/lessons`）。
那就是參考答案：容器型別一律 `tTemplate`、名字不帶 `std::`、`map[k]` 是 `eIndex`、`.first` 是 `eMember`、`make_pair` 是 `eCall`。

## 量到的

```
判決綁定語料   翻得出 99 → 109 / 109       ← 階段 4 的驗收
Cella 判決     accept 106（輸出與課文全部一致）｜reject 3
```

## 三筆 reject，兩種原因——先證明是誰的，再決定改哪邊

1. **我們的**（修了）：容器宣告送 `sDecl` 而 `init: null`，Cella 讀成「未初始化」。參考樹是 `sDeclC … []`（預設建構）。`vector` 一直沒事，是因為它有專用的 `tVector`。
2. **Cella 的**（回報了）：修完 1 仍 reject。拿參考 JSON 逐項換成我們的寫法對分——字串型別、`eTemp`、`sOut`、`#include` 都不是；
   **只把宣告的 `x` 換成與節點標籤 `n` 不同的字串，就 accept**。
   ⚠️ 我回報時猜是「預設建構（`sDeclC`）那條路」——**猜錯了**。cella 再對分一次：只讓 set 的宣告 n＝x 是 accept，**只讓範圍 for 的元素 n＝x 才重現**。
   根因是 Cella 展開範圍 for 時，合成的 `begin()`／`*it` 借用了範圍 for 自己的節點標籤，結果存在以那個標籤命名的暫時變數裡——與元素變數撞名，元素被暫時物件蓋掉。
   修法在 Cella 那側（合成的運算式改用 `<節點>:begin`、`:element`…）；我們這側的影響是 `ownerOf` 多認 `:` 後綴。
   > 我的對分只換了**宣告**那一格就停了（「換它就好」），沒有再分「是哪一個宣告」——cella 分到了。
3. **判得對的**：`12-猜數字/make2.cpp` 課文沒給測資，`cin >> guess` 在 EOF 不寫入、接著讀 `guess` 是未定義行為。

> 對分之前我一度想在我們這側把宣告標籤全改掉——那會讓判決綁定語料的格式跟著變，而那是兩邊對齊過的東西。先問 cella 是誰該改。

## 同一刀帶走的

- 覆蓋：`coverage()` 接上，階段 5 剩下的那一項完成（會話契約多一條，兩個提供者都過）。
- 「依 …」小標：擔保者不再一律是 libc++（`glibc` 的亂數、`執行環境` 的時鐘）。
- C／C++ 沒宣告的名字送 `eConst`（`INT_MAX`……）——cella 早上問的那件，答應的那一行。

## 前情：階段 4 的前兩批（2026-11-01 knowie-judge 從 vision 收進來）

vision〈重構〉階段 4 原本逐批記著交付，收斂成一行時原文搬到這裡：

- 第一批（2026-10-31）：作用域走訪（852 個參照 0 落空）、課文解答 84 / 94、Arduino sketch 10 / 10、C 分支、空槽變洞、判決綁定語料第一版交出；
  剩下的 10 份卡在 Cella 還沒建模的函式庫（pair、queue、set、map、stack、priority_queue）——已給 Cella 清單，Cella 已開工（下一版帶 `tAuto`）。
- 第二批（第 389–391 刀）：formalize 搬進膠囊、判決綁定語料 109 筆／附 program 99 筆，cella 用 clang 比兩棵樹 95/95 相同；Arduino 15/15。
