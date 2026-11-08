# Research: Python → C++（第一版）

> 2026-11-09。量測：python-beginner 36 支解答的元件分佈（下表），型別表形狀與 cella 談定（spec 背景）。

## 量到的子集

36 支裡 27 支（01～08、10）只用：program、print、var_assign／var_ref、literal、arithmetic、input、cast、compare、logic、if、loop_while、loop_for＋range_make、break、清單（array_make、append、at、assign、size、sum）、max／min、函式（func_def、return、func_call、param_decl）、`print(…, end=…)`（func_call_named）。
09（字典與集合）、11（例外）、12（文字處理）共 9 支——第一版保留並說原因。

## R1 · 型別從哪來

- **Decision**：Cella `python.observedTypes(我們的程式 JSON, 輸入, 步數)`；鍵是我們的節點 id。只用 `basis = observed` 而且單一（不含 `|`、`?`）的型別。
- **為什麼不自己推**：「意思歸 Cella」（vision）；而且自己推的型別在 `x = input()` 之後就斷了。
- ⚠️ 型別只對這一份輸入成立（觀察，不是證明）——提示要說。

## R2 · 宣告放哪裡（作用域）

- Python 的作用域是函式；C++ 是區塊。`if` 裡第一次指定、`if` 外用到的變數，照原位宣告會在 C++ 看不到。
- **Decision**：每個函式（與最外層）用到的區域變數**提到那個函式的最前面宣告**（不給初值——讀到未指定的值時 Cella 會判 ubUninit，那等於 Python 的 NameError 被照實揭露），其餘的指定都是一般的指定。
- 同一個名字在一個函式裡被觀察到兩種型別（含讀取）⟹ 不換（R1）。

## R3 · 換完之後再判一次（與 219 不同的地方）

- 219 是看**來源**的判決（C++ 的溢位）決定保留；這一對的意思差異（Python 整數沒有上限 → C++ 溢位）只在**換出來的程式**才看得到。
- **Decision**：產品流程是 Python 判一次（拿型別表）→ 換 → **C++ 判一次** → 判決、輸出、assumes 與 Python 那次相同才放進編輯器；否則退回、說出原因（「換過去之後在這份輸入上不一樣：…」）。判準就是 Cella，不是我們宣稱。
- 整數用 `long long`（Python 的整數沒有上限；`long long` 溢位由 C++ 那次判決抓）。

## R4 · 會變意思的運算

| Python | C++ | 證明 |
|---|---|---|
| `a / b`（整數） | `(double)a / b` | 判決 |
| `a // b`、`a % b`（整數） | 程式開頭補兩支小函式 `floor_div`、`floor_mod`（向下取整，照 Python 的定義） | 判決 |
| `**` | 第一版保留 | — |
| 字串 `+` | `std::string` 的 `+` | 判決 |
| 字串 `*`、切片 | 第一版保留（切片 `container_substr` 用到 1 支） | — |

## R5 · 印出

- `print(a, b)` → `cout << a << " " << b << "\n"`；`end=` 照給的字串；`sep=` 照給的。
- **印浮點數保留**：Python 的 `repr`（最短而能回推的寫法，`2.0`）與 `cout` 的預設（6 位有效數字，`2`）不同，C++ 沒有簡單的等價寫法 ⟹ 第一版保留（型別表說那一格是 float 就保留）。
- 印 `True`／`False` → `boolalpha` 會印 `true` ⟹ 印成 `(x ? "True" : "False")`。
- 印清單 → 保留。

## R6 · 讀輸入

- `input()` 讀**一行**；`cin >> x` 讀**一個詞**。
- **Decision**：`input()` → 一支補在開頭的 `read_line()`（`getline`）；`int(input())` → `stoll(read_line())`、`float(...)` → `stod(...)`。行的語意與 Python 相同；輸入不合法時兩邊不同（Python ValueError、C++ 例外／部分讀）——由 R3 的判決比對抓。

## R7 · 輸入從哪來（產品）

課文題目的 `stdin` → 學生最近一次執行的輸入（「重播上一次」那份）→ 都沒有而程式讀輸入：不換，說「需要一份輸入才知道型別」（不拿空輸入觀察——會把後面標成沒跑到，假的資訊；cella 談定時的理由）。

## R8 · 迴圈與函式

- `for i in range(a, b, s)` → 計數 for（`s` 是負數時條件換成 `>`；`s` 不是字面量 → 保留）；`for x in xs` → `for (T x : xs)`。
- 函式：參數型別取呼叫時觀察到的、回傳型別取 return 那一格；沒呼叫過（unreached）或兩種型別 → 不換。

## R9 · 換法住在哪

對稱於 219：Python 膠囊各自的 `to-cpp.ts`（`r.expr`／`r.stmt`），引擎 `src/languages/python/python-to-cpp.ts`，經 Python 語言套件的 `convertToLanguage`。產出原始碼交給 C++ 的 lift 畫積木。
