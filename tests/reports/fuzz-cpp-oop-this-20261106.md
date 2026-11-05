# 模糊測試報告 — C++ 物件導向裡的 `this` — 2026-11-06

## 摘要
- 出題：隔離的代理（不知道 semorphe 的實作），10 支 medium 程式，主題「成員函式裡學生怎麼用 `this`」
- 預期輸出：本機 clang（`-std=c++17` ＋ 專案的標頭墊片）；10 支都編得過、跑得出
- **`this` 本身：10 支、104 處，零降級、再 lift 零漂移** ✅
- 產回去照樣編得過且輸出相同：6 支（fuzz_1、2、3、5、8、10）
- 找到的缺陷（都與 `this` 無關、本來就在）：**7 個，全修**（C、D 先修；A、B、E、F、G 在缺陷帳不准增加 todo 之後也修了）
- Cella 那一側：fuzz_5 accept 且輸出相同；fuzz_8 修好之後 accept 且輸出相同；其餘多為覆蓋缺口（類別裡的運算子多載、`string(...)`、gcd）

## 修好的
### 缺陷 C：`Rect("A", 3, 4)` 被送成呼叫函式（P6）——fuzz_8
建暫時物件（函式風格轉型）照 `eCall` 送，Cella 判「找不到 Rect 這個函式」——**一支合法的程式被說成錯的**。
修：`func_call` 的 formalize 認出名字是程式裡定義的類別／struct ⟹ 送 `eTemp`（cella 參照翻譯同形）；這一支要排在「名字指到變數」之前（作用域走訪把類別名解析到它自己的宣告）。

### 缺陷 D：建構子與方法的參數預設值——fuzz_7
- 產碼：共用的 `formatParams` 漏了一般函式那份早就有的「預設值要跟著印」——`Fraction(long long num = 0, long long den = 1)` 產回去少了 `= 0`、`= 1`（再 lift 漂移）。
- formalize：建構子照實標翻不出；**方法則靜靜送 `dflt: null`**——`p.g()` 這種依賴預設值的合法呼叫會被判「引數太少」。
修：兩處都補上，與一般函式同一個翻法（字面量照翻、其餘照實標翻不出）。

## 留著的（`it.todo`，附理由）
- **缺陷 A**（fuzz_4、6、9）：`class Account;` 前置宣告被產成空的定義 `class Account { };` → 重複定義（產碼編不過、Cella 判 redeclared）。要一個「只宣告、之後再定義」的概念（新元件或屬性），走元件管線。formalize 照 cella：之後有定義就省略、沒有就 `iClassDecl`。
- **缺陷 B**（fuzz_7）：`gcd`／`std::gcd`／`__gcd` 收成同一顆、產碼一律 `__gcd`——改了學生的字，而兩者意思不同（負數），libc++ 上編不過；這顆也沒有 formalize。要把「哪一個 gcd」做成屬性並補 formalize，走 component-refactor。

## 覆蓋缺口（不是缺陷：照實標翻不出）
- 類別裡的運算子多載（`operator+=`、`operator=`、`operator==`）——fuzz_1、2、7、10
- `string(...)` 建字串——fuzz_3

## 產生的回歸測試
- `tests/integration/fuzz-cpp-oop-this.test.ts`（十支的元件身分／零降級／不漂移、兩支 Cella 輸出、預設值的產碼與執行；2 個 todo）
- `tests/fixtures/fuzz-cpp-oop-this.json`（十支程式與 clang 的預期輸出）

## 後來也修了的（缺陷帳不准增加停用測試——留 todo 的計畫不成立，照「bug 必修」改成修）
- **A 前置宣告**：沒有本體的 `class X;`／`struct X;` 不再建成空的定義——照實降級，原文連同分號照抄（還沒有「只宣告」的元件；路線圖〈類別的前置宣告〉）。殘差率因此 0.32 → 0.34（更誠實的那一邊）。
- **B gcd**：只有 `__gcd` 進那顆元件；`gcd`／`std::gcd` 是一般的函式呼叫，原字照產（兩者意思不同）。
- **E 經過指標的 push**：盲測重產時才看到——`this->push(v)`、`q->push(3)`（自己的類別的方法）被認成「推入容器」，產回去 `this.push(v)`。經過 `->` 的呼叫不走容器方法的專屬身分。
- **F new 樣板型別**：`new vector<int>()` 的型別找不到就安靜變成 `int`（Cella 判「int * 不能轉成 vector<int> *」）——改讀 `type` 欄位，讀不到就讓開不猜。
- **G new 的空括號**：`new int()`（值是 0）產回去成了 `new int`（值未定）——記下空括號，產碼與 formalize 都照著做。
