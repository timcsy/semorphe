# Feature Specification: Semantic Tree Restructure

**Feature Branch**: `008-semantic-tree-restructure`
**Created**: 2026-03-06
**Status**: Draft
**Input**: 基於 docs/first-principles.md 的第一性原理，從頭重構整個 code-blockly 專案。建立語義樹為 Single Source of Truth，實作四級 lift() 管線、概念代數、參數化投影、漸進揭露 UI/UX、開放擴充架構。不考慮向後相容，舊 code 僅作參考。

## Clarifications

### Session 2026-03-06

- Q: 語義樹的持久化策略？ → A: 自動儲存到 localStorage + 手動匯出/匯入 JSON 檔案（兩者同時支援）
- Q: 程式碼編輯器的同步觸發時機？ → A: 使用者手動按「同步」按鈕觸發（不自動 debounce）
- Q: Undo/Redo 支援範圍？ → A: 各編輯器各自獨立的 undo/redo（Blockly 和 CodeMirror 各自內建，同步後不可跨編輯器 undo）
- Q: L0/L1/L2 層級切換的 UI 位置？ → A: 頂部工具列的下拉選單或分段按鈕，與 Style/Locale 切換並排
- Q: 程式碼有語法錯誤時按同步的處理策略？ → A: 部分同步——成功 parse 的部分正常 lift，語法錯誤的區段降級為 raw_code 積木；同步前先提示使用者有錯誤並標示錯誤位置，由使用者確認是否繼續同步

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 積木拖拉即時同步程式碼 (Priority: P1)

使用者在左側積木編輯器中拖拉積木、連接積木、修改欄位值，右側程式碼編輯器即時顯示對應的程式碼。兩邊永遠一致，因為它們都是同一棵語義樹的投影。

**Why this priority**: 這是系統的核心價值——雙向同步。沒有語義樹作為 Single Source of Truth，其他功能都無法建立。

**Independent Test**: 拖拉任意積木組合，程式碼面板即時更新且語法正確。

**Acceptance Scenarios**:

1. **Given** 空白工作區, **When** 使用者拖入一個「宣告變數 int x = 5」積木, **Then** 程式碼面板顯示 `int x = 5;`，語義樹包含一個 var_declare 節點
2. **Given** 已有積木的工作區, **When** 使用者修改變數名稱欄位從 x 改為 y, **Then** 程式碼即時從 `int x = 5;` 更新為 `int y = 5;`
3. **Given** 多個積木已連接, **When** 使用者拖斷其中一個連接, **Then** 語義樹更新，程式碼同步反映斷開後的結構

---

### User Story 2 - 程式碼輸入手動同步積木 (Priority: P1)

使用者在程式碼編輯器中輸入或貼上 C++ 程式碼，按下「同步」按鈕後，系統解析（parse → AST → lift → 語義樹），積木編輯器顯示對應的積木結構。同步為手動觸發，不自動 debounce。

**Why this priority**: 雙向同步的另一半——讓使用者能從程式碼側操作，是教學場景中不可或缺的。

**Independent Test**: 在程式碼面板輸入合法 C++ 程式，按同步按鈕後積木面板顯示正確的積木結構。

**Acceptance Scenarios**:

1. **Given** 空白工作區, **When** 使用者在程式碼面板輸入 `int x = 5;` 並按同步, **Then** 積木面板顯示一個「宣告變數 int x = 5」積木
2. **Given** 空白工作區, **When** 使用者貼入多行程式碼（含 if/for/函式定義）並按同步, **Then** 積木面板正確顯示完整的巢狀積木結構
3. **Given** 程式碼中包含無法識別的巨集 `FOR(i,0,10)`, **When** 使用者按同步, **Then** 巨集節點降級為 unresolved_macro 積木，但其引數子樹仍正常解析為積木
4. **Given** 程式碼有語法錯誤, **When** 使用者按同步, **Then** 系統提示有錯誤並標示錯誤位置，使用者確認後成功部分正常 lift、錯誤區段降級為 raw_code

---

### User Story 3 - 四級 lift() 優雅降級 (Priority: P1)

當程式碼中出現系統無法完全識別的結構時，系統不報錯，而是按四級策略逐步降級（結構匹配 → 上下文推導 → 未決保留 → raw_code），確保任何合法程式碼都能被表示。

