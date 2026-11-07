# 模糊測試報告 — C（c-bridge 學生會寫的 C）— 2026-11-07

出題的代理不知道 semorphe 的實作；10 支程式（`tests/fixtures/fuzz-c-bridge.json`）都用 `gcc -std=c11`（本機為 Apple clang 16）編得過、跑得出確定的輸出。
驗證：lift → 產碼（C 風格＋補丁器）→ gcc 編譯執行比輸出、再 lift 比語意樹、原文與產出各交 Cella（lang c）。

## 摘要

| | 修之前 | 修之後 |
|---|---|---|
| PASS（輸出相同、不走樣、無降級） | 4 | 4 |
| DEGRADED（照原文降級，輸出相同） | 2 | 6 |
| **COMPILE_FAIL**（產出的是另一支程式） | **4** | 0 |
| ROUNDTRIP_DRIFT | 2 | 0 |
| SEMANTIC_DIFF | 0 | 0 |

降級變多是對的：原本「看起來接住了、其實改寫了」的那幾句，現在照原文保留並且說出來（P6）。

## 抓到的靜默改寫（全部是 main 上就有的，已修）

| # | 原文 | 產出（修之前） | 原因 | 修法 |
|---|---|---|---|---|
| 1 | `typedef struct { int x, y; } Point;` | `typedef Point mytype;` | typedef 的原型別不認 `struct_specifier`，別名找不到就**編一個 `mytype`** | 帶本體的照原文降級；不再編名字 |
| 2 | `typedef struct Node {…} Node;` | `typedef Node mytype;` | 同上 | 同上 |
| 3 | `typedef int (*binop)(int, int);` | `typedef int mytype;` | 別名包在 function 宣告子裡找不到 | 函式指標／陣列 typedef 照原文降級；`typedef int *P;` 照實支援 |
| 4 | `void fill(int m[ROWS][COLS])` | `void fill(int COLS[])` | 巢狀 array_declarator 外層的直接子 identifier 是**最後一維的大小** | 一層層剝開；第二維以後的大小留著（`int m[][COLS]`） |
| 5 | `void map(Node *h, int (*f)(int))`、`int row_sum(int (*row)[COLS], int n)` | `void map(Node* h, int)`、`int row_sum(int[], int n)` | 函式指標／帶括號的宣告子參數不在候選裡 | 整段照原文當型別 |
| 6 | 使用者定義的 `map(head, twice)` | `map(head, twice, , , )`（`cpp:range_remap`） | 呼叫元件表（Arduino 的 `map`）沒有先問「使用者自己定義過嗎」——同一個病修過一次（`swap`），擋在另一條路上 | 呼叫元件表也先問 `hasFunction` |
| 7 | 區域的 `int (*row)[COLS] = m;` | `(int)*row[COLS] = m;` | tree-sitter 把宣告剖成「函式式轉型再取下標」 | misparse ⑤：依 [stmt.ambig]，照原文降級 |

## 還在的（誠實的，不是改寫）

**翻不出交給 Cella 的程式（formalize 的缺口，照實回 untranslated）**——這是下一批要補的：
- 帶本體的 `typedef struct {…} Name;`（C 最常見的寫法——**完整支援排成下一刀**，要在 struct 的積木上加別名那一格）
- 函式指標：typedef、參數、陣列（fuzz_6、fuzz_10）
- `sizeof(*g)`、`sizeof(char *)` 這類對象（`cpp:sizeof` 的對象還是文字屬性）
- `enum` 常數的值是運算式（`F_ALL = F_READ | F_WRITE | F_EXEC`）
- 函式形巨集在運算式位置（`SQUARE(x + 1)`）
- `char word[] = "stressed";`（長度由字串初值算）
- `union`、`goto`、多維陣列參數的型別

**Cella 那一側**：`4[arr]`（C11 6.5.2.1：`E1[E2]` 等同 `(*((E1)+(E2)))`，下標兩邊可以對調）被判 reject「subscripted value is not an array or pointer」——已回報，`knownCellaGap` 釘住。

## 永久測試

`tests/integration/fuzz-c-bridge.test.ts`（18 支）：10 支各自「來回不走樣、原文與產出交給 Cella 的結果相同」＋ 7 個缺陷各一條精確斷言 ＋ `4[arr]` 的釘子。
自我否證：拿掉 typedef 與 map 兩條修正，3 支紅。

`it.todo`：0。
