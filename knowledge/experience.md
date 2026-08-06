# 經驗

從 Semorphe 開發中蒸餾出的教訓——理論與實作碰撞後留下的東西。完整的因果軌跡在 [history/](history/)，完整的除錯現場在 [episodes/](episodes/)。

## 教訓

### 型別分裂在「兩邊都能跑」時最危險

- **理論說**：根公理定義了 SemanticNode 的標準形式，實作照著寫就好。
- **實際發生**：同時存在兩套不相容的 SemanticNode 定義（`children` 一個是 `SemanticNode[]`、一個是 `SemanticNode | SemanticNode[]`）。TypeScript 的 structural typing 讓聯合型別在某些用法下相容，**靜態檢查不報錯**，問題直到 runtime 才爆炸。interpreter 因此塞滿 `as SemanticNode` 斷言和 `Array.isArray()` 判斷。
- **解決方式**：統一為單一定義（陣列版 children），刪除 `semantic-model.ts`，工具函式遷入 `semantic-tree.ts`，約 15 個檔案的 import 更新 + 所有測試重寫。
- **教訓**：型別分裂是漸進開發的自然結果，關鍵是**發現時立刻統一，不要因為「兩邊都能跑」就容忍共存**。structural typing 會隱藏不一致，必須靠 review 或定期掃描發現。
- **來源**：[history/001-兩套-semanticnode-型別統一.md](history/001-兩套-semanticnode-型別統一.md)

### R0 雙射是設計目標，不是工程現實

- **理論說**：P1 定義 blocks 投影為 R0（雙射），`lift(project(T)) ≡ T`，投影是純函數。
- **實際發生**：Blockly 有大量有狀態的副作用——動態積木的 FieldDropdown 選項來自即時掃描 workspace（不是 `project(tree)` 能覆蓋的）、mutator 的 `decompose()`/`compose()` 生命週期由 Blockly 控制、積木的視覺狀態和語義資訊被框架混在一起。
- **解決方式**：承認投影不純但確保語義層等價——用 `const self = this` 把 workspace 狀態注入投影過程；用 `extraState` 補語義樹與積木之間的間隙；把反向過程命名為 `extractBlockInner()` 而非 `lift()`，在命名上承認它不是理論中的純投影反函數。
- **教訓**：在第三方 UI 框架中，投影管線必須適應框架的狀態模型。**正確做法是確保 roundtrip 結果在語義層等價，即使中間經過了有狀態的中介。**
- **來源**：[concepts/積木投影管線.md](concepts/積木投影管線.md)

### 四路完備性需要自動化驗證，不能靠記憶

- **理論說**：P2 要求每個概念有四條路徑（lift → render → extract → generate）。
- **實際發生**：加入 `u_negate` 積木時完成了 BlockSpec、動態積木、generator、測試，卻忘記在 `UNIVERSAL_CONCEPTS` registry 註冊。結果 diagnostics 報「unknown concept」、code-to-blocks 轉換失敗，但**積木本身能正常使用**，容易讓人以為沒問題。根因是四條路徑分散在不同檔案，沒有統一檢查點。
- **解決方式**：補上 registry 條目，並建立認知——新增任何概念時第一步就是註冊。
- **教訓**：**靠開發者記憶力不可靠。** 應寫測試或 lint 規則：遍歷所有 BlockSpec 的 `conceptId`，檢查每個都在 registry 中存在。
- **來源**：[concepts/概念代數.md](concepts/概念代數.md)

### P4 在理論上是一維的，在實作中是多維的

- **理論說**：漸進揭露只要 `level <= currentLevel` 就能決定積木是否顯示。
- **實際發生**：IO 偏好（iostream vs cstdio）需要額外維度；某些積木只在特定 Code Style 下有意義；語言專屬積木和 universal 積木的 level 需要協調。而且切到 L0 時 workspace 上可能已有 L1 積木，使用者看到 toolbox 沒有卻在畫布上有，會困惑。
- **解決方式**：`buildToolbox()` 實作多維度過濾（level × category × ioPreference × language）；workspace 既有積木不受層級切換影響（只影響 toolbox 可用性）；level 值由教育判斷決定並記錄在 BlockSpec，工程只負責正確過濾。
- **教訓**：**不要試圖用單一 level 數字解決所有問題。** 接受過濾邏輯天然需要多個正交維度，但維度之間的職責必須分清（Topic 管層級樹結構、Level 管可見性、View Params 管呈現）。
- **來源**：[concepts/漸進揭露.md](concepts/漸進揭露.md)

