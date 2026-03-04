# Feature Specification: 積木系統認知負荷改善

**Feature Branch**: `003-polish-block-ux`
**Created**: 2026-03-03
**Status**: Draft
**Input**: 依照認知負荷分析結果，全面改善積木系統設計品質，讓積木成為概念翻譯官

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 清爽的工具箱（減少選擇困難） (Priority: P1)

學生打開積木編輯器，看到一個簡潔、有組織的工具箱。每個概念只出現一次，不會同時看到「輸出」和「cout << x ;」兩個功能相同的積木。工具箱積木數量從 60+ 降至約 30 個，學生可以快速找到需要的積木，而不是在一堆長得很像的積木中猶豫。

**Why this priority**: 工具箱是學生接觸積木的第一個介面。如果一打開就看到 60+ 個積木、其中很多長得一樣，學生立刻會感到困惑和壓力。這是影響面最大的問題。

**Independent Test**: 打開積木編輯器，檢查工具箱中不存在功能重複的積木。每個程式概念（數字、變數、字串、比較、算術等）只有一個對應的積木。

**Acceptance Scenarios**:

1. **Given** 學生打開積木編輯器, **When** 展開工具箱的任意分類, **Then** 不會看到兩個功能相同但外觀不同的積木（例如不會同時出現「輸出」和「cout <<」）
2. **Given** 工具箱已清理, **When** 計算工具箱中的積木總數, **Then** 積木數量不超過 35 個
3. **Given** 學生寫了一段包含 `#include`、指標、`printf`、`struct` 的 C++ 程式碼, **When** 轉換為積木, **Then** 這些 C++ 特有概念仍然能正確顯示為對應的語言特殊積木
4. **Given** 工具箱中移除了重複積木, **When** 學生將任意 C++ 程式碼轉換為積木, **Then** 所有程式碼結構都能被正確表示（不會因為少了積木而無法轉換）

---

### User Story 2 - 積木文字一看就懂（自然語言標籤） (Priority: P2)

學生看到積木上的文字是自然語言，不需要額外記憶程式語法符號。比較運算顯示「等於」而非 `==`，算術運算顯示「餘數」而非 `%%`，迴圈的範圍描述明確無歧義。學生可以對照積木上的自然語言和右邊 CodeMirror 中的實際程式碼，理解概念與語法的對應關係。

**Why this priority**: 積木上的文字是學生理解程式概念的關鍵橋樑。如果文字本身就是程式語法（如 `==`、`%%`），積木就失去了「翻譯官」的價值。

**Independent Test**: 檢查所有共用積木的顯示文字，確認每個運算符和概念都用自然語言（繁體中文）表達。

**Acceptance Scenarios**:

1. **Given** 學生使用比較運算積木, **When** 查看運算符選項, **Then** 看到「大於」「小於」「大於等於」「小於等於」「等於」「不等於」而非 `>`、`<`、`>=`、`<=`、`==`、`!=`
2. **Given** 學生使用算術運算積木, **When** 查看運算符選項, **Then** 看到「+」「-」「x」「÷」「餘數」，其中乘除和餘數用數學符號或自然語言表達
3. **Given** 學生使用計數迴圈積木, **When** 設定「重複：i 從 0 到 9」, **Then** 迴圈確實執行 10 次（i = 0, 1, 2, ..., 9），「到」的語意是包含端點的
4. **Given** 學生使用陣列存取積木, **When** 查看積木文字, **Then** 看到「arr [ INDEX ]」使用中性的索引表達，而非「的第 N 個」

---

### User Story 3 - 函式參數結構化（不打原始碼） (Priority: P3)

學生定義函式時，不需要手動輸入 `int a, int b` 這樣的 C++ 語法。相反地，他們使用結構化的介面：每個參數都有型別下拉選單和名稱輸入欄，可以用加減按鈕增減參數數量。呼叫函式時，每個引數也是獨立的表達式輸入，而非一整串文字。

**Why this priority**: 函式參數是新手學生的痛點之一。讓參數結構化可以減少語法錯誤（忘記逗號、型別打錯等），並幫助學生理解「函式接受具名的、有型別的參數」這個概念。

**Independent Test**: 建立一個兩個參數的函式定義積木和對應的呼叫積木，確認不需要輸入任何原始程式碼語法。

**Acceptance Scenarios**:

1. **Given** 學生拖出「定義函式」積木, **When** 想要加入第二個參數, **Then** 可以點擊加號按鈕新增一組「型別 + 名稱」的參數欄位
2. **Given** 學生定義了 `int add(int a, int b)`, **When** 查看積木, **Then** 看到「定義函式 add（int a, int b）回傳 int」，每個參數都是獨立的結構化欄位
3. **Given** 學生拖出「呼叫函式」積木, **When** 想要傳入兩個引數, **Then** 可以點擊加號按鈕新增引數輸入插槽，每個引數接受一個表達式積木
4. **Given** 函式定義積木有兩個參數, **When** 生成程式碼, **Then** 正確產出 `int add(int a, int b)` 格式的程式碼

