# 概念探索：C++ — 位置的相鄰一格（`std::prev` / `std::next`）

## 摘要
- 語言：cpp
- 目標：`<iterator>` 的 `prev`／`next`（以及刻意不做的 `advance`／`distance`）
- 發現概念總數：**1**（`cpp:pointer_step`）
- 通用概念：0、語言特定：1
- 建議歸屬：`cpp-advanced` 的「位置與範圍」那一層（第二層以上，進階）

⚠️ **這份報告沒有做網路查證，而那是一個決定不是疏漏**：`std::prev`／`next`
的簽名與語義（`prev(it, n = 1)`、不修改引數、雙向迭代器、O(1)／O(n)）是標準裡
逐字寫死的，而**這一刀真正的不確定性全部在這個 repo 裡**——執行期表示、
既有的方向處理、語料的規模。下面每一題的出處都是本 repo 的檔案或實測。

---

## 🔴 先決問題：修好 `prev` 之後那八支就跑得完了嗎

**逐支實測（2026-09-19，跑完整支程式）：**

```
AP325/4/4_8.cpp                  🔴 UNDEFINED_FUNC: prev
AP325/7/7_11_2t.cpp              🔴 UNDEFINED_FUNC: prev
AP325/7/7_11_3t.cpp              🔴 UNDEFINED_FUNC: prev
tioj/20_toj275.cpp               🔴 UNDEFINED_FUNC: prev
tioj/20_tioj_1911.cpp            🟢 跑完了   ← 那條路沒被走到
w/APCS/j607_2t.cpp               🟢 跑完了   ← 同上
w/APCS/j607.cpp                  🟢 跑完了   ← 同上
w/APCS/j607_trash.cpp            🟢 跑完了   ← 而輸出不同（卡在 `#define z -'0'`，另一族）
```

> **一個「這一族有 N 支」的讀數，如果 N 是照【第一個錯誤】分的，
> 那它量到的是錯誤的順序，不是缺陷的分佈。**

**修正後的規模：4 支真的卡在它**（官方分母裡 2 支，另外 2 支落在「編不過／
參照跑不完」）。⚠️ 而那 4 支修完**可能立刻撞到第二個錯**——這一點只有做完才知道，
所以驗收時要逐支再量一次。

🟢 **而它仍然值得做**，理由不只是支數：`prev(X.end())` 是「取最後一個元素」
在**有序容器上唯一的寫法**（`set` 沒有 `back()`、沒有隨機存取），
而語料裡 `set`／`multiset` 有 13 支。**它是那一族的必經之路。**

---

## ① `prev` 與 `next` 是同一顆身分嗎——**是**

判準原文（`knowledge/concepts/元件代數.md:250`）：

```
🟢 是參數  引數個數相同、接點相同、角色相同——差別只有【一個值】
🔴 是身分  引數個數不同、或語義上做的事不同
```

| | `prev(it)` | `next(it)` |
|---|---|---|
| 引數個數 | 1 | 1 |
| 接點 | 一個位置 | 一個位置 |
| 角色 | 運算式 | 運算式 |
| 做的事 | 相鄰的一格 | 相鄰的一格 |
| 差別 | **往哪一邊** | |

⟹ **一顆身分 ＋ 一個方向屬性。**

🟢 **前例成立**：`cpp:container_iter` 的 `which` 是一個 enum 屬性，
值有 `begin`／`end`／`rbegin`／`rend` **四個**——同樣是「一個接點、一個角色、
差別只有一個值」。它沒有被拆成四顆元件，而那個決定寫在它的 `_default_why` 裡。

---

## ② `next` 語料 0 處——**要做**，而判準不是偏好

**判準：一個積木做得出來的東西，五路都要接得住。**

方向是一個**下拉選單**。學生把它切到「後一個」的那一秒，工作區上就有一顆
產得出 `next(...)` 的積木——而如果 lift／execute 接不住，那是
**我們自己造出來、自己不認得的程式**。

> **不做一個屬性值，與不做那個屬性，是兩件事。
> 前者在積木上開了一個洞，而洞的邊緣是使用者的手指。**

⚠️ 對照 `cpp:io_mode` 的 `scientific`（語料 0 而做了）：**同一個判準**，
只是那顆的報告寫成「它與 `fixed` 是同一顆身分的兩個值」。這裡把判準說清楚一點。

🔴 **而反過來也成立**：如果一個東西**不是**同一顆身分的屬性值，語料 0 就是
不做的理由（見⑥的 `advance`／`distance`）。

---

## ③ 第二個引數 `prev(it, n)`——**不做**，而降級是誠實的

語料 **0 處**。而前例（`cpp:container_erase` 的 `key_end`）是一個**警告**：
那一格做了，而瀏覽器驗收時它是「一個常態的空洞」。

🟢 **不做的代價是可控的**：lift 要**檢查引數個數**，兩個引數時**不認領**，
於是它落到 `cpp:func_call` → 執行期 `UNDEFINED_FUNC: prev`——**誠實出聲**。

⚠️ 前例逐字：`cpp:range_find` 的 spec test 有一條
「🔴 lift：引數個數不對的同名函式不得被認領」。**照抄那個形狀。**

🟠 **何時該做**：語料或盲測出現第一支 `prev(it, 2)`。

---

## ④ 執行期做得到嗎——**做得到，而且三個邊界都有現成的答案**

🟢 迭代器在這個直譯器裡是**實體式指標**（`src/interpreter/pointer.ts` 的檔頭：
「迭代器 ＝ 實體式指標」）。`prev(it)` ＝ `movePointer(it, -1)`。

| 邊界 | 答案 | 出處 |
|---|---|---|
| **反向迭代器** | **不必特別處理** | `movePointer` 逐字：「🔴 反向的位置，『下一個』是往前……少了這一行，`++rit` 往後走——而症狀是**順序安靜地反過來**，不是報錯。」它讀 `v.reverse` 並翻轉 `delta`。 |
| **`prev(v.begin())`** | **不發明答案**：位移變成 −1，而**解參考那一路會出聲** | `movePointer` 逐字：「⚠️ **不在這裡檢查越界**：C++ 允許指標指到『尾端之後一格』（那正是 `end()`），只有**解參考**才是錯的，而 `pointer_deref` 已經在檢查了。」 |
| **字串的迭代器** | **自動支援** | `container_iter` 對字串回 `positionIn(cells, at, { readonlyCells: true, … })`，而 `movePointer` 是 `{ ...v, … }`——`readonlyCells` 與 `reverse` 都保留。 |

⚠️ 還有一個**不在題目裡而必須說**的：`movePointer` 會重新蓋 `era` 章
（刪除補償）。`prev` 走它就自動正確；**自己手寫 `{ offset: … }` 會漏掉那個章**，
而症狀是「`erase` 之後手上的位置指到隔壁」。

---

## ⑤ 積木上的字

| | 中文 | 英文 |
|---|---|---|
| `MSG0` | `%1 的 %2` | `%2 of %1` |
| `DIR_PREV` | `前一個位置` | `previous position` |
| `DIR_NEXT` | `後一個位置` | `next position` |
| `TOOLTIP` | 「給出相鄰的一個位置，**原本那個位置不動**。⚠️ 從開頭再往前、或從結尾之後再往後，都走出了這個容器——那時**讀它會出聲**。」 | 「Gives the neighbouring position; the original position is unchanged. Going before the start or past the end leaves the container — reading it then reports an error.」 |

✅ 沒有 `prev()`／`next()` 這種函式語法（標籤規範的速查表列了 `func()` 那一類）。
✅ **「迭代器」三個字一個都沒有**——與同族的 `container_iter` 一致（它說「位置」）。
✅ 句式與同族並排：`container_iter` 是「%1 的 %2（%3）」，這顆是「%1 的 %2」。

---

## ⑥ 不做什麼（每一條有理由與支數）

| | 做？ | 理由 | 語料 |
|---|---|---|---|
| `next(it)` | 🟢 **做** | 同一顆身分的另一個屬性值——見② | 0 處 |
| `prev(it, n)` | 🔴 不做 | 引數個數不同；常態留空的插槽有前例是刺眼的——見③ | 0 處 |
| `advance(it, n)` | 🔴 不做 | **原地修改**（回傳 void）⟹ 語義上做的事不同 ⟹ **另一顆身分**。而它需要左值解析，不是一個運算式。 | 0 處 |
| `distance(a, b)` | 🔴 不做 | 回傳**整數**而不是位置 ⟹ 另一顆身分。⚠️ **而學生有一個現成的寫法**：`it - v.begin()`（指標相減，今天就能跑，語料裡有）。 | 0 處 |

> **一個已經有等價寫法、而語料一次都沒用到的函式，做它只會多一顆沒有人拖的積木。**

---

## 命名

**`cpp:pointer_step`** — 主體 `iter`、操作 `step`。

⚠️ **`step` 要進 `OPERATIONS`**，而那一條「找不到既有詞的時候，問題常常不是詞不夠」
**在這裡不適用**，理由要寫下來：

- `iter_next` ❌ —— `next` **已經被 `cpp:random_next` 佔著**（「下一個亂數」，
  一個沒有方向的語義）。而更嚴重的是：**用 `next` 命名一顆可以往前也可以往後的身分，
  等於把一個屬性的值寫進身分**——那正是這個 repo 一再治的病
  （「位置不是身分，是形態」／「量什麼不是身分，是參數」）。
- `iter_move` ❌ —— `move` 在 C++ 裡是 `std::move`（所有權轉移），撞名。
- `pointer_step` 🟢 —— 「往某個方向走一格」，而方向是參數。

新增一個詞的前例：`attach`／`trigger`／`sync`／`tie` 各自都附了理由。

---

## 概念目錄

### `cpp-advanced` ／「位置與範圍」 — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp:pointer_step` | `prev(it)` / `next(it)` | 相鄰的一個位置 | 2（一個接點 ＋ 一個方向下拉） | lang-library（`<iterator>`） | cpp | **D3 `raw_code`** | 引數個數不是 1 時不認領 → `func_call` → 誠實出聲 |

