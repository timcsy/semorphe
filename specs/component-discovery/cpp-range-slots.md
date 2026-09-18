# 概念探索：C++ — 範圍那一族（`begin`／`end` 從字串屬性換成接點）

- 語言：cpp
- 目標：`src/components/cpp/range_*`（11 顆）＋ 兩顆新身分
- 日期：2026-09-18
- 分支：`188-cpp-range-slots`

## 摘要

**這一關不是「要不要做」，是「怎麼切」**——被改的那個檔自己寫著要做：

> `src/languages/cpp/lang/runtime/range.ts` 檔頭：「⚠️ **技術債**：範圍本來就該是
> 結構化的（`{ array, from, to }`）……**這裡先解析，型別結構化另外排。**」

而**最大的發現是：結構已經在了，只是沒有人接上去。**

| 讀數 | 值 |
|---|---|
| 這一族的膠囊 | 11 顆（`range_remap` 已全接點，不動） |
| 要退場的字串屬性 | **13 個**（第七十二條「要看」39 之中） |
| 語料正在失敗 | **4 支** |
| 新身分 | **2 顆**（`cpp:range_unique`／`cpp:range_remove`）——**釘子指名的那兩顆** |
| 要拔的釘子 | **1 根**（`fuzz-cpp-containers-2.test.ts:194`） |

---

## 六個設計問題——**每一題都有出處**

### ① 範圍的兩端在執行期是什麼

🔴 **答案：它已經是位置了，而且連退化都不用做。**

`src/interpreter/pointer.ts:40` 的 `isCellPointer` 全文只有一行判準，而它的註解逐字：

> 「⚠️ 判準是 `type === 'array'` ＋ `value` 真的是一串格子。
> **容器本身也長這樣，而那是對的**：`v` 退化成指標時就是「指著第 0 格」。」

所以三個子問題的答案是：

| 子問題 | 查到的答案 | 出處 |
|---|---|---|
| 裸陣列名求值出來是什麼 | `ctx.scope.get(name)` ＝ `{type:'array', value: cells}`，**`offset` 未定義＝第 0 格** | `src/components/cpp/var_ref/execute.ts` |
| `A+n` 今天由誰做 | **`cpp:arithmetic`**：左邊是一串格子、右邊不是 → `positionIn(cells, offsetOf(left)±step)` | `src/components/cpp/arithmetic/execute.ts:56-60` |
| 陣列退化成指標做不做 | **不用做**——容器與位置在這個直譯器裡是**同一個形狀**，差別只在有沒有 `offset` | 同 `pointer.ts:40` 的註解 |

> **`resolveRange` 那個 regex 解析的東西，執行期早就會算了
> ——它不是在補一個缺口，它是在【繞過】一個已經存在的機制。**

🟢 **所以 execute 那一路是【變短】不是變長**：

```ts
const b = await ctx.evaluate(beginNode)      // 位置
const e = await ctx.evaluate(endNode)        // 位置
if (!sameCells(b, e)) throw …「範圍跨越兩個容器」
return { cells: b.value, from: offsetOf(b), to: offsetOf(e) }
```

`sort(A, A+n)` 那 33 處走的是：`A` → 容器（offset 0）· `A+n` → `cpp:arithmetic` 的位置分支。
**兩條路都已經在跑了**，今天只是被 `.text` 攔在 lift 那一層。

### ② `begin(x)`／`end(x)` 是新身分嗎

**答案：不是新身分，是 `cpp:container_iter` 的另一種【呼叫形式】，而形式要記在屬性上。**

出處兩條：

1. `knowledge/history` 的 B 項結論逐字：「**位置不是身分，是形態**」
   ——`v.begin()` 與 `begin(v)` 做的是**同一件事**（給出容器的起點），
   接點結構也**一樣**：都是「一個容器 ＋ 哪一端」。`cpp:container_iter` 今天的宣告正是
   `properties: [which]` ＋ `slots: { obj: expression }`（`component.json`），一格不多一格不少。