**Why this priority**: lift() 是 code → blocks 的核心管線，其降級策略直接影響系統對真實世界程式碼的容忍度。

**Independent Test**: 輸入包含高級語法（template、巨集、operator overloading）的程式碼，驗證系統不崩潰且保留所有資訊。

**Acceptance Scenarios**:

1. **Given** 程式碼 `int x = a + b;`, **When** lift(), **Then** 產生 Level 1 結構匹配（arithmetic 概念）
2. **Given** 程式碼含 `printf("hello")`, **When** lift() 在有 `#include <stdio.h>` 的上下文中, **Then** 產生 Level 2 上下文推導（print 概念，confidence: high）
3. **Given** 程式碼含 `template<typename T> class Foo {}`, **When** lift() 在 L0 認知層級, **Then** 整段降級為 raw_code 積木，保留原始文字
4. **Given** 程式碼含未知巨集 `MY_MACRO(x, y+1)`, **When** lift(), **Then** 巨集節點為 unresolved_macro，但 `x` 和 `y+1` 各自獨立 lift 為語義節點

---

### User Story 4 - 漸進揭露認知層級切換 (Priority: P2)

使用者可以在頂部工具列透過下拉選單或分段按鈕切換認知層級（L0 初學 / L1 進階 / L2 高階），工具箱中顯示的積木種類隨之改變。語義樹不變，只是投影的解析度不同——低層級使用者看到的是降級後的通用積木。

**Why this priority**: 對教學場景至關重要，初學者不應被大量進階積木淹沒。

**Independent Test**: 切換層級後，工具箱積木數量改變，已有的積木在不同層級間正確降級/升級顯示。

**Acceptance Scenarios**:

1. **Given** L0 層級, **When** 使用者查看工具箱, **Then** 只看到 Universal 概念（變數、if、迴圈、函式、輸入輸出）
2. **Given** L2 層級有 `std::sort` 專屬積木, **When** 切換到 L0, **Then** 該積木降級顯示為通用「呼叫函式」積木
3. **Given** L0 層級正在使用通用積木, **When** 切換到 L2, **Then** 符合條件的通用積木自動升級為專屬積木

---

### User Story 5 - 參數化投影：Language × Style × Locale (Priority: P2)

使用者可以在頂部工具列獨立切換三個正交參數：程式語言（目前 C++）、編碼風格（APCS / 競賽 / Google Style）、介面語言（zh-TW / en）。切換任一參數只重新投影，語義樹不變。

**Why this priority**: 風格切換和 i18n 是高品質教學工具的核心功能，但依賴於語義樹已建立。

**Independent Test**: 切換 Style 後程式碼重新生成（如 cout ↔ printf），切換 Locale 後積木文字語言改變，語義不變。

**Acceptance Scenarios**:

1. **Given** APCS 風格, **When** 切換到競賽風格, **Then** 程式碼從 `cout << x` 變為 `printf("%d", x)`，積木不動
2. **Given** zh-TW 介面, **When** 切換到 en, **Then** 積木上的文字從中文變為英文，程式碼不動
3. **Given** 使用者用 `x += 1` 語法偏好, **When** round-trip 後, **Then** 語法偏好被保留，仍輸出 `x += 1` 而非 `x = x + 1`

---

### User Story 6 - 開放擴充：JSON-only 新增套件積木 (Priority: P2)

開發者可以只新增一個 JSON 檔案（包含 blockDef + codeTemplate + astPattern + concept），就能為外部套件加入新積木，無需修改任何既有程式碼。

**Why this priority**: 決定系統的長期可擴充性，但需要核心架構先完成。

**Independent Test**: 新增一個 JSON 積木定義檔，重新載入後新積木出現在工具箱中，且支援 code ↔ blocks 雙向轉換。

**Acceptance Scenarios**:

1. **Given** 系統已執行, **When** 開發者新增一個 `cpp_sort.json` 檔案定義 sort 積木, **Then** 重新載入後 sort 積木出現在工具箱
2. **Given** sort 積木已註冊, **When** 使用者在程式碼中輸入 `sort(v.begin(), v.end())`, **Then** 系統識別為 sort 積木（而非通用 func_call）
3. **Given** sort 積木已註冊, **When** 使用者拖入 sort 積木, **Then** 正確生成 `sort(v.begin(), v.end())` 程式碼

