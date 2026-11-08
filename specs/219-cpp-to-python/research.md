# Research：C++ → Python（spec 219）

## R1 · 今天切目標 C++ → Python 產出什麼

- **量到**：C++ 的語意樹直接用 Python 的語言參數產碼 → `⟨unknown component: cpp:program⟩`（探針，cpp-beginner 10 課 ex1）。
  app 的換目標流程（`app.ts` 切目標那段：`setActiveGrammar`／`setLanguage`／`setTopic` 之後重產）**不換樹**，只換語言參數。
- **Decision**：換寫法是**樹上的改寫**（C++ 元件 → Python 元件），在重產之前做；做不到就保留 C++ 程式不動（不進 Python 的投影）並說原因。
- **Rationale**：同第一對——語言套件提供換法，app 只負責問型別、寫回兩個投影、說結果。

## R2 · 換法放在哪

- 第一對的入口是語言套件的 `convertBetweenStyles(tree, from, to, types)`，只在**同一個語言套件裡**換風格時被呼叫（`app.ts` 的 `convertAfterStyleChange` 用的是**換之後**那個語言的套件）。
- **Decision**：語言套件多一個可選的 `convertToLanguage(tree, toLanguage, types)`，由**來源語言**的套件提供；app 在換目標時若語言變了，就問來源語言的套件。
  回傳形狀與 `convertBetweenStyles` 相同（`{tree, converted, kept}`）再加**保留原因清單**（跨語言時整支換或不換，見 R5）。
- **Alternatives**：放在 Python 套件裡（「我收得下什麼」）——被否決：要懂 C++ 元件的是 C++ 那一側，Python 套件不該認得 `cpp:*` 的身分（P9 的方向）。
  放在核心——被否決：核心不認識任何語言的元件。

## R3 · 第一刀的子集（量出來的）

cpp-beginner 66 支解答用到的元件（出現在幾支）：

```
program 66 · func_def 66 · print 66 · endl 66 · return 66 · literal_number 66 · var_ref 62 · var_declare 45 · arithmetic 40
compare 27 · literal_string 26 · var_assign 22 · input 21 · if 21 · loop_count 17 · include 16 · using_namespace 16 · loop_while 11
param_decl 8 · func_call 8 · break 6 · builtin_constant 5 · vector_size 5 · literal_char 4 · array_at 4 · string_declare 4 · logic 3
array_declare 3 · string_at 3 · vector_declare 3 · container_append 3 · array_2d_declare 3 · array_2d_at 3 · math_unary 2
var_assign_compound 2 · continue 2 · initializer_list 2 · math_pow 1 · logic_not 1 · increment 1 · random_seed 1 · time 1
random_next 1 · array_assign 1 · string_size 1 · loop_range 1
```

- **Decision**：第一刀接前 25 種左右（到 `logic`），涵蓋多數解答；其餘一律「子集以外 ⟹ 整支保留」。
  `random_*`／`time` 不換（輸出依賴種子，判決不會相同）。
- Python 那側有 99 顆元件（`src/components/python/`），對應的 print／input／var_assign／if／loop_while／loop_for／range_make／func_def／return／container_* 都在。

## R4 · 意思會變的地方，各自的決定

| 構造 | C++ | Python | Decision |
|---|---|---|---|
| 整數除法 `a / b` | 向零截斷 | `//` 向下取整 | 換成 `int(a / b)`——C++ 的 int 是 32 位元，`a / b` 的浮點商在 2^53 以內精確，向零截斷與 C++ 相同（**不換成 `//`**） |
| 取餘數 `a % b` | 正負號跟被除數 | 跟除數 | 只在**與 0 比較**（`a % b == 0`／`!= 0`）時換——正負號不影響是否為 0；其餘保留（原因：負數取餘數） |
| 整數溢位 | 未定義行為 | 不會溢位 | 有溢位的程式 Cella 本來就判 reject 或帶 assumes ⟹ 判決不會相同、自然保留；沒溢位的路徑上兩邊意思相同（C++ 在溢位處無定義，Python 給的是數學上的值，不是另一個「被定義的不同結果」） |
| `char` 參與運算 | 整數 | 字串 | 保留（原因：char 運算）；只印出的字元字面量換成長度 1 的字串 |
| 浮點輸出 | `cout` 預設 `%g`、6 位有效 | `print` 印 repr | `cout << x`（double）換成 `print(f"{x:g}")` 那一段——`:g` 與 `%g` 同一套規則；整數照印 |
| 輸入 | `cin >> a >> b` 跨行、跨空白都讀得到 | `input()` 一次一行 | 一句 `cin >> a >> b;` 換成讀**一行**再拆（`a, b = map(int, input().split())`）——**假設**輸入照題目的行來給（課文的 `check.stdin` 都是）；判決時用課文的輸入驗。一句讀進陣列的迴圈（`for … cin >> a[i]`）換成整行拆成 list。⚠️ 換法在提示裡說出這個假設 |
| `endl` | 換行＋flush | `print` 預設換行 | `cout << … << endl` 一句 → 一個 `print(…)`；中間沒有 endl 的 cout 鏈 → `print(…, end="")` |
| 指標、類別、樣板、子集以外的 STL | — | — | 整支保留（原因列出那幾行） |