### 「只加 JSON 不改程式碼」不等於「不影響既有行為」

- **理論說**：P3 開放擴充——新概念可加入而不破壞既有結構。
- **實際發生**：`c_pointer_op` 的 astPattern 宣告 `nodeType: "unary_expression"` 但 constraints 為空，結果 `++i`（tree-sitter 也分類為 unary_expression）被搶匹配成指標操作而非 increment。Pattern Engine 按登記順序嘗試，**先匹配到的就贏**。
- **解決方式**：禁止空 constraints（除非該 nodeType 全局唯一）；歧義改在**註冊時**偏序仲裁而非執行時碰運氣。這個經驗直接推動了第一性原理的修訂。
- **教訓**：**禁止歧義比仲裁歧義更安全。** 開放擴充的前提是新 pattern 不能改變既有 pattern 的匹配結果——這個保證必須由註冊時的檢查提供，不能靠開發者自律。
- **來源**：[history/005-pattern-歧義從禁止到偏序仲裁.md](history/005-pattern-歧義從禁止到偏序仲裁.md)

### 第一性原理提供方向，不提供具體設計

- **理論說**：CLT 說「最小化外在認知負荷」，Sc3 說「一個積木 = 一個語法結構」。
- **實際發生**：怎麼最小化需要反覆試錯。積木文字 `"宣告 %1 型別 變數 %2"` 讀起來生硬，改成 `"宣告 %1 變數 %2"` 又讓 `%1` 語義模糊；變數名用 FieldTextInput 會讓初學者輸入不合法名稱，改成 FieldDropdown 又在 workspace 沒有變數時讓 Blockly 拋錯；I/O 參數從純 ValueInput（太複雜）到純 Dropdown（無法輸入常數）走了三個版本才收斂到三模式。
- **解決方式**：message 拆成獨立 label key，每段都有明確語義；dropdown 加 fallback 選項；三模式（select/compose/custom）讓簡單情境用最低認知負荷、複雜情境保有完整表達力。
- **教訓**：**積木文字和互動模式的設計本質上是 UX 問題，不能純靠理論推導。** 原理負責否決錯誤方向，不負責生出正確設計。
- **來源**：[history/012-io-參數從單一模式到三模式.md](history/012-io-參數從單一模式到三模式.md)

### 需要 parse 回結構才能用的字串，就不該是字串

- **理論說**：P2 定義 properties 為 `Record<string, PropertyValue>`，但沒規定何時用字串、何時用結構化物件。
- **實際發生**：`func_def` 的 params 存成字串陣列 `["long long base", "int y"]`。同一份字串在四個環節被不同方式解讀——lifter 整串存入、generator 照原樣拼接（正確）、renderer 用 `split(/\s+/)[0]` 取型別（`long long` 被截斷成 `long`）、extractor 從 UI 欄位讀（正確）。
- **解決方式**：短期用已知複合型別清單做前綴匹配（從最長候選開始）；長期應結構化為 `[{ type: "long long", name: "base" }]`。
- **教訓**：**判定準則——如果一個屬性值在管線中需要被拆分或解析，它就不該是字串。** 壓扁的唯一合理場景是該值只會被完整傳遞、不會被拆分。
- **來源**：[concepts/概念代數.md](concepts/概念代數.md)

### 複製貼上積木定義是序列化契約分裂的溫床