---

### User Story 7 - 註解保留與雙向同步 (Priority: P3)

程式碼中的註解在轉換為積木後不會丟失。行尾註解附著在對應積木上，獨立註解成為獨立的「註解積木」。從積木轉回程式碼時，註解保留在正確位置。

**Why this priority**: 註解保留是「可用於真實專案維護」的前提，但在基礎雙向轉換之後。

**Independent Test**: 貼入含各種註解的程式碼，轉為積木再轉回，所有註解位置和內容正確。

**Acceptance Scenarios**:

1. **Given** 程式碼含 `x = 1; // set x`, **When** 轉為積木, **Then** x=1 積木上附帶 "set x" 註解
2. **Given** 獨立註解 `// section header` 位於兩個語句之間, **When** 轉為積木, **Then** 產生獨立的「註解積木」在兩個積木之間
3. **Given** 積木有註解, **When** 使用者拖拉重排積木順序, **Then** 註解跟著所屬積木走，不會漂移

---

### User Story 8 - 概念代數三層分層與映射 (Priority: P3)

系統的概念分為 Universal（所有語言共有）、Lang-Core（語言核心語法）、Lang-Library（函式庫）三層。每個具體概念映射到一個抽象概念，支援概念間的降級和跨語言映射基礎。

**Why this priority**: 概念代數是跨語言轉換和漸進揭露的理論基礎，但初版可先支援單語言。

**Independent Test**: 驗證 C++ 的各種概念正確分層，且從具體概念可以找到對應的抽象概念。

**Acceptance Scenarios**:

1. **Given** 概念註冊表, **When** 查詢 `cpp:vector_push_back`, **Then** 回傳其抽象概念為 `container_add`，層級為 Lang-Library
2. **Given** 概念註冊表, **When** 查詢所有 Universal 概念, **Then** 回傳 variable、if、loop、function、print 等基礎概念
3. **Given** 一個 L2 概念在 L0 環境, **When** 降級, **Then** 使用 func_call 通用積木表示，保留語義

---

### User Story 9 - 持久化與匯出匯入 (Priority: P2)

系統自動將語義樹儲存到瀏覽器本地儲存（localStorage），重新開啟時自動恢復。使用者也可以手動匯出語義樹為 JSON 檔案，或匯入先前匯出的 JSON 檔案。

**Why this priority**: 使用者不能每次開啟都從零開始，持久化是基本的可用性需求。

**Independent Test**: 建立積木後關閉再開啟瀏覽器，工作區自動恢復；匯出的 JSON 可在另一個瀏覽器匯入並完整還原。

**Acceptance Scenarios**:

1. **Given** 使用者已建立積木程式, **When** 關閉瀏覽器後重新開啟, **Then** 工作區自動恢復到上次狀態
2. **Given** 使用者按匯出按鈕, **When** 下載完成, **Then** 產生一個包含完整語義樹的 JSON 檔案
3. **Given** 使用者有一個匯出的 JSON 檔案, **When** 按匯入按鈕並選擇檔案, **Then** 工作區完整還原為 JSON 中的狀態

---

### Edge Cases

- 使用者貼入空字串或只有空白的程式碼時，系統產生空的語義樹，積木面板清空
- 程式碼有語法錯誤時按同步，系統提示錯誤並標示位置，使用者確認後成功部分正常 lift、錯誤區段降級為 raw_code
- 極深巢狀的積木結構（20+ 層 if/for）不導致效能問題或渲染崩潰
- 超長的單行程式碼（raw_code 降級）在積木面板中有合理的顯示寬度
- 積木端操作和程式碼端未同步的內容共存時，按同步按鈕以程式碼為準覆蓋積木端
- 使用者在 L0 層級輸入了 L2 才有的程式碼（如 template），系統正確降級為 raw_code 而非報錯
- round-trip 測試：任何 `code → blocks → code` 的語義不變（呈現可能改變）
- round-trip 測試：任何 `blocks → code → blocks` 的語義不變
- localStorage 儲存空間不足時，提示使用者手動匯出備份
- 匯入的 JSON 格式不合法或版本不相容時，顯示清楚的錯誤訊息