2. `component-generate` 的「形式不是身分，是參數」那張表——與 `cpp:var_declare_sequence`
   把 `auto` ／ `auto&` 收進 `binding` 屬性同一個做法。

🔴 **而它必須被記住，不能靠猜**：

```cpp
int a[5];  sort(begin(a), end(a));     // 🟢 合法
int a[5];  sort(a.begin(), a.end());   // 🔴 編不過——原生陣列沒有成員 begin
```

所以產碼時**不可以**一律寫成 `x.begin()`。
→ `cpp:container_iter` 加一個屬性 **`call`**（enum：`method`／`free`，預設 `method`）。

⚠️ **「判不出來就不要猜」**：不要用「接收者是不是原生陣列」去推——
型別在這個直譯器裡查得到的比例本來就不高（`container_iter/lift.ts` 的註解逐字：
「查不到型別時**照舊認**——絕大多數 `v.begin()` 的 `v` 型別查不到」）。

⚠️ 而 `std::begin` 對原生陣列與對容器在 C++ 標準上是兩個多載
——**在這個直譯器裡兩者的執行期表示已經一樣**（見 ①），所以那個差別
只活在**產碼**這一路，不影響執行。

### ③ `d2[0]` 是什麼——而它分成兩半

**查證結果：二維陣列是【巢狀】的**（`array_2d_declare/execute.ts`：
`elements.push({ type:'array', value: row })`）。所以：

| 語料寫法 | 這一刀做得到嗎 | 為什麼 |
|---|---|---|
| `sort(d2[i].begin(), d2[i].end())` | 🟢 **做得到** | `d2[i]` 求值出來就是那一列（一串格子），`begin`／`end` 是它的兩端 |
| `fill(d2[0], d2[0]+10005*105, …)` | 🔴 **做不到**（要出聲） | 那是「**整塊攤平**」的慣用法：C++ 的列是連續的，`d2[0]+N` 會走進第二列。**巢狀表示走不過去。** |

> **一個能表達「第 i 列」的模型，不一定能表達「跨過列的邊界」
> ——而 C++ 的二維陣列兩件事都是同一塊記憶體。**

🔴 **這一刀不做攤平**，理由是探索報告自己的判準：改成攤平要動
`array_2d_declare`／`array_2d_at`／每一個走訪它的地方，**而它救的是 1 支**。
→ 留一根釘子，**阻斷者與觸發條件都寫出來**：
「何時該修：二維陣列從巢狀改成**一塊連續格子 ＋ 每列一個位置**的那一刀。」

⚠️ **而它與另外兩支「讀進來的東西不知道要放哪裡：cpp:array_2d_at」不是同一族**
——那兩支是 `cin >> a[i][j]` 的**左值**問題（輸入要寫到哪一格），
與「列的邊界」無關。**兩族，不是一族。**

### ④ `range_sum_partial.dest`

**答案：它與 `begin`／`end` 是同一件事（一個位置），不是一個左值。**

`partial_sum(a, a+n, b)` 的第三個引數是 C++ 的**輸出迭代器**——
它說的是「從**哪一格開始**往後寫」，不是「寫進 `b` 這個名字」。
判準：把它接成 `b+1` 或 `v.begin()+2` 都是合法的 C++，而那兩個都不是「一個名字」。

⚠️ 第七十三條（`audit-lvalue-structure`）今天**沒有**列到它
（基線裡一筆 `cpp:range_*` 都沒有）——因為它掃的是「左值的一格裝著文法」，
而 `dest` 今天被第七十二條（字串屬性）認領。**換成接點之後兩條都不再指名它。**

### ⑤ 舊存檔

`SHAPE_CHANGES_V21`，一次升到底。判準抄 `cpp:loop_range` 上一刀的 `_children_why`：

> 「一個『留給舊存檔』的欄位，如果它裝的是同一個結構，那它不是相容性，是**第二份真相**。」