- **理論說**：同一概念的 statement 版和 expression 版只是投影差異，語義相同。
- **實際發生**：`u_input_expr` 是從 `u_input` 複製貼上再改的。`u_input` 的 `saveExtraState` 讀 `getFieldValue('SEL_i')` 存成 `{ text }`，`u_input_expr` 卻直接複製內部狀態 `argSlots_`，而 dropdown validator 寫入的是 `selectedVar` 不是 `text`。`STATEMENT_TO_EXPRESSION` 映射直接搬移 extraState，欄位名不一致導致 `cin >> s` 變成 `cin >> x`——**所有變數 fallback 成預設值**。
- **解決方式**：兩版本的 `saveExtraState`/`loadExtraState` 格式統一，抽成共用函式而非各自實作。
- **教訓**：**序列化格式是隱式的 API 契約**，違反不會在編譯期報錯，只在特定語境（如 if 條件中的 cin）才暴露。新增雙版本積木時共用序列化函式，不要複製貼上。
- **來源**：[episodes/2026-03-12-cin-變數名靜默降級.md](episodes/2026-03-12-cin-變數名靜默降級.md)

### 功能完成 ≠ 功能接通

- **理論說**：auto-include 的元件都寫好了——ModuleRegistry、`computeAutoIncludes()`、工廠函式、`GeneratorContext.moduleRegistry` 欄位。
- **實際發生**：UI 層從來沒呼叫 `setModuleRegistry()`。`GeneratorContext` 建構時 `moduleRegistry` 永遠是 `undefined`，`if (ctx.moduleRegistry)` 永遠不進去。**所有單元測試都通過**（因為測試手動注入了 registry），但瀏覽器中功能完全無效。同一時期 `ModuleRegistry.register()` 還寫錯欄位名（`concept.id` 而非 `concept.conceptId`），structural typing 沒報錯，registry 靜默註冊了一堆 `undefined` 當 key。
- **解決方式**：加入全域 setter 並在初始化時呼叫；修正欄位名；認識到依賴解析架構上該抽離為獨立的 Scaffold 層。
- **教訓**：**端到端驗證不可省**——單元測試手動注入依賴會繞過真實的接線路徑。**全域 setter 模式的風險**：呼叫順序和遺漏都無法被型別系統捕獲。
- **來源**：[episodes/2026-03-10-auto-include-寫好了卻沒接上.md](episodes/2026-03-10-auto-include-寫好了卻沒接上.md)

### 四路完備性不等於可執行

- **理論說**：P2 的四路完備性（lift → render → extract → generate）保證概念正確。
- **實際發生**：`<cmath>` 概念完成四路、round-trip 測試全過，但使用者按「執行」時 `pow()` 算出 0，二次方程式解錯。原因是「執行」走的是 `SemanticInterpreter` 而非 C++ 編譯器，而這些概念沒註冊 interpreter executor——interpreter 原本的邏輯是 `if (concept.includes(':')) return`，**靜默跳過所有語言特定概念**，回傳 `undefined` 一路轉換成 `0`。
- **解決方式**：四路完備性擴充為五層（加執行層）；移除靜默跳過改查 executor registry；宣告性概念註冊 noop executor；未知概念透過 `unknownConceptHandler` 讓使用者選擇跳過或中止。
- **教訓**：**編輯管線的完備性不等於執行管線的完備性。** 宣告性概念也要註冊 noop executor，才能區分「已知不執行」和「未知」。
- **來源**：[history/011-四路完備性擴充為五層.md](history/011-四路完備性擴充為五層.md)

### 靜默降級是 bug 的藏身之處

- **理論說**：fallback 值提供 null safety，讓系統在資料缺失時不崩潰。
- **實際發生**：`cin >> s` 變成 `cin >> x` 的 bug 有**四層防線，每層都靜默降級為同一個預設值 `'x'`**——沒有 console.warn、沒有 annotation、沒有任何可觀察的信號。從使用者角度程式碼「就是錯了」，但系統毫無提示。多層 fallback 用同一預設值會互相掩蓋，讓真正的資料遺失點無法定位。
- **解決方式**：改為優先嘗試恢復（如檢查 `selectedVar`、讀正確的欄位名），只在確實沒有更好選擇時才用預設值。
- **教訓**：**「資料格式不符預期」不等於「沒有輸入」。** 前者應該嘗試恢復或發出信號，後者才用預設值。這也是「不做向後相容」的另一面——`??` 是 null safety，不是吞掉舊格式的工具。
- **來源**：[episodes/2026-03-12-cin-變數名靜默降級.md](episodes/2026-03-12-cin-變數名靜默降級.md)

### Extractor 讀的欄位名必須與積木定義一致

