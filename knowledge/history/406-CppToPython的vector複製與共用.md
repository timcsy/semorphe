# 406：C++ → Python 的 vector——複製的地方寫成複製，共用的地方才共用（447）

**之前**：C++ → Python 只量 cpp-beginner（64 支換過去 62）。cpp-advanced 22 支只換得過去 3 支，最常見的原因是容器、`vector<int>&` 參數、`max`。量的時候順手找到一個**靜默失真**：`vector<int> b; b = a;` 換出來是 `b = a`——Python 的 b 與 a 是同一個 list，之後改 b 會改到 a（C++ 印 `1`、Python 印 `5`，兩邊都 accept）。cpp-beginner 的課文沒有這種寫法，護欄抓不到。

**之後**：
- **複製寫成 `list(…)`**：vector 的指定、用一個運算式初始化 vector、把 vector 推進另一個 vector、以值走訪裝 vector 的容器（本體第一行 `row = list(row)`）。
- **共用的地方照原樣**：`vector<T>&`／`const vector<T>&`／`const vector<T>` 參數換成一般參數——Python 的 list 傳進函式本來就是同一個。只有一件事兩邊不同：函式裡**整個重新指定**那個參數（C++ 複製進呼叫端那一個，Python 只換掉函式裡的名字），有就照舊保留；傳值而且不是 const 的也照舊保留。
- **`vector<vector<T>>`**：空的寫成 `[]`；給個數寫成 `[[] for _ in range(n)]`（`[[]] * n` 會讓每一格是同一個 list）。
- **`max`／`min`**：直接換。相等、`-0.0`、NaN 時兩邊回傳的都是同一個（C++ 只在 b 嚴格較大時回 b，Python 只在後者嚴格較大時換）。
- 判決護欄每門課一組，cpp-advanced 進來：22 支換過去 7 支（棘輪下限 7），判決、輸出、assumes 都相同，走 Python 積木一趟回來一字不差。手寫 10 條（8 條換過去且判決相同、2 條照實保留）。

**順手量到 Cella 的誤判**：`vector<int> h(vector<int>& a) { return a; }` 被 Cella 當成隱式搬移，呼叫端的 a 變空，之後 `a[0]` 判越界 reject（g++ 印 1）。隱式搬移只適用區域變數與傳值參數。已回報，cella 確認、排 11-14 白天修。

**為什麼這樣做**：互轉的判準是 Cella 判決相同，而 vector 的複製與共用正是兩個語言「長得一樣、意思不同」的地方——P6 要求意思會變的地方不能靜默。逐個位置問「C++ 這裡是複製還是參照」，複製就寫出複製，比整類保留換得過去的多，也比一律 `list()` 少一層多餘的複製（參照參數本來就該共用）。