🟢 **舊存檔不會掉東西**：那 13 個屬性裡裝的是**原始碼的片段文字**，
而工作區的真實來源是程式碼那一份——`SHAPE_CHANGES` 丟掉快取、從程式碼重 lift。
⚠️ **屬性整個退場，不留欄位**（與 `loop_range.container` 同一個處置）。

### ⑥ 積木上的字

🔴 **今天的形態有一個【投影遺失】，而它躲過了護欄**：
`cpp_range_sort` 的 `blockDef` 只有 `CONTAINER`（對到 `begin`）＋ `COMPARATOR`
——**`end` 在積木上沒有落點**。第三十一條看不到它，因為
`audit-projection-loss` 掃的是**接點**，而 `end` 今天是屬性。

> **一個「還沒結構化」的欄位，連「它有沒有被畫出來」都不會被問。**

換成接點之後那條護欄就會看到它，所以**兩端都要有落點**。

| | 候選 | 為什麼不是另一個 |
|---|---|---|
| zh | **「把 %1 到 %2 排序，順序 %3」** | 不寫「從 begin 到 end」——那是抄語法；也不寫「迭代器」（與那一族同一條規矩） |
| en | **「Sort %1 through %2, order %3」** | 動詞開頭、首字大寫；不用 `sort(begin, end)` |

⚠️ 同族十顆用**同一個句式**（「把 %1 到 %2 ___」），否則第五十二條那一類的
「同 category 風格一致」會出現新的不一致。

---

## 概念目錄

### 改造（10 顆，不是新身分）

| 元件 | 今天 | 改成 | 語料 |
|---|---|---|---|
| `cpp:range_sort` | props `begin`,`end` | slots `begin`,`end`（expression） | 33+ |
| `cpp:range_reverse` | 同上 | 同上 | 1 |
| `cpp:range_fill` | 同上 | 同上 | 1 |
| `cpp:range_fill_sequence` | 同上 | 同上 | 0 |
| `cpp:range_sum` | 同上 | 同上 | 0 |
| `cpp:range_sum_partial` | ＋`dest` | ＋ slot `dest` | 0 |
| `cpp:range_max` / `range_min` | 同上 | 同上 | 各 1 |
| `cpp:range_find_lower` / `find_upper` | 同上 | 同上 | 6 / 2 |
| `cpp:container_iter` | props `which` | ＋ prop `call`（method／free） | 49 |

### 新身分（2 顆——**釘子指名的**）

| 概念 | 語法 | 語義 | 積木輸入 | 降級 | 語料 |
|---|---|---|---|---|---|
| `cpp:range_unique` | `unique(b, e)` | 把相鄰的重複往後推，回傳**新的結尾** | 2 | `func_call` | **0** |
| `cpp:range_remove` | `remove(b, e, v)` | 把等於 v 的往後推，回傳**新的結尾** | 3 | `func_call` | **0** |

⚠️ **語料 0 處，而仍然做**——理由不是語料，是**那根釘子**：
`fuzz-cpp-containers-2.test.ts:198` 逐字寫著「🔴 何時該修：**範圍那一族從字串屬性
換成接點的那一刀**」。而上一次有一根釘子寫了「迭代器那一刀做完的當天回來拔」
而沒有人回來，缺陷換了一個形狀活下去（`set_insert/execute.ts` 的註解）。

> **一根釘子如果只寫著「誰擋住我」，它不會在那個人讓開的時候自己掉下來。**

---

## 🔴 正向錨點清單（**今天是綠的，改動後必須還是綠的**）

這一刀的最大迴歸風險有名字：`sort(A, A+n)` 那 33 處**整條路換人走**。

