# 概念探索：C++ — 結構化繫結（`auto [a, b] = …`）

**2026-09-18** · 分支 `186-cpp-structured-binding`

## 摘要

- 語言：cpp
- 目標：C++17 的 structured binding（`auto [a,b] = e;`／`for (auto [k,v] : m)`）
- 發現概念總數：**1 顆新的 ＋ 1 顆既有的擴充**
- 通用概念 0、語言特定 1（`cpp:var_declare_sequence`）
- 建議歸屬：`cpp-advanced` 的 **L2a**（STL 容器）——與 `cpp:container_iter`／`cpp:container_find` 同一格

## 🔴 先說一件量出來的事：**它不是「沒被 lift」，是【安靜地答錯】**

送進來的任務書寫著「整個宣告沒有被 lift」。實測（2026-09-18）**不是**——
三種形狀各自被認成了別的東西：

```
auto [a, b] = v[0];        → cpp:var_declare_auto  { name: "[a, b]" }
auto& [k, val] = *m.begin(); → cpp:var_declare_auto  { name: "& [k, val]" }
for (auto [x, y] : v)       → cpp:loop_range       { var_name: "v", container: "v" }
```

⚠️ 第三個最糟：**迴圈變數拿到了容器的名字**，兩格一模一樣。
而三個都產生**合法的語義樹**，所以它們在 ①②③④ 四個形狀面向上都是綠的
——出事的只有 ⑤（跑起來）。

> **一個「名字那一格裝了一串名字」的缺陷，產出的程式碼原樣印出去就是對的
> ——所以它只會在【有人要理解那個名字】的時候出事。**

🟢 而這個 repo **已經知道**了。`cpp:var_declare_auto` 的 `name` 屬性上逐字寫著：

> ⚠️ `name` 在這顆上**不保證是單一識別字**：`auto [u,v,w] = f();` 的結構化繫結
> 把一串名字放在這裡（實測學生語料 5 筆）。改成 `literal`。

**把 `identifier` 放寬成 `literal` 是記下了症狀，不是修好它。**

## 語料讀數（218 支學生程式，逐處數的）

| 形狀 | 處數 | 支數 |
|---|---|---|
| 宣告式 `auto[a,b] = e;` | **11** | 11 |
| 範圍 for `for(auto[a,b] : c)` | **5** | 4 |
| `auto&`（參考繫結） | **0** | 0 |
| 名字個數 = 2 | 11 | — |
| 名字個數 = 3 | 5 | — |
| 名字個數 = 1 或 ≥4 | **0** | — |

右邊是什麼（**全部**都是容器的取出）：`BFS.front()` 6 · `pq.top()` 3 ·
`ms.top()` 1 · `BFS.top()` 1 · `q_bfs.front()` 1。

⚠️ 語料**不寫空格**（`auto[pt,d]`），而且緊接著把那些名字拿去當下標（`d2[pt]`）
——所以「名字錯了」的症狀會出現在**下一行**。

現在正在失敗的 4 支：`AP325/7/7_1`（`d`）· `7_1_another`（`d2[pt]`×2）· `7_5`（`nx`）。

---

## 六個設計問題：每一題的答案與出處

### ① 新身分，還是 `cpp:var_declare_auto` 的一個形態？→ **新身分**

出處：`knowledge/concepts/元件代數.md`「判準：**問『它們的形狀一不一樣』，不是『它們像不像』**」

```
🟢 是參數    引數個數相同、接點相同、角色相同——差別只有【一個值】
🔴 是身分    引數個數不同、或語義上做的事不同
```

`auto x = e` 綁**一個**名字；`auto [a,b] = e` 綁 **N 個**，而且多做一件事：
**按位置把一個聚合拆開**。接點結構不同 ⟹ 身分不同。

同一份文件的「屬性的結構化邊界」給出第二個獨立理由：

> 字串適用：值只被完整傳遞或顯示
> 結構適用：值包含**多個語義子部分**

`name = "[a, b]"` 正是「需要被拆分或解析」的那一種。

🔴 **而最強的出處是同一個 repo 的另一個語言**：`python:var_assign_sequence`
的 `_abstractComponent_why` 逐字寫著——

> 「**C++ 那側最接近的是結構化繫結**，而它需要型別。這一顆在執行期才知道右邊有幾格。」

**那顆元件在等這一顆。**

### ② 三種建構子選哪一個？→ 都不是：走 **`param_decl` 子節點 ＋ `paramCount`**