- **實際發生**：`getFieldValue('VAR')` 是想像中的欄位名，真實積木用的是 `'SEL_0'`（動態 dropdown）或 `'NAME'`（JSON blockDef）。`getFieldValue` 對不存在的欄位**只回傳 null，不報錯**，所以這類不匹配在靜態分析中很難發現。
- **解決方式**：修正欄位名並建立 fallback 鏈（`'SEL_0'` → `'NAME'` → 預設值）。
- **教訓**：欄位名稱改動必須**全鏈路同步**：blockDef → extract → generate → lift → adapter。**Extractor 測試應覆蓋「欄位名正確性」**——用 mock block 驗證讀取的欄位名確實存在於積木定義中。
- **來源**：[concepts/積木投影管線.md](concepts/積木投影管線.md)

### 同一概念同時有 template 和 hand-written generator，測試會騙人

- **實際發生**：`input` 概念同時有 universal template 和 hand-written generator。真實 app 中 template 優先，但測試中（未載入 template）hand-written 優先。**測試通過但實際行為不同。** 更早之前也發生過開發者寫了 hand-written generator，卻因為 JSON 還留著 `codeTemplate` 而完全不會被執行，本人毫不知情。
- **解決方式**：兩者互斥——改用 hand-written 時必須從 JSON 刪除 `codeTemplate`；若必須並存，測試要明確覆蓋兩條路徑。
- **教訓**：**優先移除 hand-written generator，讓 template 成為唯一來源**（減少雙真相源）。雙真相源的代價不只是維護成本，還包括「測試環境與生產環境走不同路徑」這種最難察覺的失敗模式。
- **⚠️ 敘述已過期，警告仍成立（2026-08-06 實測更正）**：原文說「真實 app 中 template 優先」。**實際上 app 從來沒接上 TemplateGenerator**——`setTemplateGenerator()` 在 `src/` 內零呼叫、唯一會接它的 `initCppModule()` 是死碼。所以 app 恆走 hand-written，而**93 個概念宣告的 `codeTemplate` 一行都沒被用到**。
  兩組態比對（`audit-completeness`）進一步發現：其中 **35 個元件在「接上 template」與「不接」下產出不同的程式碼**，而且有些 template 是**壞的**——`cpp_auto_declare` 會吐出未取代的佔位符 `auto x = ${VALUE};`。**因為從來沒被執行過，所以沒人知道。**
  → 原文的**方向**（雙真相源會讓測試與生產走不同路徑）完全正確，只是這次是「宣告了一整套、實際上一條都沒走」——比走錯路徑更難察覺。
- **來源**：[concepts/積木投影管線.md](concepts/積木投影管線.md)、`specs/049-audit-guardrails/research.md` F1–F3

### 論證會壞在三種地方，只自查第一種會漏掉另外兩種

2026-08-05 跨專案協商（五封往返）裡，本側的論證壞了四次，**失敗模式有三種**，前兩種靠自查抓到、後兩種靠對方抓到：

| 模式 | 實例 | 為何難自查 |
|---|---|---|
| **搬別處的權威句子** | 「投影是超集」與五槽「並列不包含」自相矛盾；「發現而非發明」原本講語義概念 vs λ-core，被誤套到物理零件；「不計成本，故豁免」豁免錯了層 | 引用的句子本身是對的，錯在**適用範圍** |
| **類比推過頭** | 「Rust 的 aliasing XOR mutability 就是麵包板的一個 driver 多個 reader」——被 open-drain／I2C 砍掉（多 driver 合法） | **前 90% 都對**，只有最後一步不成立 |
| **推導沒走完** | 同時寫了「`balance` 永遠可滿足」和「數位模型把 DRC 慣例烘進模型」，**沒發現後者就是前者的例外來源**（理想化） | 兩半都在紙上，**看起來已經完整** |

**教訓**：自查時除了問「這個論據撐得住嗎」，還要問「**這個類比在哪裡開始不成立**」和「**我寫下的兩件事之間有沒有沒接起來的關係**」。

**附帶發現**：敵對式驗證的產出常常不是「你錯了」，而是「**你的東西比你以為的更站得住，只是理由不是你講的那個**」——那句被砍掉的麵包板等式，若成立反而會讓兩律變成同一條律、使分律過不了 over-justify。**對方的更正救了本側的提案。**

