# Feature Specification: First Principles Compliance

**Feature Branch**: `012-first-principles-compliance`
**Created**: 2026-03-07
**Status**: Draft
**Input**: User description: "第一性原理合規：1) ConceptRegistry 完備性驗證腳本；2) confidence 與 degradationCause 一致性；3) 註解 roundtrip；4) Code Style preset"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ConceptRegistry 完備性驗證 (Priority: P1)

開發者在新增或修改概念定義後，執行一個驗證工具。工具自動掃描系統中所有已註冊的概念（來自 block spec JSON、lift-patterns JSON、strategy 註冊），對每個概念檢查四條路徑是否都存在：lift（AST to concept）、render（concept to Block）、extract（Block to concept）、generate（concept to Code）。如果任何概念缺少任何一條路徑，工具輸出缺失清單並以非零退出碼結束。

**Why this priority**: 這是 P2（概念代數）的 0 容忍規則。缺少路徑 = coverage gap = 架構缺陷。自動化驗證是防止回歸的基礎閘門，所有其他功能都依賴概念路徑的完整性。

**Independent Test**: 可以獨立執行驗證工具，針對現有概念集合產出通過/失敗報告。不依賴其他 user story。

**Acceptance Scenarios**:

1. **Given** 系統中有 N 個已註冊概念，**When** 執行驗證工具，**Then** 工具檢查每個概念的四條路徑，全部存在時退出碼為 0
2. **Given** 某個概念缺少 generate path，**When** 執行驗證工具，**Then** 工具輸出該概念 ID 和缺失的路徑名稱，退出碼為非零
3. **Given** 開發者新增一個概念但只定義了 lift 和 render，**When** 執行驗證工具，**Then** 工具報告該概念缺少 extract 和 generate 路徑
4. **Given** 驗證工具通過，**When** 執行完整的 roundtrip 測試套件，**Then** 所有概念的 lift-render-extract-generate-lift 循環語義等價

---

### User Story 2 - Confidence 與 DegradationCause 一致性 (Priority: P2)

當系統將程式碼轉換為積木時，每個語義節點都攜帶明確的 confidence 等級。精確匹配的節點標記為 high，結構匹配但語義可疑的標記為 warning，推斷的標記為 inferred，無法結構化的標記為 raw_code。當節點降級為 raw_code 時，必須同時標記降級原因（程式碼錯誤 / 系統能力不足 / 非標準但正確）。在積木視圖中，降級積木的視覺呈現根據原因區分：程式碼錯誤顯示紅色警告、系統能力不足顯示中性灰色、非標準但正確的寫法顯示綠色邊框。

**Why this priority**: 這是教育學核心需求。如果所有降級都用相同視覺，學習者會將「系統不認識」誤解為「我寫錯了」，鷹架變成認知牢籠，違反 P4 教育學定位。

**Independent Test**: 可以用包含不同類型降級的測試程式碼，驗證 lift 後每個節點的 confidence 和 degradationCause 欄位是否正確設定，以及積木渲染是否根據原因顯示不同顏色。

**Acceptance Scenarios**:

1. **Given** 一段語法正確且 pattern 匹配的程式碼，**When** lift() 處理後，**Then** 產生的語義節點 confidence 為 high
2. **Given** 一段 composite pattern 結構匹配但語義驗證未通過的程式碼，**When** lift() 處理後，**Then** 產生的語義節點 confidence 為 warning
3. **Given** 一段語法錯誤的程式碼片段，**When** lift() 將其降級為 raw_code，**Then** degradationCause 為 syntax_error，積木視圖顯示紅色警告
4. **Given** 一段語法正確但系統無法辨識的寫法，**When** lift() 將其降級，**Then** degradationCause 為 unsupported，積木視圖顯示中性灰色
5. **Given** 一段語法正確且能通過編譯但不匹配任何 pattern 的進階寫法，**When** lift() 將其降級，**Then** degradationCause 為 nonstandard_but_valid，積木視圖顯示綠色邊框

---

### User Story 3 - 註解 Roundtrip (Priority: P2)

使用者的程式碼中包含各種註解：行尾註解（`x = 1; // set x`）、獨立註解（`// section header`）、以及表達式內部的註解（`foo(a, /* important */ b)`）。當程式碼轉換為積木再轉回程式碼時，所有註解的內容和相對位置都被保留。獨立註解作為平級的語義節點存在，行尾註解附著在其宿主節點上，表達式內部的註解附著在對應的子節點上。

**Why this priority**: 與 US2 同為 P2。註解保留是 R0 投影完整性的組成部分。如果 roundtrip 丟失註解，系統無法用於維護有大量註解的現有專案。

