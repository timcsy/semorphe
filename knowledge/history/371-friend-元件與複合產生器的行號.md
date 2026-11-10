# 371 · friend 兩顆元件，與複合產生器漏報的行號

> 日期：2026-11-10
> 轉變：類別裡的 `friend class X;` 掉 raw_code、`friend R f(params);` 掉 unresolved，整個類別翻不出；走一趟積木之後，類別程式的診斷紅線畫在別行。
> 改成：新增 `cpp:friend_class`、`cpp:friend_function`；十一顆複合產生器替自己的標頭或標籤報行數。

friend 是盲測 fuzz_8 登記的缺口，照 next 的推薦做。

## 範圍

帶本體的 friend 函式、成員函式 friend、限定名 friend 照實降級，語料與課文沒有用到。`operator<<(ostream&, const A&)` 這種最常見的 friend 用法另有缺口：Semorphe 還沒對應 `ostream` 型別，要連 `os << x` 與 `cout << a` 的分派一起做，留在下一批。

## 行號是在瀏覽器裡看到的

驗 friend 時改了積木，Cella 對 `b.v` 的 reject 正確，紅線卻畫在 `public:`。把 friend 換成一般變數，偏移一樣，所以不是這一刀造成的。

行號由一個共用計數器記，複合產生器要自己報標頭那一行。收尾的 `}` 由 `generateNode` 補算，所以只有夾在子節點前面的文字會漏：`public:`、`struct S {`、`case 1:`、`#ifdef`、範圍 for、樣板函式、lambda、獨立區塊。

護欄 `audit-highlight-mapping` 之前量不到這件事，它問「標頭排在主體前面」，整段一起偏的時候仍然成立，C++ 探針也只有三段。這次加十段探針，每段的 `m1`、`m2` 要對到寫著那個名字的那一行；拿舊產生器跑過是紅的。

## 基線

`要看` 從 26 升到 27（`cpp:friend_function.return_type` 存 `int*` 這種字串，與 `cpp:func_def.return_type` 同一筆債）。其餘都是加兩顆元件帶來的計數，逐筆寫在各基線的 note。