**五路**：lift（`lift.ts`，自由函式登錄）· generate（`generate.ts`）·
render／extract（`forms/blocks.json`）· execute（`execute.ts`，一行 `movePointer`）。

---

## 依賴關係圖

```
cpp:pointer_step  ──依賴──▶  interpreter/pointer.ts 的 movePointer（已存在）
               ──常一起出現──▶  cpp:container_iter（`prev(X.end())`，語料 10/10 處）
               ──常一起出現──▶  cpp:pointer_deref（`*prev(...)`，語料 8/10 處）
               ──常一起出現──▶  cpp:container_erase（`s.erase(prev(s.end()))`，2 處）
```

## 建議實作順序

只有一顆。而**它的依賴全部已經在**（`movePointer`／`container_iter`／`pointer_deref`）。

## 跨語言對應

**沒有通用概念**。Python 的位置不是一等公民——「最後一個」的慣用寫法是
負索引（`xs[-1]`），而那是 `python:container_at` 的一個值，不是一個位置運算。
`itertools` 也沒有 `prev`。

> **一個概念在另一個語言裡「用別的方式達成」，不等於它們是同一顆身分。**

## 需注意的邊界案例

1. 🔴 **`prev(v.begin())` 是未定義行為**——不檢查、不發明答案，讓解參考出聲（見④）
2. 🔴 **反向迭代器上方向要翻轉**——`movePointer` 已經做了，**不要再翻一次**
3. ⚠️ **兩個引數時不得認領**（見③），照 `cpp:range_find` 的那條 spec test
4. ⚠️ **產回去要一字不差**：`prev(s.end())` 不得變成 `s.end()-1`（`set` 沒有隨機存取，那樣編不過）
5. ⚠️ **`era` 章**：走 `movePointer` 就自動有；手寫 `{offset}` 會漏掉