**Independent Test**: 可以用包含各種註解類型的測試程式碼，執行 code-blocks-code roundtrip，驗證註解內容和位置是否保留。

**Acceptance Scenarios**:

1. **Given** 程式碼 `x = 1; // set x`，**When** 執行 roundtrip，**Then** 行尾註解 `// set x` 仍附著在同一個語句後面
2. **Given** 程式碼中有獨立註解 `// section header` 位於兩個語句之間，**When** 執行 roundtrip，**Then** 獨立註解保留在相同的相對位置
3. **Given** 積木視圖中使用者拖動一個帶有行尾註解的積木到新位置，**When** 生成程式碼，**Then** 行尾註解跟隨積木一起移動
4. **Given** 程式碼 `foo(a, /* important */ b)`，**When** 執行 roundtrip，**Then** 表達式內部註解 `/* important */` 保留在參數 b 之前

---

### User Story 4 - Code Style Preset (Priority: P3)

使用者可以從預設的程式碼風格中選擇（如 APCS 考試風格、程式競賽風格、Google Style），或自訂風格參數。選擇不同風格後，系統從同一棵語義樹重新生成程式碼，產出符合所選風格的結果。風格切換不影響語義樹，也不影響積木視圖。風格參數包括：I/O 函式偏好（cout/cin vs printf/scanf）、縮排大小、命名慣例建議格式、大括號位置、namespace 使用方式等。

**Why this priority**: 這是 P1（投影定理）的 View Params 實現。Code Style 是 code viewType 的參數，切換 = 重新投影。優先度低於 US1-US3 因為不影響架構正確性，是產品體驗的提升。

**Independent Test**: 可以用同一段積木，分別以不同 preset 生成程式碼，驗證輸出格式差異且語義等價。

**Acceptance Scenarios**:

1. **Given** 一棵包含 print 概念的語義樹，**When** 使用者選擇 APCS 風格，**Then** 生成的程式碼使用 `cout` 進行輸出
2. **Given** 同一棵語義樹，**When** 使用者切換為競賽風格，**Then** 生成的程式碼改用 `printf` 進行輸出
3. **Given** 使用者選擇 Google Style（2-space indent），**When** 生成程式碼，**Then** 縮排為 2 個空格
4. **Given** 使用者切換風格後，**When** 檢查積木視圖，**Then** 積木不變（語義樹未改動）
5. **Given** 使用者貼入一段程式碼，**When** 系統偵測其風格，**Then** 自動選擇最匹配的 preset

---

### Edge Cases

- 某個概念只在特定語言模組中定義了部分路徑（如只有 lift 沒有 render）——驗證工具如何處理語言特定概念？
- lift() 遇到巢狀結構，外層匹配成功但內層降級——外層 confidence 獨立，只看自身 pattern 匹配結果，不受子節點影響
- 獨立註解緊鄰在另一個獨立註解旁邊——兩個連續註解是否保持各自獨立的節點？
- 使用者自訂 Code Style 參數部分覆蓋了 preset——採淺層覆蓋：自訂值直接覆蓋 preset 同名欄位，其餘保留 preset 預設
- 程式碼同時包含 cout 和 printf——風格偵測如何判定？
- 行尾註解所在的語句被 lift() 降級為 raw_code——註解仍作為獨立 annotation 附著在 raw_code 節點上，不合併進 rawCode 文字

## Requirements *(mandatory)*

### Functional Requirements

**ConceptRegistry 完備性驗證**

- **FR-001**: 系統 MUST 提供一個可執行的驗證工具，掃描所有已註冊概念並檢查四條路徑的存在性
- **FR-002**: 驗證工具 MUST 從所有概念來源收集概念 ID（block spec JSON、lift-patterns JSON、strategy 註冊、universal templates）
- **FR-003**: 驗證工具 MUST 對每個概念 ID 檢查：lift path、render path、extract path、generate path 是否存在
- **FR-004**: 驗證工具 MUST 在發現缺失路徑時輸出結構化報告（概念 ID、缺失路徑、來源檔案）
- **FR-005**: 驗證工具 MUST 以非零退出碼結束（當存在缺失路徑時），以便整合到持續驗證流程

**Confidence 與 DegradationCause**

- **FR-006**: lift() 處理每個 AST 節點後，產生的語義節點 MUST 帶有明確的 confidence 值（不可為 undefined）
- **FR-007**: confidence 為 raw_code 的節點 MUST 同時設定 degradationCause（syntax_error / unsupported / nonstandard_but_valid）
- **FR-008**: composite pattern 結構匹配成功但語義驗證未通過時，MUST 設定 confidence 為 warning
- **FR-009**: 積木視圖 MUST 根據 degradationCause 顯示不同的視覺樣式（紅色 / 灰色 / 綠色）
- **FR-010**: 降級積木的 tooltip MUST 顯示人類可讀的降級原因說明

