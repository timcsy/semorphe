# 概念探索：Python — 連鎖指定

## 摘要
- 語言：Python
- 目標：連鎖指定 `a = b = 0`（Python 語言參考 7.2「Assignment statements」：`(target_list "=")+ (starred_expression | yield_expression)`——右邊**只算一次**，再由左到右依序指定給每一個目標）
- 發現概念總數：1（語言特定）
- 建議歸屬：`python-beginner` 課程清單，緊接 `python:var_assign_sequence`
- 來源：盲測 `fuzz-python-student` fuzz_7 `is_prime[0] = is_prime[1] = False`；410 起整句降級（以前產回 `is_prime[0] = `）

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `python:assign_chain` | `t1 = t2 = … = v` | 把同一個值（只算一次）依序存進多個地方 | 目標 ×N（可增減，左值積木）＋ 值 ×1 | lang-core | Python 特定 | raw_code（410 的整句降級） | 目標可以是名字、索引、屬性；任一格是 `a, b` 這種解包 → 降級 |

## 語義重點（決定形狀的）
- **右邊只算一次**：`a = b = f()` 呼叫 `f` 一次。所以不能拆成 `b = f(); a = f()`，也不能拆成 `b = v; a = b`（`a[i] = i = 0` 這種左邊依賴前一格的寫法，順序是由左到右：先 `a[i]`，再 `i`）。
- 對應 CPython AST 的 `Assign(targets=[...], value)`——**本來就是一個多目標的節點**。Cella 的 `sAssign` 照它，`targets` 是清單。單一指派是 `targets` 只有一格的特例。

## 跨語言對應
- C++ 的 `a = b = 0` 是**運算式**（`b = 0` 回傳 `b` 的參照），C++ 那側已由指派運算式處理，形狀不同，不共用元件。

## 需注意的邊界案例
- `a, b = c = (1, 2)`：有一格是 pattern_list → 降級（與 var_assign_sequence 的 410 規則同）。
- `x = y += 1` 不合法（文法不收），不用管。
- 目標是 `a.b[c]` 這種巢狀左值：目標格是運算式接點，照樣收。
- Cella：`sAssign` 本來就收多個 targets（形狀已向 cella 提議收進 Python 對照表）。
