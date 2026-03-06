# 功能規格：補齊轉換管線

**功能分支**: `010-complete-conversion-pipeline`
**建立日期**: 2026-03-06
**狀態**: 草稿
**輸入**: 使用者描述：「補齊所有轉換管線的缺口：Code→Semantic lifter、Semantic→Blocks renderer、雙向轉換完整性」

## 澄清

### Session 2026-03-06

- Q: P3 要求新積木只加 JSON。程式碼→積木方向目前無通用 astPattern lift 機制。應建立通用引擎還是手寫每個 lifter？ → A: 建立通用 astPattern lift 引擎，大部分積木透過 JSON pattern 覆蓋，僅對複雜構造（cout chain、for loop 型別推導）保留手寫 lifter。

## 使用者情境與測試

### 使用者故事 0 — 通用 astPattern Lift 引擎 (優先級: P0)

系統「必須」建立一個通用的 astPattern 驅動 lift 機制，使得積木 JSON 中定義了 `astPattern` 的積木能自動從 C++ 程式碼辨識並還原，而無需手寫 TypeScript lifter。這是 P3（開放擴充）的核心基礎設施。

**為何此優先級**: 這是所有後續使用者故事的基礎。沒有此引擎，42 個缺失積木都需要手寫 lifter，違反 P3 且工作量巨大。建好此引擎後，大部分 L2 積木只需 JSON 即可完成雙向轉換。

**獨立測試**: 選取一個已有 `astPattern` 的積木 JSON（如 `c_increment`），在不寫任何 TypeScript lifter 的情況下，驗證其程式碼能被 astPattern 引擎自動 lift 為正確的語義概念，再由 renderer 還原為正確的積木。

**驗收情境**:

1. **給定** 積木 JSON 中定義了 `astPattern: { nodeType: "update_expression", constraints: [...] }`，**當** 解析到匹配的 AST 節點，**則** 自動產生對應的語義概念節點，欄位從 AST 子節點提取。
2. **給定** 積木 JSON 中定義了 `codeTemplate` 和 `astPattern`，**當** 從積木產生程式碼再解析回來，**則** astPattern 引擎能辨識並還原為同一積木類型。
3. **給定** 一個 AST 節點同時匹配手寫 lifter 和 astPattern，**當** lift 時，**則** 手寫 lifter 優先（允許對複雜構造做精確控制）。
4. **給定** 一個 AST 節點不匹配任何 astPattern 也無手寫 lifter，**當** lift 時，**則** 退化為 `c_raw_code`（P1 有損保留）。

---

### 使用者故事 1 — L1 積木雙向轉換 (優先級: P1)

學生使用 C++ 中級積木（遞增遞減、複合賦值、for 迴圈、do-while、switch/case、字元字面值、printf、scanf）建構程式，轉換成程式碼後再轉回積木。每個積木都必須在來回轉換後還原為原本的積木類型，而非退化成 raw code。

**為何此優先級**: L1 積木是 L0 基礎之後最常用的構造。學生頻繁在程式碼與積木視圖之間切換，若退化為 raw code，工具將無法用於典型的學習場景。

**獨立測試**: 將每種 L1 積木放上工作區，觸發「積木→程式碼」再觸發「程式碼→積木」，驗證每種積木類型都正確重建。

**驗收情境**:

1. **給定** `c_increment` 積木（`i++`），**當** 進行積木→程式碼→積木轉換，**則** 重建的積木為 `c_increment`，變數與運算子正確。
2. **給定** `c_compound_assign` 積木（`x += 5`），**當** 來回轉換，**則** 重建為 `c_compound_assign`，欄位正確。
3. **給定** `c_for_loop` 積木含初始化/條件/更新與主體，**當** 來回轉換，**則** 重建為 `c_for_loop`，巢狀積木完整。
4. **給定** `c_do_while` 積木含主體與條件，**當** 來回轉換，**則** 重建為 `c_do_while`。
5. **給定** `c_switch` 積木含巢狀 `c_case` 積木，**當** 來回轉換，**則** switch/case 結構保留。
6. **給定** `c_char_literal` 積木（`'A'`），**當** 來回轉換，**則** 重建為 `c_char_literal`。
7. **給定** `c_printf` 和 `c_scanf` 積木，**當** 來回轉換，**則** 兩者皆以正確的格式字串與參數重建。

**實作策略（P3 對齊）**: L1 積木中，`c_for_loop`、`c_switch`/`c_case` 因有複雜的巢狀結構需要手寫 lifter；其餘（`c_increment`、`c_compound_assign`、`c_do_while`、`c_char_literal`、`c_printf`、`c_scanf`）優先透過 astPattern 引擎覆蓋。

---

### 使用者故事 2 — L2 積木雙向轉換 (優先級: P2)

學生使用進階 C++ 積木（指標、結構體、STL 容器、物件導向、演算法、前處理器指令）建構程式並來回轉換。所有 L2 積木都必須還原而非退化。

