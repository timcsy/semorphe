# 概念探索：Python — 通用桶剩下的 21 個名字 ＋ `with` 陳述

**日期**：2026-08-23 ｜ **分支**：`168-python-builtin-methods`
**來源**：第五十條護欄的「通用桶」逐名報表（36 個節點）＋ 第五十三條護欄的「該補進語料」7 格

## 摘要

- 語言：Python
- 目標：**跑得動而拖不到**的 21 個名字（掉進 `python:func_call`，身分沒了）＋ `with`
- 發現概念：**18 顆新元件 ＋ 3 處既有元件的邊界擴張**
- 全部 21 個名字**今天都跑得動**（`PYTHON_BUILTIN_METHODS` / `PYTHON_BUILTIN_FUNCTIONS` 已查證）
  ——所以這一輪補的是**身分與積木**，不是執行期。

> 🔴 **「跑得動」與「拖得到」是兩個問題**：內建函式表管跑得動，膠囊管拖得到。
> 而**身分**是第三個：掉進通用桶的節點在語義樹上叫 `python:func_call`，
> 於是它在積木上是一顆泛用的呼叫積木，學生看不出那是「排序」還是「四捨五入」。

## 一、三處**不該**開新元件的（既有元件的邊界太窄）

| 名字 | 今天為什麼掉出去 | 做法 |
|---|---|---|
| `set(xs)` ×2 | `python:cast` 的 `TARGETS` 只有 `int/str/float/bool/list` | 加 `set`／`tuple`／`dict` |
| `enumerate(xs, 1)` ×2 | `python:container_enumerate` 只收**一個**引數 | 加 `start` 接點（位置式與 `start=` 兩種寫法） |
| `.sort()` ×2 | `python:container_sort` 只認 `sorted(...)` | **開新元件**（見下）——原地排序改的是自己，回的是 `None` |

> ⚠️ **先問「是不是既有元件的邊界太窄」再開新的**——這是
> [experience](../../knowledge/experience.md) 的既有教訓：一顆新元件的成本是五路＋積木＋課程＋護欄基線。

## 二、新元件（18 顆）

### L1（中級）— 字串的五顆

| 元件 | 語法 | 語義 | 積木輸入 | 降級 |
|---|---|---|---|---|
| `python:string_format` | `"{}".format(a, b)` | 把值填進樣板 | 樣板 ＋ 可變引數 | `func_call` |
| `python:string_find` | `s.find(x)` | 找位置，**找不到回 -1** | 2 | `func_call` |
| `python:string_compare_prefix` | `s.startswith(x)` | 開頭是不是 | 2 | `func_call` |
| `python:string_compare_suffix` | `s.endswith(x)` | 結尾是不是 | 2 | `func_call` |
| `python:string_fill` | `s.zfill(n)`／`s.ljust(n)`／`s.rjust(n)` | 補到指定寬度 | 2–3 ＋ 下拉 | `func_call` |

### L1（中級）— 串列的六顆

| 元件 | 語法 | 語義 | 積木輸入 | 降級 |
|---|---|---|---|---|
| `python:container_count` | `xs.count(v)` | 出現幾次 | 2 | `func_call` |
| `python:container_find_position` | `xs.index(v)` | 找位置，**找不到丟例外** | 2 | `func_call` |
| `python:container_insert` | `xs.insert(i, v)` | 插進第 i 格 | 3 | `func_call` |
| `python:container_remove` | `xs.remove(v)` | 刪掉**第一個等於 v 的** | 2 | `func_call` |
| `python:container_pop` | `xs.pop()`／`xs.pop(i)` | 取出並刪掉 | 1–2 | `func_call` |
| `python:container_sort_self` | `xs.sort()` | **原地**排序 | 1–3 | `func_call` |

### L2（進階）— 高階函式與其他

| 元件 | 語法 | 語義 | 積木輸入 | 降級 |
|---|---|---|---|---|
| `python:container_apply` | `map(f, xs)` | 每一格套一個函式 | 2 | `func_call` |
| `python:container_filter` | `filter(f, xs)` | 留下通過的那些 | 2 | `func_call` |
| `python:container_all` | `all(xs)` | 全部都真 | 1 | `func_call` |
| `python:container_any` | `any(xs)` | 有一個真 | 1 | `func_call` |
| `python:type_is` | `isinstance(x, int)` | 是不是這個型別 | 1 ＋ 下拉 | `func_call` |
| `python:math_divmod` | `divmod(a, b)` | 商與餘數一起 | 2 | `func_call` |
| `python:with` | `with open(p) as f:` | 用完自動收尾 | 1 ＋ 名字 ＋ 主體 | `raw_code` |

## 三、詞彙表要加的字（每一個都要說得出理由）