## Requirements *(mandatory)*

### Functional Requirements

**核心語義樹**

- **FR-001**: 系統 MUST 維護一棵顯式的語義樹（SemanticNode 樹結構）作為所有 UI 投影的唯一資料來源
- **FR-002**: 語義樹節點 MUST 包含概念類型（concept）、屬性（properties）、子節點（children）、以及可選的 annotations 和 metadata
- **FR-003**: 程式碼面板和積木面板 MUST 始終反映語義樹的當前狀態，不允許任何一方直接修改而不更新樹

**投影管線**

- **FR-004**: 系統 MUST 實作 `project(tree, language, style)` 函式，將語義樹投影為程式碼文字
- **FR-005**: 系統 MUST 實作 `project(tree, language, locale)` 函式，將語義樹投影為 Blockly 積木結構
- **FR-006**: 系統 MUST 實作 `parse(code, language)` 函式，將程式碼文字解析為 AST
- **FR-007**: 系統 MUST 實作 `lift(AST, language)` 函式，將 AST 提升為語義樹，並支援四級策略（結構匹配、上下文推導、未決保留、raw_code 降級）
- **FR-008**: lift() MUST 在單次調用內維護帶有作用域層級的符號表，用於變數遮蔽和型別推導

**同步機制**

- **FR-032**: 積木端操作 MUST 即時同步到程式碼面板（積木 → 語義樹 → 程式碼，自動觸發）
- **FR-033**: 程式碼端操作 MUST 透過使用者手動按「同步」按鈕觸發同步（程式碼 → parse → lift → 語義樹 → 積木）
- **FR-034**: 同步前如有語法錯誤，系統 MUST 提示使用者錯誤內容並標示錯誤位置，由使用者確認是否繼續同步
- **FR-035**: 確認同步後，成功 parse 的部分 MUST 正常 lift，語法錯誤區段 MUST 降級為 raw_code 積木

**概念系統**

- **FR-009**: 系統 MUST 支援三層概念分層：Universal、Lang-Core、Lang-Library
- **FR-010**: 每個非 Universal 概念 MUST 聲明其映射的抽象概念（abstractConcept）
- **FR-011**: 概念的完整 ID MUST 遵循 `language:package:concept` 命名空間格式
- **FR-012**: 系統 MUST 支援概念衝突解決：AST pattern match + context disambiguation

**參數化投影**

- **FR-013**: Language 參數 MUST 決定可用的概念集合和型別系統
- **FR-014**: Style 參數 MUST 只影響程式碼生成（格式、I/O 方式、命名建議），不影響語義樹和積木
- **FR-015**: Locale 參數 MUST 只影響積木文字（message、tooltip、dropdown label），不影響程式碼和語義樹
- **FR-016**: 三個參數 MUST 可獨立切換，切換時語義樹不變

**漸進揭露**

- **FR-017**: 系統 MUST 支援至少三個認知層級（L0 初學 / L1 進階 / L2 高階）
- **FR-018**: 工具箱 MUST 根據當前認知層級過濾顯示的積木種類
- **FR-019**: 超出當前層級的語義節點 MUST 降級顯示為通用積木，不能隱藏或丟棄

**開放擴充**

- **FR-020**: 新增套件積木 MUST 只需新增 JSON 定義檔（含 blockDef、codeTemplate、astPattern、concept），不修改既有程式碼
- **FR-021**: JSON 定義檔 MUST 包含四個維度：身份（id/language/category）、語義（concept mapping）、積木（blockDef）、程式碼（codeTemplate + astPattern）
- **FR-022**: 系統 MUST 在啟動時自動掃描並載入所有 JSON 積木定義檔

**註解與元資訊**

- **FR-023**: 行尾註解 MUST 作為 annotation 附著在對應的語義節點上
- **FR-024**: 獨立註解 MUST 作為 concept='comment' 的獨立語義節點
- **FR-025**: 表達式內部的註解 MUST 附著在對應的子節點上，拖拉時跟隨子節點移動
- **FR-026**: 語法偏好（如 `+=` vs `= x+1`）MUST 記錄在 metadata.syntaxPreference 中，round-trip 時 best-effort 保留

**Round-trip 保證**