**為何此優先級**: L2 積木是進階功能。雖然使用頻率較低，但退化會破壞進階學生的學習體驗。

**獨立測試**: 將每種 L2 積木放上工作區，來回轉換後驗證重建。

**驗收情境**:

1. **給定** 指標積木（`c_pointer_declare`、`c_pointer_deref`、`c_address_of`、`c_malloc`、`c_free`），**當** 來回轉換，**則** 各自重建為正確的積木類型。
2. **給定** 結構體積木（`c_struct_declare`、`c_struct_member_access`、`c_struct_pointer_access`），**當** 來回轉換，**則** 各自正確重建。
3. **給定** 字串函式積木（`c_strlen`、`c_strcmp`、`c_strcpy`），**當** 來回轉換，**則** 各自正確重建。
4. **給定** STL 容器積木（`cpp_vector_declare`、`cpp_map_declare`、`cpp_string_declare`、`cpp_stack_declare`、`cpp_queue_declare`、`cpp_set_declare`），**當** 來回轉換，**則** 各自正確重建。
5. **給定** 容器操作積木（`cpp_vector_push_back`、`cpp_vector_size`、`cpp_method_call`、`cpp_method_call_expr`、`cpp_sort`），**當** 來回轉換，**則** 各自正確重建。
6. **給定** 物件導向積木（`cpp_class_def`、`cpp_new`、`cpp_delete`、`cpp_template_function`），**當** 來回轉換，**則** 各自正確重建。
7. **給定** 前處理器積木（`c_ifdef`、`c_ifndef`），**當** 來回轉換，**則** 各自正確重建。

**實作策略（P3 對齊）**: L2 積木全部透過 astPattern 引擎覆蓋（它們的 AST 結構相對規律，適合 pattern matching）。不寫任何手寫 TypeScript lifter。

---

### 使用者故事 3 — 手寫程式碼轉積木 (優先級: P3)

學生在程式碼編輯器中手寫 C++ 程式碼（for 迴圈、i++、x+=5、do-while、switch/case、指標操作等），然後轉換為積木。系統應產生最精確的積木類型，而非退化為 raw code。

**為何此優先級**: 以閱讀/撰寫程式碼為先的學生需要「程式碼→積木」方向能正常運作。這是「匯入」路徑，對教師提供範例程式碼的教學場景至關重要。

**獨立測試**: 在程式碼編輯器中輸入常見 C++ 程式碼模式，觸發「程式碼→積木」，驗證每個模式對應到正確的積木類型。

**驗收情境**:

1. **給定** 程式碼 `i++;`，**當** 轉換程式碼→積木，**則** 產生 `c_increment` 積木。
2. **給定** 程式碼 `x += 5;`，**當** 轉換，**則** 產生 `c_compound_assign` 積木。
3. **給定** 程式碼 `for(int i=0; i<10; i++) { ... }`，**當** 轉換，**則** 產生 `c_for_loop` 或 `u_count_loop` 積木（以最適合者為準）。
4. **給定** 程式碼 `do { ... } while(x > 0);`，**當** 轉換，**則** 產生 `c_do_while` 積木。
5. **給定** 程式碼 `switch(x) { case 1: ... break; }`，**當** 轉換，**則** 產生 `c_switch` 搭配巢狀 `c_case` 積木。
6. **給定** 程式碼 `int *p = &x;`，**當** 轉換，**則** 產生對應的指標積木。
7. **給定** 程式碼 `printf("hello %d", x);`，**當** 轉換，**則** 產生 `c_printf` 積木。
8. **給定** 程式碼 `scanf("%d", &x);`，**當** 轉換，**則** 產生 `c_scanf` 積木。
9. **給定** 程式碼 `vector<int> v;`，**當** 轉換，**則** 產生 `cpp_vector_declare` 積木。
10. **給定** 程式碼 `v.push_back(5);`，**當** 轉換，**則** 產生 `cpp_method_call` 積木。

---

### 邊界情況

- 無法辨識的 for 迴圈模式（如 `for(;;)`）應優雅退化為 `c_raw_code`（P1 有損保留：結構化語義降低但原始文字不丟失）。
- 巢狀結構（如 switch 嵌在 for 迴圈內）每一層都應正確轉換。
- 不支援的構造（如模板特化）應退化為 raw code 而不當機。
- 多重指標解參考（如 `**pp`）應被處理或優雅退化。
- 混用 C 風格和 C++ 風格 I/O（同一程式中有 printf 和 cout）兩者都應被辨識。
- 空的 switch/case 主體應產生合法積木。
- 所有複合賦值運算子（+=、-=、*=、/=、%=、&=、|=、^=、<<=、>>=）都應被處理。
- 前置遞增（`++i`）和後置遞增（`i++`）都應被辨識。
- 當 AST 節點同時匹配手寫 lifter 和 astPattern 時，手寫 lifter 優先。
- 積木 JSON 中缺少 `astPattern` 的積木仍可透過手寫 lifter 或 `generateFromTemplate` 回退支援。

