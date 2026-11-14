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

## 後續：455（同一天）

453 留下的阻擋原因裡，不等 Cella、擋得多的三顆：三元運算子（16 支）、`abs`（9）、`swap`（9）。
- `c ? a : b` → `(a if c else b)`。⚠️ C++ 的兩個分支會先轉成共同型別（`c ? 1 : 2.5` 的 1 是 1.0），Python 不會 ⟹ 整數分支放進浮點的結果補 `float()`；字串字面量（`char[5]` 退化成 `char *`）兩邊都是 str；其餘型別不同的照實保留（`c ? 'a' : 66` 的結果是 int）。
- `swap(a, b)` → `a, b = b, a`，並用 `r.writes` 宣告它寫兩個——不宣告的話，計次迴圈判不出上界被 swap 改了（453 的 `mayWrite`）。字串裡的字元保留（Python 的 str 不能改）。

StudyCpp 換得過去 34 → 40 支；C++ accept 的 33 支裡 28 支判決、輸出相同；4 支是同一個 Cella 溢位，1 支（AP325 6_4）是 Python 那側建 `[[0] * 2 for _ in range(100007)]` 跑到步數上限（unknown，不是輸出不同）。

## 後續：456（同一天）

接著清阻擋原因：64 位元的 `/`、`%`，位元運算，負號，`max({a, b, c})`，一般的 `for`。量的過程中又抓到三個靜默失真：

1. **`long long` 的 `x /= 2` 變成 Python 的浮點除法**：複合指定只看「是不是整數」，沒有分 32／64 位元，`/=` 照原樣搬 ⟹ `x` 從 int 變 float。修法：64 位元有號整數的 `/`、`/=`、`%`、`%=` 走補上的 `trunc_div`／`trunc_mod64`（C++ 往零截斷，Python 的 `//` 往負無窮）；浮點目標照原樣；無號與其他型別照實保留。
2. **內層宣告與外層同名**：`int i = 100; for (int i = 0; i < 3; i++) {} cout << i;` C++ 印 100、Python 印 2——Python 一個函式只有一層作用域。修法：func_def／main 掃一遍，內層宣告了外層還看得到的名字（參數、迴圈變數、for 的初始宣告、範圍迴圈的結構化綁定都算）⟹ 保留。兩個依序的 `for (int i…)` 不算（外層已看不到），有正向例釘著。
3. **送給 Cella 的大整數字面量被四捨五入**：`9000000000000000001` 先變成 JS 的 number 才送，送出去的是 `9000000000000000000`——判決量的是另一支程式。這一刀先讓 formalize 遇到 JS number 表示不了的十進位字面量照實回 unknown；Cella 的 eNum 本身是任意精度，問題在 JSON 的讀法，cella 會提方案（候選是允許十進位字串），談定前維持 unknown。

另一件回報 cella 的：`max({a, b, c})` 的 eBraced 在 Cella 那側推不出型別，cella 認了是缺陷（11-15 早上那一輪）。我們的換法照常（`max(a, b, c)`），只是 C++ 那側的判決要等它。

**結果**：StudyCpp 換得過去 40 → 60 支，沒有掉支。C++ accept 的 50 支裡 36 支判決、輸出相同；13 支是 Python 那側建 5 萬到 20 萬元素的串列撞到 Cella 的 `[0] * N` 堆疊溢位（11-15 的 Python 輪修），1 支（AP325 6_4）步數上限。沒有輸出真的不同的。手寫進 `cpp-to-python-verdict` 的 456 段冷算每例 < 1 秒。

## 後續：457（同一天）

挑「只差一個原因」的支數最多、又不等 Cella 的：運算式位置的 `++`／`--`（5 支）、`for (int i{}; …)` 的大括號起始值（5 支）。
- **運算式裡的 `++`／`--`**（`a[k++] = b[j++]`、`j = i++`、`int r = f(j--)`）：Python 沒有，引擎每句敘述開一個框，`i++` 拆成這一句後面的 `i += 1`、`++i` 拆成前面的，運算式的位置寫 `i` 本身。只在拆開之後意思不變時收：這一句沒有本體（拆到 if／while 條件外面只會算一次）、不在 `&&`／`||`／`?:` 裡（不一定會算；膠囊以 `r.conditional()` 宣告）、同一句裡那個名字只出現一次（先後次序會變）、後面那一句不會被 `return`／`break` 跳過、全域變數不會被這一句呼叫的自訂函式讀到。
- **`while (n--)`**：先拿舊值判、再減、再跑本體 ⟹ `while n != 0: n -= 1; 本體`，離開之後再減一次（C++ 判到 0 時也減了，n 停在 -1）。本體有 break（離開那一次少減）保留；只收有號整數。
- **順手抓到一個不合法的輸出**：計次迴圈的上界是浮點（`for (int i{}; i < 1e5; i++)`）時寫成 `range(1e5)`，Python 判 reject（range 只收整數）——不是這一刀帶進來的，`i = 0` 的寫法早就這樣，只是那幾支被大括號擋在前面。改成寫 while（整數與浮點的比較兩邊相同）。