任務書給的三選一（`variadic`／`paramList`／`branchList`）在這個 repo 裡
對「一串**名字**」有一個既成的答案，而它比三者都具體：

```jsonc
// python:var_assign_sequence／python:loop_for／python:func_def 三顆一模一樣
"slots": { "targets": "param_decl" },
"renderMapping": { "dynamicRules": [{
  "countSource": "paramCount",          // ← 存檔契約，與同族一字不差
  "childSlot": "targets",
  "childComponent": "param_decl",
  "childFields": { "PARAM_{i}": "name" }
}]},
"traits": { "declaresVariable": ["PARAM_{i}"] }
```

為什麼不是 `variadic`（加減**值插槽**）：每一格要接一顆積木，而**一個被綁定的名字
不是運算式**，插不進東西。
為什麼不是 `branchList`：那是成對的插槽 ＋ 一個可有可無的尾巴，形狀不對。
為什麼不是裸的 `paramList`：`param_decl` 子節點**就是**這個 repo 的 paramList 實作，
而 `childComponent` 那一格說得出「每一格是什麼」。

出處：`python:var_assign_sequence` 的 `_children_why`——

> **目標是子節點不是屬性**——與同族函式定義的參數同一個做法（`slots.params`）。
> 名字有幾個是變動的，而一個「用逗號串起來的字串」需要 parse 回結構才能用。

🟢 而「名字是識別字，字串是對的」也有出處（同一顆的 `_writesTo_why`）：

> ⚠️ **綁定一個新名字不算**（`for (int x : v)` 的 x、函式參數名、宣告的名字）
> ——那些的文法只允許識別字，字串是對的。

⟹ 每一格 `param_decl` 的 `name` 存字串是**對的**；錯的是把 N 個擠進一格。

### ③ `auto&` 進身分嗎？→ **不進，它是參數**

同一條判準：引數個數相同、接點相同、角色相同，**差別只有一個值**。
先例在 `元件代數.md` 的「形式不是身分，是參數」那張表：

```
形式不是身分，是參數     const int／#define／裸 int → 一顆 ＋ style
```

⟹ `properties: [{ name: "binding", kind: "enum", default: "value" }]`，值域 `value`／`reference`。

⚠️ **而語料是 0 處**——所以「要不要做」需要另一個理由，而它有：
**不做的話 `auto&` 會安靜地被當成複製**（今天它連 `&` 都被吞進名字裡）。
一個錯的答案比一個誠實的降級貴，而這裡的成本只是一個下拉選項。

### ④ 範圍 for 的擁有者是誰？→ **`cpp:loop_range`，而且不必新身分**

出處：`python:loop_for` **已經解過這一題**，它的 `_children_why` 逐字——

> **多目標（`for k, v in …`）走 `targets` 子節點**，與同族函式定義的參數同一個做法；
> 單一目標仍然走 `obj` 屬性——**舊存檔照樣打得開**，而積木上那個名字欄位也還在用它。
> ⚠️ 兩者不是兩份真相：**`targets` 有東西時它是唯一的真實，`obj` 是它的第一格。**

⟹ `cpp:loop_range` 加 `slots.targets: "param_decl"` ＋ `traits.declaresVariable: ["PARAM_{i}"]`
＋ 同一份 `dynamicRules`。身分不變、**不需要存檔遷移**、登錄表沒有「同名兩個主人」的問題。

🔴 **而這一題本來就不該由新元件回答**：`for (auto [x,y] : v)` 裡的
「對每一個」是迴圈的語義，「拆成兩個名字」是迴圈變數的形狀。
一顆語句元件塞不進 for 的括號裡——它的 `role` 是 `statement`。

### ⑤ 積木上的字

規矩（與迭代器一族同一條）：**不要把 `pair`／`tuple`／`auto` 寫在積木上**，
也不要用「解構」這種學生沒學過的術語。

🟢 **抄 Python 那顆**——跨語言的同一件事該讀起來一樣：

| | zh-TW | en |
|---|---|---|
| `python:var_assign_sequence`（既有） | `分別設定 %1` | `Unpack %1 into` |
| `cpp:var_declare_sequence`（新） | **`分別取出 %1`** | **`Unpack %1 into`** |

差一個字是刻意的：Python 那顆**設定既有的名字**，C++ 這顆**取出並命名**。
⚠️ 而 tooltip 要說出那件會讓學生卡住的事，抄 Python 那顆的句子：
「格數要對得上，對不上會停下來說明。」

