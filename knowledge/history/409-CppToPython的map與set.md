# 409：C++ → Python 收下有序的 map 與 set，修 `x += 2.5` 的截斷（450）

**之前**：cpp-advanced 22 支換過去 8 支。剩下的 14 支裡，pair（08）還卡在 sort，bisect、collections、heapq 都要等 Cella 的 Python 支援。不必等 Cella 的是 04 那兩支：map 計數、兩個 set 取交集。

**之後**：
- **有序的 map → dict、set → set**：走訪時包 `sorted(…)`，因為 C++ 照鍵由小到大走，Python 的 dict 照放進去的順序，set 沒有順序。map 每一圈拿到的是一對 → `(k, v)` 的 tuple，`.first`／`.second` → `[0]`／`[1]`；結構化繫結 `auto [k, v]` → `for k, v in …`。
- **讀 `m[k]` → `m.setdefault(k, 預設值)`**：C++ 讀一個沒有的鍵會先補上預設值，之後走訪看得到它；Python 的 dict 會丟 KeyError。`setdefault` 同樣補上、同樣回傳那一格。
- **先讀再改（`m[k]++`、`m[k] += v`）**：先補一句 `m.setdefault(k, 0)`、再 `m[k] += 1`。鍵因此寫兩次，所以只收算兩次也一樣的鍵（變數、字面量）；`m[f(1)]++` 照實保留。
- 為此契約多一個 **`target(n, readsFirst)`**：一顆節點當指定目標時怎麼寫，由膠囊登記（map 的元素、pair 的成員）。`=`、`+=`、`++`、`cin >>` 的左邊都改走它。沒登記的照運算式寫，所以既有的元件不受影響。pair 的成員登記成「保留」，因為 tuple 改不了。
- **複製**：`b = a`、`map<…> b = a` → `dict(…)`／`set(…)`（同 447 的 vector）。
- **`count(k)` → `int(k in m)`**。
- **鍵只收整數與字串**：std::string 逐位元組比較，就是 UTF-8 的碼位順序，與 Python 的字串比較相同。char 有正負號，大於 127 的字元兩邊順序不同；浮點有 NaN。這兩種都不收。unordered／multi、以非 const 參考走訪 map，也都保留。

**量的時候找到兩個靜默失真**（兩邊都 accept、輸出不同）：
- `int x = 1; x += 2.5;` 之前換成 `x += 2.5`：C++ 印 4，Python 印 5.25。這是 450 之前就有的問題。改成 `x = int(x + 2.5)`（[expr.ass]p7：`E1 op= E2` 就是 `E1 = E1 op E2`，結果再轉回 E1 的型別）。
- `map<string, int>` 的 `ii["a"] = 2.7` 要截斷，而 Cella 不給這一句型別。改由宣告那一顆記下值型別（`noteElementType`）；同一個名字宣告過兩種值型別時當作不知道，值是浮點就保留。

**卡在 Cella 的一條**：裝字串的 set 經 `sorted` 走訪，輸出與雜湊順序無關，Cella 仍附 `str.hash` 的假設，判決因此與 C++ 不同。`set<string>` 先照實保留，所以 04 make 這次沒換過去。最小重現已交 cella，收進他們的驗收案例，排在 11-14 晚上到 11-15 那一輪：只在順序真的被看到時才附（經 sorted／len／in／sum 不附）。推上後 04 make 換過去、下限 9 → 10；Python → C++ 的 09/rebuild 卡的也是這一條，同時解開。

cpp-advanced 8 → 9/22（04 ex1），棘輪下限 9。手寫 9 條：4 條換過去且判決相同，5 條照實保留。

**為什麼用 setdefault 不用 defaultdict**：`collections.defaultdict` 與 C++ 的 `operator[]` 同義，`m[k] += 1` 也不必特別處理，是最貼的寫法；可是 Cella 的 Python 還不支援 `collections`（407 的 deque 同一件事）。setdefault 是內建的，判決證明得了。Cella 支援 collections 之後可以再換。
