# 模糊測試報告：C／C++ union（2026-11-08，元件管線 345）

## 摘要
- 出題：資訊隔離的代理（不知道實作），8 支（C 6、C++ 2），全部用 gcc／g++ 編得過、輸出確定
- 判準：產出的程式與走一趟積木的程式，拿 gcc／g++ 跑的輸出和原文相同；lift → 產碼 → 再 lift 同一棵
- 修之前：5 支輸出相同、**3 支產出的程式編不過**（其中 1 支是探針沒走 auto-include 修補，不算缺陷）
- 修之後：**8／8 輸出相同**、0 走樣
- 永久測試：`tests/integration/fuzz-cpp-union.test.ts`（12 條）、程式 `tests/fixtures/fuzz-cpp-union.json`

## 發現的缺陷（都修了）

### 1. `case X: { … }` 的大括號被展平（fuzz_6）——既有缺陷，與 union 無關
`case OP_ADD: { int b = stack[--sp]; … break; }` 的大括號是一層作用域。核心展平 compound 時只把「父節點也是 compound」的當獨立區塊，
case 底下的不算 ⟹ 兩個 case 各宣告一次 `int b`，C 的標籤後面也不能直接接宣告 ⟹ 編不過。
修：`core/lift/lifter.ts` 的判準多認 `case_statement`。
⚠️ 產出的 `{` 自成一行、本體沒有多縮一層（`cpp:block` 的產碼，獨立區塊也一樣，既有）——351 修了（展平判準多認頂層的 translation_unit，見 history/349）。

### 2. 結構裡的匿名 union 成員被編上名字 `x`（fuzz_8）
`struct Packet { char kind; union { int code; char flag; }; };` → `union {…} x;`，`p.code` 從此不存在。
落到一般欄位、名字缺了就用預設 `'x'`——「多層 fallback 用同一個預設值」那個老毛病。
修：沒有宣告子的匿名 union／struct 成員照原文降級（`liftClassMember`）。

## 覆蓋缺口（照實翻不出／降級，沒有改意思）
| 構造 | 支 | 現況 |
|---|---|---|
| 有名字的成員、型別是匿名 union（`union { … } v;`） | 1、6 | 形狀保留、formalize 翻不出（要問 Cella 匿名的 sdef 怎麼送） |
| `typedef enum { … } Kind;` | 3、4、6 | 整句照原文降級（同 341 之前的 typedef struct；enum 那顆沒有另名格） |
| `sizeof a.bytes`（成員運算式） | 2 | sizeof 的對象是文字屬性，運算式還沒升格成槽 |
| `enum class` ＋ `Tag::Int` | 7 | 照原文 |
| 結構裡的匿名成員 | 8 | 照原文（上面的修正） |

## 其他
- fuzz_5：Cella 判 unknown（orderUncompared，函式呼叫引數的求值順序），原文與產出相同
- 走一趟積木與直接產碼的文字差兩處（`*` 的位置、三元條件外多餘的括號），不改意思