`binding` 下拉的字：`複製一份`／`就地修改`（en：`a copy`／`in place`）
——**不寫 `auto` 也不寫 `&`**。

### ⑥ 不做什麼（寫出來）

判準（探索報告自己寫過）：「一個概念如果它的產出沒有人接得住，補上它不會讓任何一支
程式跑起來——它只會讓失敗的位置往後移。」

| 不做 | 語料 | 為什麼 | 何時該做 |
|---|---|---|---|
| `tie(a, b) = p` | **0 處** | C++11 的舊寫法，而語料一支都沒有 | 出現第二個獨立來源時 |
| 綁到**使用者自己的結構**（非 pair／tuple） | **0 處** | 要按**宣告順序**取公開成員，而那是結構那一族的知識 | 盲測或語料出現時 |
| 綁到**原生陣列**（`auto [a,b] = arr;`） | **0 處** | 同上 | 同上 |
| 名字個數 1 或 ≥4 | **0 處** | 形狀支援（`paramCount` 本來就是變動的），但**不寫測試** | — |

🔴 **而「格數對不上」要出聲，不得補預設值**：`auto [a,b,c] = 一對` 在 C++ 是編譯錯誤，
我們跑得到它，所以要丟錯說明。判準見第三十三條護欄（靜默回退）。

---

## 概念目錄

### cpp-advanced · L2a「STL 容器」 — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `cpp:var_declare_sequence` | `auto [a,b] = e;`／`auto& [k,v] = *it;` | 把一個聚合**按位置**拆開，分別命名 | 1 個運算式插槽 ＋ N 個名字欄位 ＋ 1 個下拉 | cpp | **D2 → `cpp:var_declare_auto`**（今天就是走它，而名字是錯的）→ D3 `raw_code` | `paramCount` 是存檔契約 |

### 既有元件的擴充（不是新身分）

| 元件 | 加什麼 | 為什麼不是新身分 |
|---|---|---|
| `cpp:loop_range` | `slots.targets: "param_decl"` ＋ `traits.declaresVariable` ＋ `dynamicRules` | 出處見 ④：`python:loop_for` 同一個做法，`targets` 有東西時它是唯一真實 |

## 命名

`cpp:var_declare_sequence` — 查過詞彙表（`src/languages/cpp/naming.ts`）：

```
var       SUBJECTS
declare   OPERATIONS（第 103 行）
sequence  KINDS（第 184 行，`var_input_sequence` 帶進來的）
```

三段都已宣告，**不必補詞彙**。而它與 `python:var_assign_sequence` 只差一個操作詞
（`declare` vs `assign`）——那正是兩者真正的差別：C++ 這一顆**引入新名字**。

## 依賴關係圖

```
cpp:var_declare_sequence
  ├─ 需要 param_decl（已存在，Python 三顆在用）
  ├─ 需要 pairParts（已存在，runtime/map.ts）
  ├─ 需要 cpp:pointer_deref（已存在）── auto& [k,v] = *it
  └─ 需要 struct-types 的欄位順序 ── ⚠️ 只有「綁到結構」才需要，而那一項不做

cpp:loop_range（擴充）
  └─ 需要 param_decl（同上）
```

## 🔴 兩個前置缺陷——**不先修它們，這顆元件一支程式都救不起來**

探索時把報告自己標為「產生階段要查證」的那一格量掉，結果擋住了**全部 11 處**：

```
vector<pair<int,int>> v; v.push_back({3,4}); v[0].first     🟢 3
deque <pair<int,int>> q; q.push_back({1,2}); q[0].first     🔴 「（不是一個結構）」
queue <pair<int,int>> q; q.push({1,2});      q.front().first 🔴 「（不是一個結構）」
priority_queue<pair<int,int>> pq; pq.push({1,2}); pq.top().first 🔴 同上
```

而語料那 11 處的右邊**全部**是 `BFS.front()`／`pq.top()`／`ms.top()`／`q_bfs.front()`
——**一處都不是 `v[0]`**。

> **一個概念如果它的產出沒有人接得住，補上它不會讓任何一支程式跑起來
> ——它只會讓失敗的位置往後移。**（這份報告自己的判準）

根因查到底了，而**兩個都已經被寫在程式碼裡等人來修**：

