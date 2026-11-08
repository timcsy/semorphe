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
