# Round-Trip 報告：cpp `pointer_step`（管線 197・階段三）

日期 2026-09-19｜分支 `197-cpp-iter-step`｜語料 218 支

## 一句話

> **這一關該找的東西找到了，而它們一個都不在 `pointer_step` 上。**
> 三顆一元運算子與 `cpp:cast` 的產碼在走一趟積木之後會**改變運算的結合**
> ——形狀完美、編得過、算別的東西。

## 五個面向的讀數

| 面向 | 怎麼量 | 結果 |
|---|---|---|
| ① 產出的程式碼 | 語料 218 支 `lift → 產碼` | **走樣 0**（修完之後；修之前 **2**） |
| ② 語義的不動點 | 再 lift 一次 | **同一棵 218／218** |
| ③ 載得進工作區 | `render → Blockly load` | **載不進去 0** |
| ④ 走一趟積木回來 | `render → extract → 產碼` | 專屬 44 條全綠 |
| ⑤ 跑出來一不一樣 | vs g++ | **兩邊都跑完 159｜一致 153｜內容真的不同 3｜解譯器出錯 12** |
| 🆕 積木有沒有 | 語料用到的身分 | **120 顆，缺 0** |

棘輪：「內容真的不同」**3 不動**（不得上升）·「解譯器出錯」**14 → 12**（下降）。

## 找到的缺陷（4 個，全部當場修完）

### ① 🔴 `cpp:cast` 產出 `(int)`——**不是合法的 C++**

`int varible_666 = int();`（`basic/4_variable.cpp`）的 `int()` 是**值初始化**，
第 194 刀讓它 lift 成一顆 `cpp:cast` 而 `value` 是空的，
**而產生器沒有跟上**：產出 `(int)`，於是再 lift 一次整段走樣。

### ② 🔴 `cpp:cast` 把 `(ll)(x+1)*z` 產成 `(ll)x+1*z`

`w/APCS/f638_2t.cpp`。**一段合法而算另一件事的程式**。
括號原本靠 `layoutHints` 帶，而**積木上沒有 metadata**：走一趟積木回來就沒了。

> **一個新的 lift 認領了一種寫法，而產生器產不回那種寫法
> ——形狀上是「多支援了一種語法」，實際上是「多了一種會壞掉的程式」。**

⚠️ ①②**都是我自己第 194 刀留下的**，而那一刀的驗收是綠的：
`interpreter-matches-compiler` 的 3 條轉型案例全過——**因為它們只跑，不產碼**。

### ③ 🔴 `pointer_deref`／`address_of`／`bitwise_not` 三顆同一個病

`*(v.end()-1)` 產成 `*v.end()-1`。三顆都用 `generateExpression` 而不是
`genChild(child, precedence(node), ctx)`——與 ② 是**同一族**（前綴運算子不問運算元的優先級）。

### ④ 修法

四顆全部改走 `genChild`，優先級由節點自己的 `traits.precedence` 決定。

## 常駐測試（不依賴外部 repo）

| 檔 | 條數 | 驗什麼 |
|---|---|---|
| `tests/integration/roundtrip-cpp-pointer-step.test.ts` | **44** | 四個面向 ＋ `DIRECTION`／`POS` 走一趟積木回來 |
| `tests/integration/roundtrip-cpp-cast.test.ts` 🆕 | **14** | ①②，含正規化與一根 🪦 |
| `tests/integration/interpreter-matches-compiler.test.ts` | 116 → **184** | ⑤，拿 g++ 當權威 |

⚠️ 抓到 ①② 的是**語料的探針**，而那支探針沒設 `STUDYCPP_DIR` 就會跳過
——所以形狀蒸餾進了 `roundtrip-cpp-cast.test.ts`。
**跳過的護欄與不存在的護欄長得一樣。**

## 留下的一根釘子（寫了為什麼不是現在）

`ll(x)`（`#define ll long long` 之後的函式式轉型）lift 成 `cpp:func_call` 而不是 `cpp:cast`。
`ll` 在 `LiftContext` 裡**已經**標成 `kind: 'type'`，而函式式那一路沒問 `isTypeName`
（今天只有 `cpp/lifters/io.ts` 一個呼叫點）。

- **為什麼不是現在**：語料 **0 處**；產出的程式碼一字不差，只有面向⑤會紅而沒有語料走到
- **何時該修**：下一次碰函式式轉型的 lift，補上 `isTypeName` 的第二個呼叫點
- **釘在哪**：`roundtrip-cpp-cast.test.ts` 的 `it.fails`——修好那天它會轉綠

## UB：判準裡沒有放進去的

`prev(v.begin())`／`next(v.end())` 都是 UB。處置是「不發明答案，讓解參考出聲」，
而**那句訊息的文字沒有寫進任何判準**。
