# 339 · printf／scanf 照 Cella 給的型別產——推不出的那一行保留 cout

> 日期：2026-11-05
> 轉變：換成 printf 風格時，格式不再一律 `%d`，而是照判決提供者給的**型別**（Cella 的 `types().nodes`）產；推不出的那一行保留 `cout`／`cin` 並註明。
> 決定：使用者 2026-11-04 定 **A**（經 cos-mos 主持人轉問；[printf draft](../draft/2026-11-04-printf產碼的型別表.md)）；型別從 Cella 來而不在 semorphe 另長一套（[經過 Cella 的 draft](../draft/2026-11-04-風格與跨語言轉換經過Cella.md)，使用者同意寫成 draft 並問 cella）。
> 做法：spec 215（`specs/215-printf-types/`），第 265 刀。缺陷帳 2026-09-20 那一根（`%d` 一律）在這一刀拔掉。

## 為什麼型別從 Cella 來

型別是**意思**，不是形式。在 semorphe 寫一套型別推斷等於造第二個真相來源（宣告、名字解析、提升規則都要再寫一次），遲早與 Cella 的判斷分歧。
問 cella 才知道介面早就有了：`types(program, [])` 回每個運算式在隱含轉換**之前**的型別，以我們送的節點 id 為鍵，程式寫到一半也給——而產品每次檢查本來就拿到這一份（語意診斷在用）。

## 做了什麼

- 核心只傳遞：`GeneratorContext.expressionTypes`（節點 id → 型別字串）、`root`；「產碼自己加的註明」登記處（讀回來時拿掉——不然型別到了、換成 printf 之後，「保留 cout」還掛在那一行上）。
- C++ 的型別表（`languages/cpp/printf-types.ts`）：`%c`、`%g`（**不是 `%f`**：`cout << 1.5` 印 `1.5`）、`%lld`、`%s` ＋ `.c_str()`、`%zu`／`%lu`；scanf 的 `%lf`、`" %c"`；`std::string` 讀不進 → 保留 cin。
- 形式上保守（cella 同意：精確的要靠執行）：程式改過串流格式（`fixed`／`setprecision`…，性狀 `changesStreamFormat`）→ 含運算式的輸出保留 cout；`sync_with_stdio(false)`（性狀 `unsyncsStdio`）→ 全換或全不換。
- 產品：記下判決帶回的型別；從積木抽回的樹每次是新 id，**照形狀**對過去（`carryTypes`）——形狀不同就不給（學生把 `int x` 改成 `double x` 時，引用 x 的那顆積木沒變而型別已過期），保留 cout，新型別來了再補產；上一步在程式碼那側時不補產（會蓋掉他打的字）。

## 量到的

| | 之前 | 之後 |
|---|---|---|
| 課文 109 支切成 printf：判決與輸出相同 | 不同 10 支（另 7 支是 Cella 的中文，264 修好） | **全部相同** |
| 學生語料 210 支 | 不同 58 支（第一輪） | **不同 6 支**——全是 Cella 那側的兩個缺口 |

學生語料第一輪量到、這一刀修掉的（都在我們這側）：
- 🔴 `io_sync` 的 formalize：只要用了 printf 就標翻不出——全部換成 printf 之後同步已無關，40 支因此翻不出。改成「**混用**才標」。
- 🔴 scanf 讀回 `&d1[i].x`：把原文當成一個**名字**（`var_ref "d1[i].x"`），Cella 判不是左值——學生原本手寫的 scanf 就會踩到。改成照一般的運算式讀回。
- 🔴 逗號運算式裡的 cout（`cout << "New! ", n = ++id;`）：保留時加的行末註明**吃掉了同一行後面的運算式**。運算式位置不加註明。
- `cpp:string_as_cstring`（`.c_str()`）補 formalize；scanf 的運算式形態（`eCall scanf`）補 formalize。

Cella 那側（回報，cella 確認會修；測試以 `knownCellaGap` 釘住，修好會紅）：`v.size()` 的型別被接收者的 this 蓋掉（我們保守地保留 cout）、`scanf(" %c")` 沒有跳過空白（讀到 `\0` 而判 accept——排第一修）、scanf 當運算式還不支援。

## 學到的

- 一個「保守」的設計要在**被餵錯資料**的時候被看見：Cella 把 `size()` 標成指標型別，型別表查不到 → 保留 cout，沒有產出錯的格式。若表收「什麼都當 `%d`」的退路，那一次就會靜靜地寫錯。
- 註明是產碼加的，就要讓產碼收得回來——不然它會比它要說明的那件事活得更久。
