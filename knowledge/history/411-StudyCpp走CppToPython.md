# 411：StudyCpp 走一遍 C++ → Python，抓到兩個靜默失真（453）

**為什麼量**：C++ → Python 之前只拿課文量過（cpp-beginner 64 支、cpp-advanced 22 支）。451 的全域變數失真是手寫的反例抓到的，課文裡沒有那種寫法——學生自己的程式才有。所以拿學生語料 StudyCpp（218 支，core-keeper/StudyCpp，只在本機讀）整批走一遍：測資照程式自己的讀取順序生（`tests/helpers/stdin-from-tree.ts`），兩邊交給 Cella，比判決、輸出、assumes。

**第一輪**：218 支只換得過 2 支，其餘被保留原因擋住（註解 120 支、逗號運算式 81、`#define` 55、大括號 42…）。換過去的那兩支裡就有一個失真。

## 兩個靜默失真（兩邊都 accept、輸出不同）

1. **字面量的跳脫序列被跳脫兩次**：語義樹存的是原始碼的寫法（`'\n'` 的 char 是兩個字），`literal_char`／`literal_string` 直接 `JSON.stringify` ⟹ Python 寫成 `"\\n"`，印出字面的 `\n`。修法：先把 C++ 的跳脫解成值（contract 的 `cEscapedValue`）再寫成 Python 的字面量。`\x`／八進位 ≥ 0x80 在 C++ 是位元組、Python 的 str 是碼點，照實保留。
2. **計次迴圈一律寫成 `range`**：`range(n)` 的上界只算一次、迴圈變數每圈重設；C++ 每圈重算上界、本體改了迴圈變數下一圈看得到。`for (int i = 0; i < n; i++) { if (i == 1) n = 3; … }` C++ 印 `012`、Python 印 `01234`。原本只檢查「本體指定了迴圈變數」，沒檢查上界。修法：本體**可能寫**上界或迴圈變數（contract 的 `mayWrite`，寧可多報）⟹ 寫成 `while`（每圈重算，與 C++ 同義）；本體有屬於這一圈的 `continue`（會跳過最後的 `+= 1`）⟹ 保留。
   - 「寫」怎麼判：指定的 target 槽、元素指定、敘述位置的方法呼叫（`v.push_back`）、當引數傳給自訂函式、名字是全域而本體呼叫了自訂函式——都問形狀；而 `cin >> a` 與 `cout << a` 的 values 槽形狀一樣、意思相反，所以 **input 膠囊自己宣告它寫哪幾個子節點**（registrar 多一個 `writes`）。

附帶一個不合法的輸出：頂層 `program` 用 `trim() !== 'pass'` 濾掉每一顆頂層項目補的 `pass`，連縮排在 if 裡面的也濾 ⟹ `if (x) {}` 換成沒有本體的 `if x:`。改成只濾頂層那一行。

## 讓更多學生的程式換得過去

註解（`#`，區塊註解逐行；只剩註解的本體補 `pass`）、`ios::sync_with_stdio(0)`／`cin.tie(0)`（只影響速度，不寫）、敘述位置的逗號運算式（逐個運算元寫）、型別別名（`#define ll long long`、`typedef`、`using`：registrar 多一個 `typeAlias`，引擎換之前在每顆節點的型別文字上展開，讀型別的膠囊照展開後的型別判）、數字巨集、`const` 純量宣告、`int x{}` 大括號初始化、C 風格轉型與 `static_cast`（只收兩邊意思確定相同的：浮點→整數 `int()`、整數→同寬或更寬照原樣、char→整數 `ord()`、窄整數與 double→double `float()`；窄化與 `(float)` 保留）、`auto` 的純量初值、數字字面量的分隔符號（`10'0000'0000` → `10_0000_0000`，原樣搬過去是不合法的 Python）與八進位（`017` → `0o17`）、`v.back()`／`v.pop_back()`（只收 vector；字串的 pop_back、元素是容器的 back 保留）。

**結果**：StudyCpp 換得過去的從 2 支到 34 支；其中 C++ 側 accept 的 28 支，24 支判決、輸出相同，另外 4 支（AP325 3_5、3_5_better、3_9、7_5_TLE）是 Cella 的 Python 判決在 `[0] * N`（N 到 20 萬、100 萬）丟出堆疊溢位——cella 確認是他們的缺陷，排在 11-15 的 Python 輪第一項（改回 unknown 附原因、不再遞迴 N 層）。assumes 不同只因為 `bits/stdc++.h` 在 C++ 那側帶 libstdc++ 的假設——那是標頭本身的性質，不是換錯。手寫進 `cpp-to-python-verdict` 的 453 段 22 例（`-t 453` 數的），冷算每例 < 1 秒。

**仍擋住最多的**：pair（成員、陣列、`push({u, v})`）、`range_sort`（等 Cella 今晚的 sort 效能）、deque、`while (t--)` 這種運算式位置的 `++`／`--`、`getline` 與 `cin >>` 混用。