`while (cin >> x)` 這一次不做：要照 C++ 讀不到時的語意（失敗補 0、半個詞的處理）寫，另開。

**結果**：StudyCpp 換得過去 60 → 70 支，沒有掉支。C++ accept 的 59 支裡 40 支判決、輸出相同；其餘是 Cella 的 `[0] * N` 溢位（16 支，11-15 的 Python 輪修）與步數上限（3 支：AP325 6_4、fake_random 兩支跑十萬圈），沒有輸出不同的。

## 後續：459（同一天）

原本排的是 struct（458，擋 21 支）。量了才發現：struct 能單獨放出來的 6 支（AP325 4_5、4_6、4_20_AC、5_5、5_6、a915）**全都還要 `sort(A, A+n)` 配 `operator<`**，而 sort 等 Cella 第二輪（11-15 凌晨）——現在做 struct 一支也放不出來。所以 struct 等 sort 一起做，這一刀改做不等 Cella 的：

- **`while (cin >> a >> b)`**：照 cella 回的 C++ 判法（`streams.cella`）——讀到檔尾時那個變數不動、迴圈結束；讀到一半沒了，前面讀到的留著。換成 `while True:`，每讀一個先 `if not has_token(): break`（`has_token()` 在 `input()` 丟 EOFError 時回 False）。本體的 continue 回開頭再讀、break 照樣離開，與 C++ 相同。⚠️ 詞不是那個型別（int 讀到 `abc`）時 C++ 存 0 並結束，Python 的 `int(…)` 丟 ValueError——這是 `cin >> x` 那一句本來就有的限制，Cella 照輸入判，不是靜默。讀入那顆以 `r.streamRead()` 宣告自己（迴圈那顆問能力，不寫別顆的身分——就近性護欄）。
- **前置宣告**：不寫。而這帶出一件事：C++ 的 main 可以寫在定義之前，攤平到 Python 頂層之後會在 `def` 之前就呼叫（NameError）⟹ main 後面還有函式定義時，把攤平的 main 移到最後（C++ 也是整個翻譯單元準備好才進 main）。
- **二維陣列的元素指定** `a[i][j] = v`。做的時候抓到一個**靜默失真**：一維那顆的整數截斷只問 Cella 那一句的型別，而 Cella 不給 ⟹ `int a[3]; a[1] = 7.9;` C++ 印 7、Python 印 7.9，兩邊都 accept。修法同 450 的 map：宣告那顆記下元素型別，指定時先問 Cella、沒給就問宣告的，都不知道而值是浮點就保留。

不做的：`sizeof`（除了 `char` 都是實作定義，寫成常數等於把某一台機器的答案寫死）；`if (cin >> x)`（2 支，另有參考參數擋著）。

**結果**：StudyCpp 換得過去 70 → 76 支（6_7、8_1_loop、a277、a104_1、a005、a007），沒有掉支。C++ accept 的 63 支裡 43 支判決、輸出相同；16 支是 Cella 的 `[0] * N` 溢位、3 支步數上限。剩下一支 a104_1 露出一個**早就在的限制**：探針問程式生的測資在 `while (cin >> n)` 的某一圈中途沒了，C++ 的 `cin >> d1[i]` 讀不到時 d1[i] 不動（照樣印出那一列 0），Python 的 `next_token()` 丟 EOFError——兩邊判決不同（看得見，不是靜默），而它在 `cin >> x` 那一句從 spec 219 起就是這樣，只是這支以前換不過去。要照實的話，每一次讀都要寫成「讀不到就不動、之後的讀也都失敗」，另開一刀。

## 後續：460（同一天）

