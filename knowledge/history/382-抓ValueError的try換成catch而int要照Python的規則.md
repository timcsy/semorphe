# 382 · 抓 ValueError 的 try 換成 catch，而裡面的 int() 要照 Python 的規則

> 日期：2026-11-11（408）
> 轉變：Python → C++ 遇到 `try` 整支保留（「還沒有 C++ 的寫法」）。課文 `11-例外` 的三份解答都因此換不過去。
> 改成：`try: … except ValueError: …` 換成 `try { … } catch (const invalid_argument&) { … }`，條件是本體裡會丟 ValueError 的只有 `int(字串)`。

## 為什麼不能直接用 stoi

`int(字串)` 平常換成 `stoi`。在 try 外面這樣做，壞掉的輸入兩邊都會讓程式停下來。在抓 ValueError 的 try 裡面就不行了：`stoi("12abc")` 回傳 12，而 Python 會丟 ValueError、走進 except。換過去的程式會在學生最在意的那一種輸入上做不同的事。

所以 try 裡的 `int(字串)` 換成補在開頭的小函式 `py_int`：去掉前後空白、可以帶正負號、數字之間可以有一個底線，其他情況丟 `invalid_argument`。Cella 判過 `"abc"`、`" 1_0 "`、`"12abc"`、`"+7"`，兩邊輸出相同。

## 檔尾也要丟例外

課文的寫法是 `while True: try: n = int(input()) …`。輸入讀完時，Python 的 `input()` 丟 EOFError、程式停下來；原本的 `read_line` 回空字串，`py_int` 再丟 ValueError，C++ 就會一直印「再試一次」，變成無窮迴圈。所以 `read_line` 讀不到時丟 `runtime_error("EOFError")`。這一條對每一支讀輸入的程式都成立，所以改在 `read_line` 本身，而不是只在 try 裡改。

型別表看不到檔尾之後的事（那幾格沒有跑到），所以測試是用正常的輸入換、再拿會讀到檔尾的輸入兩邊各跑一次。

## 仍然保留的

- 抓 `ZeroDivisionError`：C++ 的整數除以零是未定義行為，不是例外。
- 抓好幾種、`except … as e`（印出來的訊息兩邊不同）、`else`／`finally`。
- 本體裡有別的、在 Python 可能丟 ValueError 的東西（`float(字串)`、`max([])`、自己寫的函式）。這裡用的是允許清單：不在清單上的就保留。
- `11-例外/rebuild.py`：它故意讓 `int("abc")` 失敗，後面兩行從來沒跑到，型別看不到，照實保留。

## 順手修的

C++ 的 `catch` 沒有例外變數名時，產生器印成 `catch (const invalid_argument& )`，多一個空白，走一趟就和原文不同。
