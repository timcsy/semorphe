# 374 · 寫到 ostream：教科書的 operator<< 接上判決

> 日期：2026-11-10
> 轉變：`os << a << b;` 的左端若是當參數傳進來的串流，沒有積木、Cella 也翻不過去；`friend ostream& operator<<(ostream& os, const P& p);` 加類別外定義這個教科書寫法整段判不出來。
> 改成：新元件 `cpp:stream_write`（接點 `stream`、`values`，對應 Cella 的 `sOut`），`ostream` 對應 `tOstream`。

## 為什麼左端要先知道型別

`<<` 同時是位移、自訂運算子與輸出。只有宣告成 `ostream`／`ostream&` 的變數，或回傳 ostream 的函式呼叫，才算寫到串流；自訂的 `Log& operator<<` 維持原樣。所以 lift 靠宣告的型別判斷，`LiftContext` 也多記了函式的回傳型別。

## `return os << x;` 的翻法

Cella 沒有對應的運算式。左端是變數時翻成「先 `sOut`，再回傳 `os`」，因為串流本身就是回傳值。Cella 表示還要查過這個形狀有沒有語義差，查完前先這樣翻；`if (os << 1)` 這類要拿結果當值的位置照實翻不過去。

## 左端是函式呼叫時照實不送

`ind(cout) << 5` lift 得出來、積木與程式碼來回也對，但 Cella 的 `sOut` 目前不會執行那個呼叫，送過去會少印還判對。所以 formalize 回 unknown，等 Cella 下一版。

## 盲測多修的四件事

四支盲測程式抓到的都不是這顆元件本身，而是同一類程式會碰到的旁支：

- 類別裡回傳參考或指標的運算子（`T& operator[](int i)`）被當成一般方法。
- 成員函式的參數沒有在本體之前宣告，本體裡 `os << x` 認不出 `os` 是串流。
- `Foo(ostream& out) : out(out)` 這種參考成員，`&` 掉了。
- 帶 `noexcept` 這類尾端修飾的成員被靜默丟掉修飾，改成照實降級。

## 接上之後露出來的誤判

`ostream` 能翻之後，盲測裡一支原本翻不出的合法程式變成 reject：`Shape::describe(out)` 被送成自由函式，Cella 說找不到。這和 ostream 無關，`B::d(y)` 用 int 也一樣，只是之前被蓋住了。Cella 還沒有「明確指定類別的成員呼叫」的形狀，所以先照實標翻不出，等他們給形狀。

## 還沒有的

帶本體的 friend、`ostringstream`、明寫的 `operator<<(cout, p)` 呼叫都照實降級。Cella 另有一個缺口：類別同時有收字串的建構子與自訂 `operator<<` 時回 `operator functions from more than one namespace`，已回報，測試用 `knownCellaGap` 釘住。