`getline(cin, s)` 與 `cin.ignore()`。C++ 的 `cin >> x` 讀完一個詞之後，**那一行剩下的**（至少一個換行）還在緩衝區裡，下一個 `getline` 讀到的是那段剩餘——Python 的 `input()` 沒有「剩餘」這個東西，逐詞讀與逐行讀混用就會錯位。所以程式裡一出現 getline／ignore，讀入的引擎整個換成 `LINE_READER`：一個 `_rest`（那一行還沒讀的部分；用一格的 list，因為 Cella 的 Python 還沒有 `global`）、`next_token()` 跳過空白後從剩餘裡切詞、`read_line()` 回傳剩餘（沒有就讀下一行）、`ignore_char()` 丟一個字元（剩餘是空的＝丟的是換行）。`while (getline(cin, s))` 換成 `while has_line():`。

不做的：帶引數的 `cin.ignore(n, '\n')`、`s.push_back(c)`——照實保留「還沒有對應」。

**結果**：StudyCpp 換得過去 76 → 78 支（19_a565、2018_10_a），沒有掉支；C++ accept 65 支，44 支判決、輸出相同。新增的 a565 與 459 的 a104_1 是同一個限制（測資在迴圈中途沒了，C++ 讀不到就不動、Python 丟 EOFError）——看得見，不是靜默。

## 後續：461（11-15）

一維陣列參數 `int p[]`：C++ 傳的是指向呼叫端那個陣列的指標，Python 傳的是同一個 list ⟹ 讀、改元素兩邊都是呼叫端那一個，換成 list 參數；參數本身被換掉（`p = q`）時兩邊不同，保留。順手放寬計次迴圈的一條：上界被當引數傳給自訂函式就判「可能被改」——而換得過去的程式裡沒有參考參數（`int& x` 整支保留），純量以值傳改不到呼叫端那一個 ⟹ 迴圈變數與整數型別的上界不算（`mayWrite` 的 `byValue`；⚠️ 參考參數哪天換得過去，這一條要跟著改）。

**結果**：StudyCpp 換得過去 78 → 81 支（AP325 1_9、1_9_AC、1_10，都是 N 皇后的回溯），沒有掉支。三支的 C++ 那一側 Cella 判 unknown（回溯到 n = 11 超過步數上限），所以這三支的「判決相同」量不到——形狀換過去了，對不對由新加的判決例（同形狀、小 n）擔保。

## 後續：462（11-15）

bool 陣列（一維、二維）：預設 `False`、初值與元素指定包 `bool(…)`。做的時候量到兩個**靜默失真**（兩邊都 accept、輸出不同），根是同一個——**Cella 不給指定目標的型別**：

- `bool b = 5;`、`b = n - 4;` 原樣存整數，印的時候 `int(b)` 是 5／2，C++ 印 1。
- `int k; k = 2.5 * n;` 原樣存 7.5，C++ 截斷成 7（一維、二維陣列的同一個洞 459 補過，純量變數沒有）。

修法：`intValue` 的目標是 bool 就包 `bool(…)`；引擎開頭掃一次整棵樹，記下每個宣告的名字與型別（`varTypeOf`——問形狀：有名字有型別、不是函式；同一個名字宣告過兩種 ⟹ 不知道）；不知道而值是浮點 ⟹ 保留，不猜要不要截斷。

**結果**：StudyCpp 換得過去 81 → 83 支（AP325 3_6_RE、7_3），沒有掉支——新的保留沒有擋到任何一支。C++ accept 67 支裡 45 支判決、輸出相同。

## 後續：463（11-15）

vector 的陣列（鄰接串列 `vector<int> g[N]`）：每一格各自一個空 list（`[[] for _ in range(N)]`，不是 `[[]] * N`——那會讓每一格是同一個 list）；一格整個指定（`g[7] = g[0]`）是複製 ⟹ `list(…)`；格裡的元素收到浮點值照 T 截斷。`push_back`、範圍 for、`size()`、`g[u][k]` 原本就換得過去（obj 是 array_at）。

**結果**：StudyCpp 換得過去 83 → 84 支（AP325 7_2），沒有掉支。另外三支（7_1_another、7_7、toj575）現在只剩 deque 與 sort 擋著——都在等 Cella（deque 排在 11-15 的 Python 輪、sort 已有判決但慢）。

## 後續：464（11-15）

二維 vector：`vector<T>(n)` → `[0] * n`、`vector<T>(n, x)` → `[x] * n`（x 照 T 換，`vector<int>(3, 2.5)` 是 2）；元素是數字或字串，Python 裡改不動，`[x] * n` 每格同一個值沒有差別。`vector<vector<T>> g(R, vector<T>(C, x))` → `[row for _ in range(R)]`——**不是 `[row] * R`**（那會讓每一列是同一個 list，改一格整欄跟著變）；fill 不是建構子形狀（是一個已有的 vector）時每一列 `list(…)` 複製一份。判決例冷算 6.0 秒。