| # | 缺陷 | 出處（逐字） |
|---|---|---|
| **P1** | `deque<…>` **沒有宣告元件**——它掉進 `cpp:var_declare`，`type` 是一整串 `deque<pair<int,int>>`，於是 `elemType` 是空的 | `cpp:vector_push` 的執行器註解：「（`deque` 至今沒有被登錄成容器樣板，所以它的 `elemType` 是空的。）」 |
| **P2** | `.push()`（queue／stack／priority_queue）**不照元素型別長**——`container_push` 走的是 `ctx.evaluate`，而同族的 `push_back` 走 `evalInitializer(…, arr.elemType, …)` | `src/components/cpp/container_push/execute.ts:10` vs `vector_push/execute.ts:26` |

⚠️ **P1 有自己的獨立價值**：`deque` 在語料裡是 **22 支**（開放清單上早就有它）。
⚠️ **P2 是一顆已經存在的元件少做一件同族都在做的事**——不是新概念。

> **同一族的兩顆元件，一顆做了某件事而另一顆沒有——
> 那個差別不會有人發現，直到有人寫出只有前者能表達的程式。**
>（`cpp:var_declare_auto` 的 `_traits_why` 逐字，2026-09-17 記的同一個形狀）

## 建議實作順序

```
P1  cpp:deque_declare（新元件）              22 支語料，獨立價值
P2  cpp:container_push 照 elemType 長         既有元件補一行，與 push_back 對齊
──── 到這裡先量一次語料 ────
1   cpp:var_declare_sequence（新元件）        11 處 / 11 支，4 支正在失敗
2   cpp:loop_range 的 targets（既有元件擴充）  5 處 / 4 支
```

⚠️ 每一步要**分開量**：做完先跑一次語料，確認「解譯器出錯」真的下降，再做下一步。
**一次改兩個地方，量到的下降分不出是誰的。**

🔴 而 P1／P2 做完**就該量一次**——它們有可能自己就修好幾支（`pq.top().first`
這個寫法不需要結構化繫結）。**那個讀數會告訴你這一刀還剩多少價值。**

## 跨語言對應

| C++ | Python | 同一個概念嗎 |
|---|---|---|
| `auto [a,b] = p;` | `a, b = p` | **語義上是**，而身分仍然分開 |
| `for (auto [k,v] : m)` | `for k, v in m.items():` | 同上 |

**為什麼身分仍然分開**：`python:var_assign_sequence` 的 `_abstractComponent_why`
已經回答過——C++ 這一顆**需要型別**（`auto`／`auto&` 是宣告的一部分），
而 Python 那一顆是純指派、不引入型別也不宣告繫結方式。
🟢 而**該共用的是抽象元件那一格**：這一顆的 `abstractComponent` 指向
`cpp:var_declare`（它是一個宣告），與 `cpp:var_declare_auto` 同一個父。

## 需注意的邊界案例

| 案例 | 說明 |
|---|---|
| **沒有空格**（`auto[pt,d]`） | 語料 15/16 處這樣寫。判別不得依賴空白 |
| **`&` 黏在 `auto` 上** | 今天 `& [k, val]` 整串進了名字。`binding` 要從宣告子那一側判，不是切字串 |
| **格數對不上** | 出聲，不得補預設值（第三十三條） |
| **右邊是一個位置**（`*it`） | `cpp:pointer_deref` 已經能跑，而它回的是**那一格本身**——參考繫結要靠這個 |
| **`pq.top()` 回的是什麼** | ⚠️ 產生階段要**先查證**：`tuple<int,int,int>` 在執行期是一串格子還是一個物件。**三個名字的那 5 處全靠它** |
| **名字馬上被當下標用**（`d2[pt]`） | 症狀出現在下一行——所以測試要**跨行**，不能只斷言宣告那一行 |

## 驗收（可量）

1. 最小重現進 `tests/integration/interpreter-matches-compiler.test.ts`，拿 g++ 當權威：
   兩個名字、三個名字、`auto&`、範圍 for、格數對不上（誠實出聲）。
2. 語料重量：目前**兩邊都跑完 136｜一致 123｜內容真的不同 9｜解譯器出錯 38**。
   🔴「內容真的不同」不得上升；「解譯器出錯」要下降。
3. 全套 7047 綠 · `npx tsc --noEmit` · 54 條護欄 · 孤兒 0。
4. 🔴 加新積木會動到四本清冊（積木型別指紋 · 工具箱快照 · `block-instantiable` · 顏色棘輪），
   而且**改了積木的畫法要重產 71 張課文對照圖**。