## R5 · 換或不換的單位

- **Decision**：整支程式（FR-005）——Python 程式裡不能留一行 C++。有任何一處要保留 ⟹ 整支維持 C++、不切語言投影，說出卡住的行與原因。
- **Rationale**：第一對能逐行保留，是因為 C 與 C++ 同一個文法；跨語言不行。

## R6 · 判準與驗收

- Cella 的 Python 家族（`runCella(code, { lang: 'python' })`，python-beginner 課文在用）是唯一的判準。
- 護欄 `cpp-to-python-verdict`：cpp-beginner 66 支解答 → 換或保留；換了的兩邊判決、輸出、assumes 相同（同一份課文 `check.stdin`）；保留的每一支有原因。
- experience〈翻不出是一層遮罩〉：每讓一類構造換得過去，重判之前保留的那幾支，看新出現的不同。

## R7 · （實作時改）換法產出 Python **原始碼**，由 Python 自己的 lift 畫積木；每顆 C++ 元件的印法住在它的膠囊

- **量到（T001）**：Python 的元件幾乎都是 JSON 宣告的 lift，TS 建構子只有 `literal_string` 一顆——直接組 Python 語意樹要先補二十幾個建構子。
- **Decision**：`convertToLanguage` 回傳 `{ code, converted, kept, reasons }`；app 照第一對的寫回法（放進編輯器、以程式碼為準重畫積木）。
  每顆 C++ 元件「怎麼寫成 Python」放在它自己的膠囊 `src/components/cpp/<名>/to-python.ts`，由 `src/languages/cpp/to-python/registry.ts` 用 `import.meta.glob` 收（同 formalize 的收法）。
- **Rationale**：① Python 的 lift 是現成的、而且是第二道檢查——換出來的碼 lift 不回乾淨的 Python 樹，就是換法錯了；
  ② 印法依身分分派，放在膠囊裡才不會讓共用檔寫滿 `cpp:*`（就近性護欄）；③ 判決比對本來就是兩份原始碼交給 Cella。
- **Alternatives**：直接組 Python 樹（要先補建構子、而且是第二份「Python 長什麼樣」的知識）；在共用檔用一張大表分派（身分擴散）。

## R8 · （實作時量到）兩個修正

1. **輸入：「一句讀一行」對不上課文**——課文的 `check.stdin` 一個數一行，`cin >> a >> b >> c` 跨行讀；換成 `map(int, input().split())` 的兩支 ValueError。
   改成同 cin 的讀法：檔頭補一個 `next_token()`（跨行讀一個以空白分開的詞），每個讀入的變數 `x = int(next_token())`。不道地，但意思相同；R4 的假設撤回。
2. **Cella 的型別表對 C++ 的比較與邏輯運算式回報 `int`**（C++ 標準是 `bool`，`int` 是 C 的規則）——`cout << (a > 5)` 照型別表會被當成整數照印，Python 印出 `True`。
   比較、邏輯、`not` 三顆元件自己宣告 `yieldsBool`，印的時候包 `int(…)`，不靠型別表；同時回報 cella。
3. `sum / v.size()` 的型別是 `unsigned long`（int 被轉成無號）——負數時 C++ 繞回（有定義的行為）、Python 不會 ⟹ 保留（`division`）。

## R9 · （365）第三刀：二維陣列、sqrt／abs、pow、範圍 for、陣列元素指定、string 參數

- 二維陣列 → `[[0] * C for _ in range(R)]`（每一列各自一個 list；`[[0] * C] * R` 會讓每一列是同一個 list）。
- `sqrt` → `math.sqrt`、`abs`／`fabs` → `abs`、`pow(a, b)` → `a ** b`（印法照 Cella 的型別：double ⟹ `format(…, "g")`）。
  ⚠️ **已知差異**：`sqrt` 的負數——C++ 得 nan、Python 丟例外。判決只在給定的輸入上證明相同；第一版接受（課文的程式沒有開負數的平方根）。
  `floor`／`ceil` 不換：C++ 回傳浮點、Python 回傳整數，後續運算會不同。
- 範圍 for 以值走訪 → `for x in v`；以參考走訪（`int& x`）照舊保留。
- string 以值或 const 參考傳 → 照傳（Python 的字串不能改，兩邊意思相同）。
- 🔴 `s[0] = 'z'` 也是「陣列元素指定」那一顆——接上它時差點把改字串字元的程式換過去（Python 的字串不能改）；反例抓到，元素是 char 時保留。
- 量到：cpp-beginner 64 支換過去 52／保留 12（取餘數 11 筆、子集以外 6 筆、除法 1 筆）。