| # | 錨點 | 為什麼選它 |
|---|---|---|
| 1 | `int A[5]={5,3,1,4,2}; sort(A, A+5);` | 裸陣列 ＋ 字面偏移 |
| 2 | `int h[5]; int N=5; sort(h, h+N);` | 🔴 **偏移是算出來的**——2026-09-16 那一刀補的正是它 |
| 3 | `vector<int> v{3,1,2}; sort(v.begin(), v.end());` | 成員形式 |
| 4 | `int a[4]; reverse(a, a+3);` | 部分範圍（不是整個容器） |
| 5 | `vector<int> v{1,2,3}; accumulate(v.begin(), v.end(), 0)` | 帶初值、運算式位置 |
| 6 | `int a[3]; fill(a, a+3, 7);` | 寫入型 |
| 7 | `sort(fx+1, fx+N+1);` | 🔴 **兩端都有偏移**（語料真的這樣寫） |

## 新救起來的（驗收要看到它們從紅變綠）

| # | 形狀 | 語料 |
|---|---|---|
| 8 | `sort(begin(a), end(a));` | `basic/14_array_2.cpp` |
| 9 | `for (int* p = begin(a); p != end(a); p++)` | `basic/14_array_1.cpp` |
| 10 | `int n = find(begin(a), end(a), x) - begin(a);` | `basic/14_array_2.cpp` |
| 11 | `sort(d2[i].begin(), d2[i].end());` | `tioj .../17_toj575.cpp` |

## 不做什麼（每一條有理由 ＋ 語料數）

| 不做 | 理由 | 語料 |
|---|---|---|
| 二維陣列攤平（`fill(d2[0], d2[0]+R*C, …)`） | 要動 `array_2d_declare`／`array_2d_at`／所有走訪它的地方，而救 1 支 → **釘子，觸發條件寫死** | 1 |
| 跨容器的範圍（`sort(a.begin(), b.end())`） | 它在 C++ 是**未定義行為**——判準裡不得放它。執行期 `sameCells` 會**出聲** | 0 |
| `rbegin`／`rend` 的範圍演算法 | `container_iter` 今天已經認得 `rbegin`（`reverse` 旗標），而語料 7 處**都不在範圍演算法裡**（是 `*v.rbegin()` 取最後一個） | 0 |
| `nth_element`／`partial_sort` | 產出沒有人接得住之前補它，只會讓失敗的位置往後移 | 0 |

---

## 依賴關係圖

```
pointer.ts（已在）──┬─→ resolveRange 換成位置版 ──┬─→ 10 顆 range_* 的 slots
                    │                              └─→ range_unique／range_remove（新）
                    └─→ container_iter ＋ call 屬性 ──→ begin(x)／end(x) 的 lift
```

## 建議實作順序

1. **`resolveRange` 換成位置版** ＋ `cpp:range_sort` 一顆先走通（含七條錨點）
2. 其餘 9 顆 range_* 照同一個形狀改（slots ＋ blockDef 兩格 ＋ 標籤同句式）
3. `cpp:container_iter` 的 `call` 屬性 ＋ `begin(x)`／`end(x)` 的 lift 分支
4. `SHAPE_CHANGES_V21`
5. 🔴 **回頭拔釘子**：`cpp:range_unique`／`cpp:range_remove` ＋ 把 `it.fails` 轉成 `it`
6. 第七十二條棘輪**下調** 39 → 26 並寫理由

## 跨語言對應

Python 的 `sorted(lst)`／`lst.sort()` **是同一個語義動作，而身分仍然分開**——
`python:list_sort` 收的是**一個容器**，`cpp:range_sort` 收的是**兩個端點**。
判準用接點結構（`元件代數.md` 的屬性結構化邊界）：接點結構不同 ⟹ 身分不同。
⚠️ 而**積木上的字要讀起來一樣**（「把 … 排序」），那是跨語言的一致性，不是身分。

## 需注意的邊界案例

- `sort(v.begin(), v.end(), greater<int>())`——比較器今天已經是接點，不動
- `end()` 指到「尾端之後一格」是**合法的**（`arithmetic/execute.ts` 的註解已寫），
  越界檢查只在**解參考**做——換成位置之後這條性質要保住
- 空範圍（`sort(v.begin(), v.begin())`）要是**零操作**，不是錯
- 🔴 `find(...) == end(a)` 這個慣用法要成立：`cpp:compare` 已有位置分支（`compare/execute.ts:83`）