🔴 **操作詞是封閉集合，要非常克制**——所以下面每一個都先問過
「既有的字說不說得出它」：

| 加什麼 | 加在哪 | 理由 |
|---|---|---|
| `format` | OPERATIONS | 「把值填進樣板」。既有的 `replace` 是換掉一段**指定的**字，說不出「按位置填空」 |
| `apply` | OPERATIONS | `map`。⚠️ **不叫 `map`**——那個字在這份表裡是**主體**（字典），同一個字兩種詞性讀的人要記兩次 |
| `filter` | OPERATIONS | 「留下通過的」。既有的 `find` 回一個，`filter` 回一串 |
| `all`／`any` | OPERATIONS | **量詞**：一整串收成一個真假。C++ 那側也是 `all_of`／`any_of` **兩個**名字 |
| `divmod` | OPERATIONS | 商與餘數**一起**回。既有的 `arithmetic` 一次只給一個 |
| `type` | SUBJECTS | `isinstance` 的主體是**型別**。C++ 最接近的是 `dynamic_cast`，而那是一個轉換不是一個判斷 |
| `prefix`／`suffix` | KINDS | `startswith`／`endswith` 做的仍然是 `compare`，差別在**只比一端** |
| `position` | KINDS | `.index` 做的仍然是 `find`，差別在**回位置**。⚠️ 光是 `find` 在這份表裡已經被 `in`（在不在裡面）佔走 |
| `self` | KINDS | `.sort()` 做的仍然是 `sort`，差別在**改的是自己**（而且回 `None`） |
| `with` | ATOMIC_NAMES | 與 `global`／`assert` 同一類的語言構造，沒有「主體＋操作」可拆 |

## 四、`with` 的執行期是一個**具名的邊界**

`with open("a.txt") as f:` 的形狀收得下（lift／generate／積木／來回都做得到），
而**這個直譯器沒有檔案系統**。所以：

- lift／generate／render／extract：**做**
- execute：**丟一個說得清楚的錯**（「這個工具沒有檔案」），不是靜默什麼都不做

> ⚠️ **誠實降級的形狀有兩種**：認不出來的變灰色方塊；認得出來而做不到的，
> 要在**執行的那一刻**說為什麼——而不是在抬升的時候假裝不認得。

⚠️ 而語料裡的 `with` 那一段因此會讓「執行失敗」從 0 變成 1。
**這是刻意的**：它記錄的是一個真的邊界，而不是一個假的零。
（第五十條的棘輪要為它上調一格並在 commit 訊息指名。）

## 五、依賴與順序

```
① 邊界擴張（cast / enumerate）        ← 最便宜，先做
② 字串五顆                            ← 語料最多（.format ×5）
③ 串列六顆                            ← 形狀一樣，可批次
④ 高階函式四顆（apply/filter/all/any） ← 需要「函式當值」，而那個既有（FuncRef）
⑤ type_is、math_divmod
⑥ with                                ← 唯一一個帶執行期邊界的
```

## 六、跨語言對應

| Python | C++ 那側 | 等價嗎 |
|---|---|---|
| `s.find` | `cpp:string_find` | **形狀同、值不同**（C++ 回 `npos`，Python 回 -1）→ 不宣告等價 |
| `xs.count` | `cpp:container_count` | 同上：C++ 的是 `std::count` 演算法 |
| `xs.pop` | `cpp:container_pop` | C++ 的 `pop_back` 不回值 → **不等價** |
| `map`／`filter` | `cpp:range_*` 沒有對應 | Python 特有 |
| `with` | 沒有（RAII 是型別的事，不是語句） | Python 特有 |

> 🔴 **同名不等於等價**——等價要在量得出來的觀察集底下宣告（既有的
> `container_sort` 就是這樣寫的）。這一輪一律 `abstractComponent: null`，
> 而理由逐顆寫在膠囊裡。

## 七、需注意的邊界案例

- `"{0}{1}{0}".format(a, b)` 與 `"{n}".format(n=1)` — **樣板的解析不歸我們**，
  內建表已經有 `format`；元件只負責身分與插槽
- `xs.pop()` 與 `xs.pop(i)` — 引數 0 或 1，兩種都要收
- `s.rjust(5, "0")` 與 `s.zfill(5)` — **語義相同而寫法不同**，
  所以 `method` 屬性要記住原文寫的是哪一個（否則來回一趟改了使用者的碼）
- `isinstance(x, bool)` 要排在 `isinstance(x, int)` 前面測——Python 的 `bool` 是 `int` 的子類
- `enumerate(xs, start=10)` 的關鍵字寫法與位置寫法**都要收**
- `with open(...) as f` 與 `with A() as a, B() as b`（多個）——**後者先不收**，誠實降級