- **來源**：ArduinoCAD `draft/2026-08-05-回送semorphe-*.md`（五封）、[concepts/元件.md](concepts/元件.md)

### 豁免一條反對意見時，要指名豁免的是它的哪一層論據

- **實際發生**：跨專案詞彙統一時，使用者說「不計成本、不計代價」。我方用這個豁免推翻了 ArduinoCAD 的一條教訓（「加法式併行通道 >> 加寬共享型別」），理由是「那條的理由是 blast radius＝成本，故豁免」。**查證後那條教訓有兩層理由**：成本層（blast radius）**＋語義層**（「數位 HIGH/LOW 本是類比電壓的量化讀數，兩者本就分層」；判準是「先問這是**加法**還是**改寫**」）。語義層不是成本論，豁免不到它。
- **對方一句話點破**：**over-justify 不是成本測試——所以「不計成本」不能替一個抽象脫罪。** 抽象要嘛多解釋、多預測、要嘛壓縮；三個都不中就是裝飾，跟花多少力氣無關。
- **更普遍的模式**：這是同一輪裡第三次**先有結論、再從別處搬權威句子當理由**（另兩次：「投影是超集」與五槽「並列不包含」自相矛盾；「發現而非發明」原本講語義概念 vs λ-core 人造編碼，被誤套到物理零件）。前兩次自查出、第三次靠外部反駁抓到。
- **教訓**：豁免一條反對意見時，先把它的論據**逐層列出來**，再指名豁免哪一層、為什麼那層可豁免。整條豁免掉最省事，也最容易漏掉真正擋你的那層。**成本可以豁免，語義不行。**
- **來源**：ArduinoCAD `draft/2026-08-05-回送semorphe-埠統一沉到連接層.md`、[concepts/元件.md](concepts/元件.md)

### 量測工具的第一版會安靜地量錯——救它的是「結果長這樣代表工具壞了」

- **實際發生**：實作四條審計護欄（`specs/049-audit-guardrails`）時，有兩支量測**產出了看起來合理、實際上錯誤的數字**：
  - **完備性護欄第一版**用 `renderToBlocklyState` 當 render 的入口，但它需要 `program` 外殼且只處理 statement——於是所有 expression 元件被判為缺，產出 **84 個假的 missing**。數字很大、很像真的。
  - **兩組態比對第一版**比的是 verdict（實作／殼／缺），得到「**無差異**」。而 verdict 粒度太粗：兩種組態都產得出有效輸出，差別在**文字**。真實差異是 35 個元件。
- **怎麼抓到的**：**不是靠檢查程式碼，是靠結果不合理**。extract 顯示「0 殼 ／ 84 缺」——`render` 全過卻 `extract` 全缺，這個組合不可能。而兩組態那次，救命的是我自己寫進報表的那句「**（無差異——若這裡是空的，多半是護欄沒接對）**」：工具吐出的空結果，被工具自己預先貼上的標籤判為可疑。
- **教訓**：**給每個量測工具寫一句自我否證提示**——「如果結果長成 ○○，代表工具壞了而不是世界長這樣」。量測工具是最容易變成殼的東西：它產出數字，而數字天生看起來像證據。沒有這句提示，一個安靜量錯的護欄比沒有護欄更糟——它會讓你**帶著假的安全感**去做重構。
- **第三個實例，而且觸發方式不同（2026-08-06）**：缺陷帳護欄把「被關掉的測試」（22 筆，`it.skip` 有本體）與「只有名字的測試」（64 筆，`it.todo` 無本體）**當成同一種東西數**。數字是對的、分類是對的，**只有「停用測試」這個詞的語義錯了**——它把兩種需要完全不同工作量的東西包在一起，讓優先序灌水 3–10 倍（「修 `print` 解鎖 21 個」實際是 5 個）。
  前兩個實例靠「結果不合理」抓到；**這個是拿它來規劃真實工作時才暴露的**。
- **因此教訓有兩個觸發點**：
  1. **結果不合理**（可自查，但取決於當下夠不夠清醒）
  2. **照它行動時**（不可預先自查，但必然會現形）——所以**每次照量測行動的第一步，都要準備好推翻它**