---

### User Story 4 - 變數宣告更靈活 (Priority: P4)

學生可以選擇宣告變數時是否給初始值。如果不需要初始值，積木不會顯示多餘的 `=` 符號和空白輸入槽，避免「是不是漏填了什麼」的困惑。

**Why this priority**: 這是一個較小但明顯的 UX 改善。在 C/C++ 中，`int x;`（無初始值）和 `int x = 0;`（有初始值）都很常見，積木應該能自然表達兩種情況。

**Independent Test**: 拖出變數宣告積木，確認可以在有/無初始值兩種模式間切換，且外觀不會讓人困惑。

**Acceptance Scenarios**:

1. **Given** 學生拖出變數宣告積木, **When** 不給初始值, **Then** 積木顯示「建立 int 變數 x」，沒有 `=` 符號和空白插槽
2. **Given** 學生拖出變數宣告積木, **When** 給初始值, **Then** 積木顯示「建立 int 變數 x = (value)」，有初始值的表達式插槽
3. **Given** C++ 程式碼 `int x;`, **When** 轉換為積木, **Then** 顯示無初始值的變數宣告積木
4. **Given** C++ 程式碼 `int x = 5;`, **When** 轉換為積木, **Then** 顯示有初始值的變數宣告積木

---

### User Story 5 - 多變數輸入 (Priority: P5)

學生可以在一個「讀取輸入」積木中同時讀取多個變數（如 `cin >> a >> b >> c`），就像「輸出」積木可以串接多個表達式一樣。

**Why this priority**: APCS 常見一次讀取多個變數的情境。雖然可以用多個 u_input 積木達成，但一個多變數輸入更符合實際使用模式。

**Independent Test**: 使用一個讀取輸入積木讀取三個變數，確認生成正確的 `cin >> a >> b >> c;` 程式碼。

**Acceptance Scenarios**:

1. **Given** 學生拖出讀取輸入積木, **When** 預設狀態, **Then** 有一個變數名稱欄位
2. **Given** 學生點擊加號按鈕, **When** 新增第二個變數, **Then** 積木顯示兩個變數名稱欄位
3. **Given** 讀取輸入積木有三個變數 a, b, c, **When** 生成程式碼, **Then** 產出 `cin >> a >> b >> c;`
4. **Given** C++ 程式碼 `cin >> a >> b >> c;`, **When** 轉換為積木, **Then** 顯示一個有三個變數的讀取輸入積木

---

### Edge Cases

- 當舊版 workspace 資料（localStorage）包含被移除的 C++ 積木時，系統直接清除舊資料並從空白 workspace 開始
- 當 C++ 程式碼使用了被移除積木對應的語法（如直接使用 `cout <<` 或數字字面量等原本有專屬 C++ 積木的語法）時，code-to-blocks 轉換降級為 `c_raw_code` / `c_raw_expression` 積木
- 當函式有 0 個參數時，函式定義和呼叫積木應該顯示空括號，不出現多餘的 UI 元素
- 當計數迴圈的「從」值大於「到」值時（如「從 10 到 0」），系統的行為應該明確（此版本不支援遞減迴圈，可保留為未來擴充）
- 當 u_count_loop 語意從排除端點改為包含端點時，現有測試需要更新（舊 workspace 已清除，不需遷移）

## Requirements *(mandatory)*

### Functional Requirements

**工具箱清理**:
- **FR-001**: 工具箱 MUST 不同時展示功能等價的共用積木和語言特殊積木（如 u_number 和 c_number 不可並存於工具箱）
- **FR-002**: 以下 C++ 積木 MUST 從工具箱中移除（因為有等價的共用積木）：c_number、c_variable_ref、c_string_literal、c_binary_op、cpp_cout、cpp_cin、cpp_endl、c_var_declare_init_expr
- **FR-003**: 以下 C++ 積木 MUST 保留在工具箱中（因為代表不同的心智模型）：c_include、c_include_local、c_define、c_ifdef、c_ifndef、c_using_namespace、c_printf、c_scanf、c_for_loop、c_do_while、c_switch、c_case、c_increment、c_compound_assign、c_pointer_declare、c_pointer_deref、c_address_of、c_malloc、c_free、c_struct_declare、c_struct_member_access、c_struct_pointer_access、c_comment_line、c_raw_code、c_raw_expression
- **FR-004**: 被移除的積木定義 MUST 從系統中完全刪除（包括 JSON 定義檔），不僅是從工具箱隱藏，因為舊版 workspace 已歸零且 code-to-blocks 不再映射到這些積木