**結果**：StudyCpp 換得過去 84 → 86 支（AP325 6_10、6_14），沒有掉支。6_14 兩邊判決相同；6_10 的 C++ 那一側 Cella 本來就判 reject（464 之前就是），換得過去但比不了。兩邊都 accept 而輸出不同的仍是那五支（6_4、fake_random ×2、a104_1、a565——讀到檔尾與亂數，464 之前就在）。

## 後續：465（11-15）

pair 換成 **tuple**，不是 list：C++ 的 pair 是值（`q = p` 複製一份），tuple 不能改 ⟹ 指定、傳值、範圍 for 的 `auto x` 都不必另外複製。代價是改成員要**重建整個 tuple**（`p.first = 7` → `p = (7, p[1])`），於是指定目標多了兩樣：`assign`（不能原地寫的目標說出整句怎麼寫）與 `type`（成員的型別——Cella 不給指定目標的型別）；`=`、`+=`、`++`、`cin >>`、getline 都改走 writeTo／updateTo，swap 遇到就保留。

**參考改成員保留**（`for (auto& x : a) x.first = 1`、`pair<int,int>& p` 參數）：重建的是本地那一個，改不到原本的——所以目標的型別只問宣告那一顆記下的，不問 Cella（Cella 的型別不分參考）。宣告的形狀檢查（全域、遮蔽、重新指定）原本只認 `type` 屬性，pair 的宣告是 `type1`／`type2`——補上（`declaresTyped`），否則函式裡改全域的 pair 不會寫 `global`。

**順手修到一個早就在的靜默失真**：放進容器的值沒照元素型別換——`vector<int>` 的 `push_back(2.5)`、`stack<int>` 的 `push(4.5)`、`set<int>` 的 `insert(6.2)`、`vector<int> v(n, 2.5)`，C++ 放進去的是截斷後的整數，Python 原樣放浮點（印 `2.5 3.95 1000.0`，C++ 印 `2 3 1000`）。寫 vector<pair> 的 push_back 時看到它原樣 append，先寫一支判決例證實再修（`elementValue`）。

**結果**：StudyCpp 換得過去 86 → 86，沒有掉支、沒有一支的輸出變了。pair 那一族擋在後面的是成員巨集（`#define F first`，6 支）、`sort`（等 Cella）、multiset、heapq——這一刀是它們的地基。

## 後續：466（11-15）

成員巨集（`#define F first`／`#define y second`，StudyCpp 17 支）與 pair 的型別巨集（`#define pii pair<int,int>`，6 支）。lift 看到的是 `p.F`（成員名 F）與 `pii p`（一般的宣告、型別文字 pii）——巨集在 lift 之前沒有展開。

型別巨集沿用 453 的別名：值是 `pair<…>` 也收，引擎在型別文字上展開；一般宣告的型別展開成 pair 之後走 pair 那顆同一套寫法（`pairDeclLine`，從 pair_declare 抽出來共用）。成員巨集是新的一種別名：引擎把成員名換掉——**只在那個名字整支程式都只當成員名用時**。C++ 的巨集到處都換（`#define x first` 之後 `int x` 是 `int first`），別處也出現就整個不展開、`#define` 那一句照實保留（`isExpandedAlias`）。`#define pb push_back` 不在這裡：`v.pb(x)` lift 成一個叫 pb 的方法呼叫，要換得在 lift 之前展開。

453 那支「`#define F first` 要保留」的判決例轉成換得過去、判決相同。

**結果**：StudyCpp 換得過去 86 → 86，沒有掉支、輸出沒變。用到成員／pair 巨集的 18 支裡，巨集不再是擋路的那一項；**9 支現在只剩 `range_sort`**（等 Cella 的 sort 變快），4_15 系列另有 multiset 與它的迭代器。

## 後續：467（11-15）

switch：每段都以 break／return 結尾、default 在最後、中間沒有別的 break ⟹ `if x in (1, 3): … elif …: … else: …`。其餘（掉下去的 fallthrough、段落中間的 break、default 不在最後）照 C++ 的跳法寫：`while True:` 只跑一次、裡面的 break 跳出它（同 C++ 跳出 switch），每段的條件是 `hit or x in (…)`、default 那段是 `hit or x not in (所有 case 的值)`——default 在哪裡都對。被比的值是名字或字面量就直接用（段落裡改了它也沒關係：後面的條件被 hit 短路），否則先算一次存起來。掉下去的 switch 裡有屬於外層迴圈的 continue 就保留（它會跳到 while True 的下一圈）。

