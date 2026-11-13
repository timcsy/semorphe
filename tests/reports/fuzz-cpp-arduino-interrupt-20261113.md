# 模糊測試報告 — C++（Arduino）中斷旗標與中斷函式 — 2026-11-13

第 438 刀（`cpp:var_declare_volatile`、函式定義與原型的 `attribute = IRAM_ATTR`）的盲測。
出題者是一個**看不到原始碼**的子代理，寫了 8 支 Arduino sketch（uno 4、esp32 4），中斷由 `setup()` 直接呼叫處理函式來模擬。
執行判準是 Cella（該板子），不是 g++。

## 摘要

- 產生的程式數：8
- 翻得過去且 Cella accept、輸出相同：1（fuzz_3）
- 翻得過去、Cella 誤判 `uint8_t` 未宣告（已知，等 cella 11-13 那一版）：2（fuzz_6、fuzz_8）——換成 `unsigned char` 之後 accept、輸出相同
- EXPECTED_DEGRADATION（降級的那段原文一字不丟，Cella 照實收不到）：5（fuzz_1、2、4、5、7）
- SEMANTIC_DIFF／COMPILE_FAIL／ROUNDTRIP_DRIFT：0（修完之後）
- 找到並當場修好的 bug：2（盲測）＋ 1（瀏覽器驗收）
- `it.todo`：0

⚠️ fuzz_3 的期望輸出是出題者手算錯的（`handleButton` 裡先印 `reject#1`，`setup` 才印「120 skip」）；測試裡用的是改正後的那一份。

## 發現的 Bug（都已修）

### Bug 1：`IRAM_ATTR void f() {…}` 的回傳型別被讀成「IRAM_ATTR void」

- **輸入**（fuzz_2）：`IRAM_ATTR void pushSample(int v) { … }`——屬性寫在回傳型別**前面**（ESP32 的範例兩種寫法都有）
- **語義樹**：`cpp:func_def { return_type: "IRAM_ATTR void" }`——積木的型別欄寫著一個不存在的型別，formalize 翻不出（「型別『IRAM_ATTR void』還沒有對應」）
- **根因**：解析器把 `IRAM_ATTR` 當型別，真正的回傳型別掉進一個 ERROR；回傳型別取「宣告子之前那一整段原文」，於是兩個黏在一起。
  `IRAM_ATTR uint8_t f()` 又是另一個形狀（名字變成 `uint8_t::f`，被當成類別外定義而整段降級）。
- **修法**：先是 `cpp:liftFunctionDef` 認這兩種形狀；之後（Bug 3）改成樹修復擦掉巨集重解——回傳型別就是解析器讀到的那一個，屬性記在 `attribute`。
  產回去統一寫成 `void IRAM_ATTR f()`（同一支程式；文字不同而行為相同）。

### Bug 2：中斷函式的原型 `void IRAM_ATTR f(…);` 整段降級

- **輸入**（fuzz_8）：`void IRAM_ATTR encoderISR(uint8_t a, uint8_t b);`，定義寫在 `loop()` 之後
- **語義樹**：`raw_code`（`degradedFrom: cpp:forward_decl`，語法錯誤的安全網）——名字是補了 `::` 的限定名，前置宣告那條路找不到識別字就落到 `'f'`，產碼不保字，安全網把它換成原文
- **影響**：誠實（原文沒丟），但整支程式交不了 Cella
- **修法**：`cpp:forward_decl` 加屬性 `attribute` 與形態 `cpp_forward_decl_IRAM_ATTR`（軸 `attribute`，同 `cpp_func_def_IRAM_ATTR`）；
  三種寫法（`void IRAM_ATTR f(…);`、`IRAM_ATTR void f(…);`、`IRAM_ATTR uint8_t f(…);`）都由同一條樹修復處理。formalize：板子上照一般原型（不產生程式），不在板子上照實翻不出。

### Bug 3（瀏覽器驗收抓到）：合法的中斷函式被標成「程式碼含語法錯誤」