**自然語言標籤**:
- **FR-005**: 比較運算積木的運算符下拉選單 MUST 顯示自然語言標籤：「大於」「小於」「大於等於」「小於等於」「等於」「不等於」
- **FR-006**: 算術運算積木的取餘數選項 MUST 顯示「餘數」而非 `%%`
- **FR-007**: 計數迴圈積木的「到」MUST 採用包含端點語意：「重複：i 從 0 到 9」表示 i 取值 0, 1, 2, ..., 9（共 10 次）

**陣列存取**:
- **FR-008**: 陣列存取積木 MUST 使用中性的索引表達方式，如「arr [ INDEX ]」

**函式參數結構化**:
- **FR-009**: 函式定義積木 MUST 支援動態增減參數，每個參數包含獨立的型別選擇（下拉選單提供 int, float, double, char, bool, string, void 等基本型別，以及一個「自訂」選項允許學生輸入任意型別字串）和名稱輸入
- **FR-010**: 函式呼叫積木 MUST 支援動態增減引數，每個引數為獨立的表達式輸入插槽
- **FR-011**: 函式定義和呼叫積木的動態參數/引數 MUST 支援序列化和反序列化（儲存與還原）

**變數宣告靈活性**:
- **FR-012**: 變數宣告積木 MUST 透過 Dropdown（下拉選單）切換「有初始值」和「無初始值」兩種模式；選擇「有初始值」時顯示 `= (value)` 表達式插槽，選擇「無初始值」時隱藏該插槽
- **FR-013**: 無初始值模式下，積木 MUST 不顯示 `=` 符號和空白輸入插槽

**多變數輸入**:
- **FR-014**: 讀取輸入積木 MUST 支援動態增減變數名稱欄位
- **FR-015**: 多變數讀取輸入積木 MUST 生成正確的串接讀取語法

**向後相容**:
- **FR-016**: 現有的 code-to-blocks 轉換 MUST 繼續正確運作；已移除積木對應的語法 MUST 降級為 `c_raw_code` 或 `c_raw_expression` 積木，而非映射到已移除的積木定義
- **FR-017**: 現有的 blocks-to-code 生成 MUST 繼續正確運作
- **FR-018**: 儲存在 localStorage 中的舊版 workspace 資料不做遷移；系統載入時 MUST 清除（歸零）含有已移除積木的舊版資料，學生從空白 workspace 開始

### Key Entities

- **Block Definition（積木定義）**: 描述一個積木的外觀、連接方式、欄位定義。分為共用（universal）和語言特殊（language-specific）兩類
- **Toolbox（工具箱）**: 學生可見的積木選單，從積木定義中篩選並組織
- **Block Label（積木標籤）**: 積木上顯示的文字，是學生理解概念的主要媒介
- **Dynamic Block（動態積木）**: 支援動態增減輸入的積木（如輸出、函式定義/呼叫、讀取輸入）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 工具箱中可見的積木總數不超過 35 個（從原本 60+ 降低 40% 以上）
- **SC-002**: 所有共用積木的運算符、概念描述使用自然語言（繁體中文）或通用數學符號，無程式語法符號外露
- **SC-003**: 學生使用函式定義和呼叫積木時，不需要手動輸入任何程式語法（如逗號、型別宣告語法）
- **SC-004**: 所有現有的自動化測試繼續通過，且新增的功能有對應的測試覆蓋
- **SC-005**: 計數迴圈的「到」語意與中文直覺一致——「從 A 到 B」包含 A 和 B
- **SC-006**: 典型 APCS 程式碼（含 #include、main 函式、for 迴圈、cout/cin、陣列）的雙向轉換（code ↔ blocks）正確無誤

## Assumptions

- 目標使用者主要為繁體中文母語的 APCS/競賽程式設計學生
- 學生同時看到積木（左）和程式碼（右），積木用自然語言、程式碼用正式語法，兩者對照學習
- C++ 為當前唯一支援的語言，被移除的 C++ 積木不需要在未來語言（Python、Java）中保留
- 遞減計數迴圈（如「從 10 到 0」）超出本次範圍，可作為未來擴充
- 被移除的積木定義從系統中完全刪除，因為舊版 workspace 直接歸零且 code-to-blocks 降級為原始碼積木
- 函式參數的動態增減採用與「輸出」積木相同的加減按鈕模式

## Clarifications

### Session 2026-03-03

- Q: 變數宣告積木的「有/無初始值」模式切換應該用什麼 UI 機制？ → A: Dropdown（下拉選單）
- Q: 舊版 workspace 含有已移除積木時，載入的處理策略是？ → A: 直接刪除歸零，不做遷移
- Q: 函式參數的型別下拉選單應包含哪些型別？ → A: 基本型別（int, float, double, char, bool, string, void）+ 自由輸入選項
- Q: code-to-blocks 轉換時，已移除積木對應的語法應映射到哪裡？ → A: 降級到原始碼積木（c_raw_code / c_raw_expression）
- Q: 既然舊 workspace 歸零且轉換不再使用已移除積木，是否完全移除定義？ → A: 完全移除