- **FR-027**: 對於所有 Level 1/2 可識別的概念，`lift(parse(project(tree)))` MUST 產生語義等價的樹（structured_info 完全保留）
- **FR-028**: 對於降級為 raw_code 的節點，原始程式碼文字 MUST 完整保留（total_info 不減少）

**持久化與匯出匯入**

- **FR-036**: 系統 MUST 在語義樹變更時自動儲存到瀏覽器 localStorage
- **FR-037**: 系統 MUST 在啟動時從 localStorage 自動恢復語義樹狀態
- **FR-038**: 使用者 MUST 能手動匯出語義樹為 JSON 檔案
- **FR-039**: 使用者 MUST 能匯入先前匯出的 JSON 檔案，完整還原工作區狀態
- **FR-040**: localStorage 儲存空間不足時 MUST 提示使用者手動匯出備份

**UI/UX**

- **FR-029**: 積木編輯器 MUST 使用 Scratch 風格配色方案和 Zelos 圓角渲染器
- **FR-030**: 未決節點（unresolved）MUST 在積木面板中有視覺上可區分的呈現（如不同邊框或色調）
- **FR-031**: raw_code 降級積木 MUST 顯示原始程式碼文字，使用者可以展開/收合
- **FR-041**: 頂部工具列 MUST 包含 Language、Style、Locale、認知層級（L0/L1/L2）四個投影參數的切換控制項
- **FR-042**: 程式碼面板 MUST 包含一個明顯的「同步」按鈕，用於手動觸發 code → blocks 同步
- **FR-043**: Undo/Redo MUST 在各編輯器內獨立運作（Blockly 和 Monaco Editor 各自的 undo stack），同步操作後不可跨編輯器 undo

### Key Entities

- **SemanticNode**: 語義樹的節點，包含 concept（概念類型）、properties（屬性 map）、children（子節點 map，每個 key 對應一個 SemanticNode 陣列）、annotations（附著型元資訊）、metadata（語法偏好等）
- **ConceptDef**: 概念定義，包含 id、layer（Universal/Lang-Core/Lang-Library）、abstractConcept（映射）、semanticContract（副作用、回傳語義等）
- **BlockSpec**: JSON 積木規格，包含 blockDef、codeTemplate、astPattern、concept 四個維度
- **Projection**: 投影函式的參數組合，包含 language、style、locale 三個正交參數
- **LiftContext**: lift() 的上下文，包含 declarations、using_directives、includes、macro_definitions
- **Annotation**: 附著在節點上的元資訊，包含 type（comment/pragma/lint_directive）、text、position（before/after/inline）

## Assumptions

- 初版只支援 C++ 作為程式語言，架構設計為多語言但暫不實作其他語言
- 初版的 Style presets 包含 APCS、競賽、Google Style 三種
- 初版的 Locale 支援 zh-TW 和 en 兩種
- 使用 tree-sitter 作為 parser，Blockly 作為積木渲染引擎，Monaco Editor 作為程式碼編輯器（VSCode 風格）
- 跨語言轉換（如 C++ → Python）屬於未來功能，本次只建立概念映射的基礎架構
- 效能目標：積木/程式碼同步延遲在一般程式碼（< 500 行）下不超過 500ms

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 任何由系統工具箱中積木組合出的程式，round-trip（blocks → code → blocks）後語義 100% 保留
- **SC-002**: 系統工具箱涵蓋 C++ 教學常用語法（變數、if/else、for/while、函式、陣列、I/O），覆蓋率達 100%
- **SC-003**: 新增一個套件積木只需新增 JSON 檔案，不修改任何既有原始碼（0 行既有程式碼變更）
- **SC-004**: 切換 Style 或 Locale 後，UI 在 200ms 內完成重新投影
- **SC-005**: L0 層級的工具箱積木數量不超過 30 個，L2 層級可達 80+ 個
- **SC-006**: 包含語法錯誤或未知結構的程式碼，系統 0 次崩潰，100% 降級處理
- **SC-007**: 使用者在積木端操作（拖拉、修改欄位）後，程式碼同步延遲不超過 300ms
- **SC-008**: 使用者按同步按鈕後，積木同步延遲不超過 500ms（含 parse + lift + render）
- **SC-009**: 關閉瀏覽器後重新開啟，工作區 100% 自動恢復（localStorage 正常時）