- **輸入**：任何一支有 `void IRAM_ATTR f()` 的 sketch——積木對了、程式碼一字不差、Cella 判 accept，**而兩顆中斷函式積木都掛著 ⚠「程式碼含語法錯誤／系統推測」，編輯器也畫紅線**
- **根因**：Bug 1／2 的修法是在 lift 裡逐一認那幾種歪掉的形狀——**認得出意思，擦不掉解析器留下的 ERROR**；
  信心標記（`lifter.ts` 的 `setConfidenceHigh`）看到子樹裡沒人認領的 ERROR，就把那顆標成 `syntax_error`，診斷通道與積木的警告都讀它。
  測試全綠是因為它們只問「身分與產出對不對」，沒有問「有沒有被標成語法錯誤」
- **修法**：改走樹修復（`misparse.ts` ⑤）——把 `IRAM_ATTR` 換成等長空白重解、照常 lift、屬性記回 `attribute`；修過的那段 ERROR 由樹修復登記為已認領。
  Bug 1／2 在策略裡的逐形狀分支一併收掉（同一件事只留一個家）。`arduino-types-isr` 六種形狀都加斷言「沒有 `syntax_error`、信心 high」——拿掉修復時 6 支紅

## 覆蓋缺口（EXPECTED_DEGRADATION，誠實降級）

volatile 只收「單一宣告子、`volatile` 寫在最前面、簡單型別」。下面這些照原文降級（`volatile` 一個都沒丟——測試逐支數過）：

| 形狀 | 出現在 | 學生會不會寫 |
|---|---|---|
| `volatile int buf[N];`、`volatile bool pending[4] = {…};` | fuzz_2、7 | 會（中斷用的環形緩衝區） |
| `volatile int a = 0, b = 0;` | fuzz_1 | 會 |
| `static volatile long counts[3]` | fuzz_4 | 偶爾 |
| `int volatile x;`（修飾詞在型別後） | fuzz_1 | 少 |
| `volatile int * volatile p`、`const volatile int` | fuzz_5 | 少 |
| `void (*handlers[3])() = {…};`（函式指標陣列，與 volatile 無關） | fuzz_4 | 少 |

→ 最值得做的下一步是 **volatile 陣列**（環形緩衝區是中斷程式最常見的形狀），已列進進行中檔的候選。

🟢 **439 已做**：`volatile T a[N]`（含初值列表、指標陣列）走陣列宣告那顆，`volatile` 住進元素型別（與 `const` 同一條路），送 Cella 時在型別那一層去掉。fuzz_7 整支 accept；fuzz_2 剩 `uint8_t` 的已知缺口。
順手修掉同一區的一個靜默缺陷：`static int a[3];` 原本 lift 成 `static int x;`（名字換成 x、陣列不見、high 信心），`static int *q = 0;` 的名字記成 `*q`——兩者改成照原文誠實降級。

🟢 **440 已做**：`volatile int a = 0, b = 0;`（多宣告子，照 const 那一族）與 `static volatile T x`（靜態變數那顆、volatile 住進型別）。fuzz_1 剩 `int volatile x;`（修飾詞在型別後）。
又抓到同一區一個既有的靜默缺陷：`static int s1 = 1, s2 = 2;` 在 lift 時只讀第一個宣告子，`s2` 蒸發——改成每一個都讀。
⚠️ 走一趟積木時多宣告子會拆成一行一個——與 const 那一族同一個既有行為（意思不變、文字不同）。

## 產生的回歸測試

- `tests/integration/fuzz-cpp-arduino-interrupt.test.ts`（16 支）：8 支程式各兩條——①lift 不丟字、產碼是不動點、`volatile`／`IRAM_ATTR` 的次數與原文相同、降級的就是那幾段；②交給 Cella（accept／已知缺口釘子＋換型別驗行為／照實 untranslated）
- `tests/integration/arduino-types-isr.test.ts` 加 7 支：屬性的兩種位置 × 定義與原型，走真積木來回、不得被標成語法錯誤