**註解 Roundtrip**

- **FR-011**: lift() MUST 將行尾註解轉換為宿主語義節點的 annotation（position: inline）
- **FR-012**: lift() MUST 將獨立註解轉換為平級的 comment 語義節點
- **FR-013**: lift() MUST 將表達式內部的註解轉換為對應子節點的 annotation（position: before）
- **FR-014**: generate() MUST 將 annotation 還原為對應位置的程式碼註解
- **FR-015**: 積木視圖中移動帶有 annotation 的積木時，annotation MUST 跟隨移動

**Code Style Preset**

- **FR-016**: 系統 MUST 提供至少三個預設風格（APCS 考試、程式競賽、Google Style）
- **FR-017**: 每個風格 preset MUST 定義：I/O 函式偏好、縮排大小、大括號位置、namespace 使用方式
- **FR-018**: generate() MUST 根據當前選擇的風格 preset 產出對應格式的程式碼
- **FR-019**: 風格切換 MUST NOT 修改語義樹或積木視圖
- **FR-020**: 系統 SHOULD 在使用者貼入程式碼時自動偵測最接近的風格 preset

### Key Entities

- **ConceptEntry**: 一個已註冊概念，包含概念 ID、來源（哪個 JSON/registry）、四條路徑的存在狀態
- **ConfidenceLevel**: 語義節點的確定程度（high / warning / inferred / user_confirmed / llm_suggested / raw_code）
- **DegradationCause**: 降級原因（syntax_error / unsupported / nonstandard_but_valid）
- **Annotation**: 附著在語義節點上的註解，包含類型（comment / pragma / lint_directive）、文字內容、位置（before / after / inline）
- **CodeStylePreset**: 程式碼風格預設，包含名稱、I/O 偏好、縮排、大括號位置、namespace 策略等參數

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 驗證工具執行後，系統中 100% 的已註冊概念擁有完整的四條路徑（0 缺失）
- **SC-002**: lift() 處理任意合法教學程式碼後，100% 的語義節點帶有明確的 confidence 值（無 undefined）
- **SC-003**: 包含行尾註解和獨立註解的程式碼執行 roundtrip 後，100% 的註解內容和相對位置被保留
- **SC-004**: 使用者在三個 preset 之間切換時，語義樹保持不變，生成的程式碼格式符合所選 preset 的所有參數
- **SC-005**: 所有現有測試在變更後繼續通過，不引入回歸
- **SC-006**: 驗證工具的執行時間不超過 5 秒（針對目前的概念數量規模）

## Clarifications

### Session 2026-03-07

- Q: unsupported 與 nonstandard_but_valid 的判定邊界？ → A: 依 ConceptRegistry 判定——AST 節點類型對應已知概念但寫法不匹配任何 pattern = unsupported；AST 節點類型完全不在 ConceptRegistry 中 = nonstandard_but_valid
- Q: 外層 confidence 是否受內層降級影響？ → A: 外層 confidence 獨立於內層，只看自身 pattern 匹配結果
- Q: 自訂 Code Style 與 preset 的合併策略？ → A: 淺層覆蓋——自訂參數直接覆蓋 preset 同名欄位，其餘保留 preset 預設值
- Q: raw_code 節點上的行尾註解如何處理？ → A: 保留為 annotation——即使宿主降級為 raw_code，行尾註解仍作為獨立 annotation 附著

## Assumptions

- 011-unified-pattern-engine 已完成或接近完成，Pattern Engine 為單一管線架構
- 概念來源已統一：block spec JSON + lift-patterns JSON + StrategyRegistry
- C++ 是目前唯一支援的語言，Code Style preset 只針對 C++
- tree-sitter 能正確解析 C++ 註解（行尾 `//` 和區塊 `/* */`）
- 降級原因的判定規則：tree-sitter 產生 ERROR 節點 = syntax_error；AST 節點類型對應 ConceptRegistry 中已知概念但寫法不匹配任何 pattern = unsupported；AST 節點類型完全不在 ConceptRegistry 中 = nonstandard_but_valid
- Code Style 的命名慣例僅影響新建變數的預設格式，不自動重命名既有變數

## Scope Boundaries

**包含在範圍內**:
- C++ 語言的概念路徑驗證
- C++ lift() 的 confidence/degradationCause 設定
- C++ 的三種註解類型 roundtrip
- C++ 的三個 Code Style preset

**不在範圍內**:
- 其他程式語言的支援
- P4 漸進揭露的 level 切換 UX
- SemanticNode.id 穩定識別符（StableId）
- 語法偏好記錄（metadata.syntaxPreference）
- 將驗證工具整合到 CI/CD pipeline（可後續追加）