`~x` 只收有號整數（C++20 定死了二補數，~x ＝ -x - 1，同 Python）；無號的 C++ 繞回成很大的數，保留。`{ … }` 區塊攤平在同一層。

**順手補到一個藏著的漏洞**：「本體有屬於這一圈的 continue」（for 寫成 while 時 continue 會跳過更新）原本跳過每一個叫 body 的槽——用意是跳過內層迴圈，而區塊、case 的本體也叫 body，於是 `for (…; i *= 2) { { if (…) continue; } }` 看不到那個 continue。區塊之前換不過去所以沒有露出來；這一刀讓區塊換得過去，**同一刀改成只跳過宣告了 `control_flow: loop` 的本體**，並釘一支保留的判決例。

**結果**：StudyCpp 換得過去 86 → 88 支（basic 11_switch_case_2——case 2 掉進 default；8_logic_2——`~0`、`~0b00000100`），兩支判決、輸出都相同；沒有掉支、沒有一支的輸出變了。

## 後續：468（11-15）

`cin >>` 讀進 char 與 bool。char 跳過空白、讀**一個**字元——詞的其餘部分留給下一次讀（`A3` 讀進 char 再讀 int 是 'A' 與 3）；讀詞的小工具有兩份存法（詞的 list／這一行還沒讀的字，後者給用了 getline 的程式），讀一個字元也各一份，讀完之後 getline 看得到那一行剩下的字。bool 讀一個整數：0 是 false、1 是 true；其他值 C++ 設 failbit（b 變成 true、之後的讀全部失敗），Python 寫不出「之後都讀不到」⟹ 丟例外——照輸入判、看得見，不是靜默。

⚠️ 一個已知的差：C++ 的 char 是一個位元組、Python 是一個字元，非 ASCII 的輸入兩邊讀到的不同（string 的長度早就有同一個限制）。

**結果**：StudyCpp 換得過去 88 → 90 支（AP325 1_11、tioj 9_toj170），沒有掉支、沒有一支的輸出變了。9_toj170 判決、輸出相同；1_11 的探針測資是**問程式自己生的**（只知道「讀一個 bool」，不知道題目只給 0／1），於是 Python 那邊丟「bool 只讀得進 0 或 1」——那正是設計上該看得見的那一條，不是失真。

## 後續：469（11-15）

`unordered_map` 換成 dict。查、改、`count`、`clear()` 兩邊相同；**走訪**的順序 C++ 沒有規定（看雜湊與桶數）——包 `sorted` 是另一支程式、照 dict 放進去的順序也不是 C++ 的 ⟹ 走訪 unordered 容器的那一顆照實保留（`KeyedKind` 多一個 `ordered`）。同一刀：`x.clear()`（vector、map／set、stack／queue 都有同名、同樣原地清空的方法；字串不收），以及 map 先讀再改時鍵可以是「陣列的一格、索引也是名字或字面量」（`cc[A[i]]++`，問形狀：obj ＋ index 兩個槽）。

**結果**：StudyCpp 換得過去 90 → 93 支，沒有掉支、沒有一支的輸出變了。
- tioj 21_toj55_2：判決、輸出相同。
- AP325 3_10：換出來的 Python 裡有 `A = [0] * 200007`，Cella 的 Python 判決**丟例外**（Maximum call stack size exceeded）——cella 已認的 `[0] * N` 缺陷、在它的下一批；把長度改成 20 判得出 accept。
- tioj 21_d518_AC：探針問程式自己生的測資在一筆的中間就沒了；C++ 讀失敗照樣印、Python 丟 EOFError——看得見的那一種，同 1_11，不是失真。

## 後續：470（11-15）

- `cout << flush`：只送出、不印字 ⟹ 拿掉。印出來的內容兩邊相同，而 Python 的 `input()` 讀之前本來就會先送出 stdout；更貼字面的 `print(…, flush=True)` 是第一版，Cella 的 Python 判不出那個參數（unknown「the built-in print」）。只有 flush 的一句沒有任何一行，本體空了由 `py.block` 補 `pass`。
- `(int)v.size()`：無號的長度轉成 int 或更寬 → `len(v)` 照原樣。超過 2^31−1 要那個容器先裝得下二十億個元素——當作不會發生；short 不收（三萬多個就繞回），寫出來不是一個 `len(…)` 的無號值照實保留。
- 發現、沒在這一刀做：C++ 的替代拼法 `or`／`and` lift 成 arithmetic（身分錯）——要動 lift 與積木，另開一刀（471）。
