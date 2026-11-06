# Round-Trip 測試結果（C++）——類別外定義成員函式（元件管線 322）

2026-11-07。預期輸出以 `clang++ -std=c++17` 實跑取得。永久測試：`tests/integration/roundtrip-cpp-out-of-class-member.test.ts`（22 支）。

| # | 程式 | 元件 | 結果 | 細節 |
|---|------|------|------|------|
| rt_1 | 帳戶 | 建構子宣告／類別外定義（初始化列）、方法×3（含 const、回傳 bool） | ✅ PASS | Cella 原樣與 competitive 風格都等於 clang |
| rt_2 | 鏈結串列 | 建構子、解構子（釋放節點）、方法×3（回傳指標） | 🟡 形狀 PASS／執行釘住 | 執行卡在 `new Node{v, head}`：`cpp:new` 的引數是文字屬性（semorphe 這側的缺口，見下） |
| rt_3 | 多載 | 方法×3：`add(int,int)`／`add(double,double)`、本體裡隱含 this 的呼叫 | ✅ PASS | 鍵＝名字＋參數型別＋const，多載各自配對 |
| rt_4 | 回傳參照 | `int& Vec::at`、const 方法裡的迴圈、陣列欄位 | ✅ PASS（修了一個既有缺陷之後） | 見「發現的 Bug」① |
| rt_5 | 預設引數 | 預設引數寫在原型、參數與欄位同名、virtual 解構子 | ✅ PASS | 解構子倒序跑，與 clang 相同 |
| 短片段 1、2 | 六顆全用到 | — | ✅ PASS | 400 字以內，給反引號語料的護欄吃（`audit-declared-slots` 的「要看」6 → 0） |

摘要：5/5 形狀 PASS（元件身分、一字不差、再 lift 不漂移）；執行 4/5 PASS、1 支釘住（不是這一刀的缺口）。
信心分布：六顆新元件 raw_code 0。

## 發現的 Bug

### ① 類別裡的陣列欄位被建成名字叫 `a[5]` 的變數（既有缺陷，已修）

- 輸入：`class V { … int get(int i) { return a[i]; } private: int a[5]; };`（寫在類別裡的方法一樣壞——不是這一刀帶來的）
- 症狀：Cella 判 reject「use of undeclared identifier 'a'」。產碼文字照抄所以看起來對。
- 根因：`liftClassMember` 的一般欄位那條路把 `array_declarator` 的整段文字當名字。
- 修法：一維陣列欄位交給陣列宣告那顆（同區域變數那條路）；類別與 struct 的 formalize 對帶長度槽的欄位取它自己宣告翻出來的型別（`tArr`）；多維與帶初值的照實降級。

### ② `= default`／`= delete` 被建成空本體（既有缺陷，generate 階段已修）

- `~C() = default;` 產回去變 `~C() {}`；`= delete` 的話意思整個反過來。改成照實降級成原文。

### ③ 沒有名字的指標／參照參數（既有缺陷，generate 階段已修）

- `void link(B*);` 的星號消失（`B*` 讀成 `B`）。`parseParamDeclaration` 補 `abstract_pointer_declarator`／`abstract_reference_declarator`。

## 釘住的缺口（不在這一刀）

- `new T(…)`／`new T{…}` 的引數是文字屬性（`cpp:new` 照實標翻不出）——要升格成運算式槽，判準在〈元件代數〉「屬性的結構化邊界」。
  313 的盲測 fuzz_2、3、5、6 也卡在這裡。修好的那天 rt_2 的釘子會紅。