- **相關**：[concepts/執行機構.md](concepts/執行機構.md)「執行機構自己也可能是殼」
- **來源**：[episodes/2026-08-06-護欄自己量錯.md](episodes/2026-08-06-護欄自己量錯.md)、`specs/050-repay-top-blockers/research.md` F4／F6

### 宣稱「與我無關」之前先去量——歸因不做就只是推託

- **實際發生**：P0 完成後全套測試在高負載下失敗 2–8 個。直覺是「這是既有 flake，跟我的護欄無關」——聽起來很合理，因為失敗的是呼叫編譯器的 fuzz 測試。
- **做法**：**切回功能前的 commit 跑同一套**，結果失敗 **8 個**（比加了護欄之後的 2–3 個更多）；再做 A／B 量測（含護欄 27.21s vs 不含 27.84s）確認護欄本身幾乎不增加耗時。**這時才敢寫「與本功能無關」。**
- **教訓**：「這不是我造成的」是一個**可驗證的宣稱**，而驗證通常很便宜（切一個 commit、跑兩次）。不驗就說，和「記錄代替修復」是同一種便宜——**聽起來像處理過了，實際上只是講過了**。
- **來源**：`knowledge/draft/2026-08-05-元件膠囊重構.md` 坑 ⑥

### 守「未來」的規範，症狀恆為零——所以它最容易空著沒人發現

- **實際發生**：`history/005`（2026-03-09）決定 pattern 歧義用偏序仲裁，三種情況各有處置，狀態欄寫「✅ 已採用」。四個月後第一次為它蓋執行機構才發現：**情況二（交叉歧義報註冊錯誤）從來沒有實作過**，實測 18 對規則落在那裡卻無人報錯；情況一用的是 constraint **數量**這個代理指標而非偏序本身，導致 5 條 constraints 完全相同的規則同分，其中 4 條成為永不被試到的死規則。
- **為什麼能空四個月**：因為它守的不是「現在是對的」，而是「**未來的變更不會破壞現在**」。靠登記順序決勝負的規則**現在幾乎都是對的**（否則專案早就不能用了）——它不會出現在任何失敗測試、任何 bug 報告裡。**零症狀不是健康，是這類規範沒實作時的正常表現。**
- **兩種護欄要分開講**：前四條護欄量的是「**有多少東西壞了**」，第五條量的是「**有多少東西靠運氣**」。後者的數字下降**不代表修好了 bug**，而代表移除了一個未來會咬人的機會。把兩者混在同一個「品質分數」裡，會讓人以為靠運氣的那部分是安全的。
- **教訓**：一條規範如果的形式是「新增 X 不得改變既有 Y」，**它不做也不會痛，直到很痛**——因此它比任何其他規範都更需要註冊時的機械化檢查。而且**知識庫自己的狀態欄也會存殼**：`history/` 標「已採用」的是當時的**意圖**，不是實作的證據。回頭引用一條舊決定時，先問「它的哪一半真的落地了」。
- **相關**：[concepts/執行機構.md](concepts/執行機構.md)、[history/016](history/016-偏序仲裁的情況二從未實作.md)、[history/005](history/005-pattern-歧義從禁止到偏序仲裁.md)
- **來源**：`specs/051-lift-claim-arbitration`、`tests/baselines/lift-ambiguity.json`

## 關鍵延伸（主題觸發必讀）

| 觸發關鍵字 | MUST 讀 |
|---|---|
| 積木定義、generator、extractor、動態積木、extraState、欄位同步 | `concepts/積木投影管線.md` |
| 殼、做一半、看起來完成、規範沒有檢查、護欄、audit 測試、量測工具自己量錯 | `concepts/執行機構.md` |
| 元件、接點、埠、關係律、命名、跨域、合流 | `concepts/元件.md` |
| 概念註冊、四路/五層完備性、屬性結構化 | `concepts/概念代數.md` |
| pattern 搶匹配、歧義、constraint、lifter | `concepts/開放擴充.md` |
| 靜默失敗、降級、confidence | `concepts/降級與認知邊界.md` |
| 決策為什麼變成現在這樣 | `history/` |
| 某個 bug 當初的完整現場 | `episodes/` |