## 需求

### 功能需求

- **FR-001**: 系統中定義的每個積木類型（universal.json、basic.json、advanced.json、special.json）都「必須」有完整的「積木→程式碼→積木」來回轉換路徑，產生的程式碼能解析回相同的積木類型。
- **FR-002**: 系統「必須」建立通用的 astPattern 驅動 lift 引擎，讀取積木 JSON 中的 `astPattern` 定義，自動將匹配的 AST 節點轉換為對應的語義概念。此引擎遵循 P3（開放擴充），使未來新增積木只需 JSON 定義即可支援雙向轉換。
- **FR-003**: 對於 astPattern 無法表達的複雜構造（如 cout/cin chain、for loop 計數模式偵測、switch/case 巢狀結構），系統「必須」保留手寫 lifter 機制，且手寫 lifter 的優先級高於 astPattern 匹配。
- **FR-004**: 「語義→積木」的 renderer「必須」為 lifter 能產生的每個語義概念提供映射條目（CONCEPT_TO_BLOCK），使 lift 後的程式碼對應到特定積木類型而非 raw code。
- **FR-005**: 「積木→語義」的 extractor「必須」透過明確的 case handler 或 `generateFromTemplate` 模板式回退，正確提取所有積木類型的語義節點。
- **FR-006**: 「語義→程式碼」的 generator「必須」為系統中的每個語義概念產生合法且可解析的 C++ 程式碼。對於透過 astPattern 引擎處理的概念，可由 codeTemplate 驅動生成。
- **FR-007**: 當 C++ 構造無法對應到特定積木類型時，系統「必須」優雅退化為 `c_raw_code` 或 `c_raw_expression`，保留原始程式碼文字（P1 有損保留保證）。
- **FR-008**: 系統「必須」維持向後相容。在此變更之前儲存的積木「必須」仍能載入並正常運作。

### 關鍵實體

- **語義概念 (Semantic Concept)**: 程式設計構造的語言無關表示（P2 概念代數）。分為三層：Layer 0 Universal（變數、迴圈、if、函式）、Layer 1 Lang-Core（指標、struct、switch、for）、Layer 2 Lang-Library（vector、printf、sort）。每個概念有屬性、子節點，並對應到一個積木類型。
- **astPattern 引擎**: 通用的 AST→語義 lift 機制（P3 開放擴充的核心）。讀取積木 JSON 中的 `astPattern` 定義，自動匹配 tree-sitter AST 節點並產生語義概念。
- **手寫 Lifter**: 針對複雜構造的 TypeScript lifter 註冊。優先級高於 astPattern。用於 cout/cin chain、for loop 計數偵測、switch/case 等無法用簡單 pattern 表達的構造。
- **積木渲染器 (Block Renderer)**: 語義概念到積木類型及渲染邏輯之間的映射（CONCEPT_TO_BLOCK + renderBlock switch）。每個新概念需要一個條目。
- **程式碼產生器 (Code Generator)**: 語義概念到 C++ 原始碼的映射。手寫 generator 或 codeTemplate 驅動。

## 成功標準

### 可衡量成果

- **SC-001**: 系統中 100% 的積木類型（目前 72 個）都能完成「積木→程式碼→積木」來回轉換，產生相同的積木類型——以自動化測試驗證。
- **SC-002**: 至少 90% 入門程式設計課程常用的 C++ 構造（變數、賦值、算術、比較、if/else、迴圈、函式、陣列、I/O、遞增、複合賦值、switch、for 迴圈、do-while）能從手寫程式碼轉換為特定積木類型。
- **SC-003**: 所有既有測試在變更後繼續通過（零回歸）。
- **SC-004**: 每個新增的語義概念至少有一個單元測試驗證其來回轉換。
- **SC-005**: 新增一個「測試用積木」僅透過 JSON 定義（含 astPattern + codeTemplate），無需任何 TypeScript 程式碼，即可完成雙向轉換——驗證 P3 開放擴充目標達成。

## 假設

- tree-sitter C++ 文法能正確將所有目標構造解析為可辨識的 AST 節點類型。
- JSON 檔案中現有的積木定義具有正確的 `codeTemplate` 模式，能產生可解析的 C++ 程式碼。若部分積木的 `astPattern` 缺失或不正確，需在此功能中補齊。
- 新增語義概念遵循 P2 概念代數的分層命名：Layer 1 用 `cpp_*`（如 `cpp_increment`、`cpp_do_while`），Layer 2 用 `cpp_*` 加模組前綴（如 `cpp_vector_declare`、`cpp_sort`）。
- astPattern 引擎的匹配能力足以覆蓋大部分 L2 積木（結構相對規律的 call_expression、declaration 等），複雜結構由手寫 lifter 處理。
