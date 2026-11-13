# 405：Python → C++ 收下連續比較與 enumerate，python-bridge 課也量進來（446）

**之前**：Python → C++ 的判決護欄只量 `lessons/python-beginner`（36 支換過去 34）。`lessons/python-bridge`（給從 C++ 轉過來的學生）沒有被量；探針量到 12 支裡 7 支換得過去。`0 <= x < 10` 這種連續比較、`for i, x in enumerate(xs)` 兩種寫法整支照原文保留。

**之後**：
- `compare_chain` 有了 `to-cpp.ts`：`a op b op2 c` 寫成 `a op b && b op2 c`。只在中間那一項是名字或字面量（求值一次與兩次沒有差別）、三項同為數字或同為字串時換；其餘照實保留並寫原因。
- `loop_for` 收下 `enumerate(xs[, 字面量起點])`：兩個名字都要是「迴圈後不讀、本體不改」的迴圈變數，`xs` 是觀察到型別的 `list[T]` 名字；寫成計數 for ＋ 本體第一行取元素。
- 判決護欄改成每一門課一組（`lessonSuite`），`python-bridge` 進來：12 支換過去 8 支（03 enumerate 那課轉過去了）。剩下的：02 有一條分支沒走到（型別看不到，照原則保留）、06 兩支是 ZeroDivisionError 與 try 裡的 return（原則上的保留）、09／11 等 Cella。

**沒做的**：`sorted(xs)`／`sorted(set(xs))` 寫好了又拿掉——Cella 把 `stable_sort` 也附上 `sort.order` 的假設（與 Python 的穩定排序判決不同），而 `std::set` 少了迭代器範圍的建構子。兩件都回報 cella、對方確認是缺陷（前者 11-14 晚上到 11-15，後者已在對方 main、11-14 02:00 之後發）。發版後把那支 to-cpp 放回來、補「sorted 與 sorted(set(…))」那條測試。

**為什麼這樣做**：互轉的結束條件是「來源與目標交給 Cella 判決相同才算無失真」（vision 跨語言互轉那一項）。連續比較改寫成 `&&` 時中間項被求值兩次——只有沒有副作用的中間項才是同一個意思，所以限定名字與字面量，而不是全部換（P6：換不了就照實保留）。enumerate 的兩個名字沿用計數 for 的 `plainLoopVar` 判準，同一個理由：Python 迴圈結束時變數停在最後一個值，C++ 的 for 多走一步。
