# Feature Specification: 前端 UI/UX 第一性原理合規

**Feature Branch**: `013-ux-first-principles`
**Created**: 2026-03-08
**Status**: Draft
**Input**: 前端 UI/UX 第一性原理合規：降級視覺區分、Confidence 回饋、Annotations 可見、Code Style 影響工具箱、Toolbox 動態生成、Block Style 可配置、顏色集中管理、Style 切換 UI

## User Scenarios & Testing

### User Story 1 — 降級原因視覺區分 (Priority: P1)

使用者將一段包含語法錯誤、進階寫法（如 lambda）、或系統尚未支援寫法的 C++ 程式碼轉換為積木。系統在積木視圖中對這些降級節點以不同顏色和提示文字區分原因，讓使用者立即知道「是自己寫錯」還是「系統還不認識」。

**Why this priority**: 第一性原理 §2.1 明確禁止所有降級使用相同灰色——「鷹架變成認知牢籠，違反 P4 教育學定位」。這是最關鍵的教育合規需求。

**Independent Test**: 將含語法錯誤、未支援寫法、進階寫法的程式碼轉為積木，驗證三種降級積木各自顯示正確的顏色和 tooltip。

**Acceptance Scenarios**:

1. **Given** 程式碼含語法錯誤（如 `int x = ;`），**When** 轉換為積木，**Then** 該積木顯示紅色背景，tooltip 提示「程式碼含語法錯誤」
2. **Given** 程式碼含系統未支援的已知寫法（如 AST nodeType 已知但 pattern 不匹配），**When** 轉換為積木，**Then** 該積木顯示中性灰色背景，tooltip 提示「系統尚未支援此寫法」
3. **Given** 程式碼含非標準但正確的進階寫法（如 lambda expression），**When** 轉換為積木，**Then** 該積木顯示綠色邊框，tooltip 提示「進階寫法」
4. **Given** 正常可辨識的程式碼，**When** 轉換為積木，**Then** 積木顯示正常顏色，無降級提示

---

### User Story 2 — Confidence 視覺回饋 (Priority: P1)

使用者將程式碼轉換為積木後，系統依據每個節點的 confidence 等級在積木上顯示不同的視覺風格。推斷程度低的積木有明確的視覺標記，使用者知道哪些積木是系統「確定的」、哪些是「猜測的」。

**Why this priority**: 與 US1 共同構成降級透明度的完整實現，第一性原理要求「降級必須可見」。

**Independent Test**: 將包含精確匹配、部分匹配、降級節點的程式碼轉為積木，驗證各 confidence 等級的視覺區分。

**Acceptance Scenarios**:

1. **Given** 精確匹配的程式碼（如 `int x = 5;`），**When** 轉換為積木，**Then** 積木正常顯示（confidence: high）
2. **Given** 部分可辨識的結構（子節點部分可 lift），**When** 轉換為積木，**Then** 積木顯示淡色邊框（confidence: inferred），tooltip 標示「系統推測」
3. **Given** 結構匹配但語義可疑的節點，**When** 轉換為積木，**Then** 積木顯示黃色邊框（confidence: warning），tooltip 說明可疑原因

---

### User Story 3 — 顏色集中管理與 Toolbox 動態生成 (Priority: P2)

使用者（開發者）新增積木類別或修改配色時，只需在一處修改顏色定義，所有使用該類別顏色的地方（積木、工具箱、mutator helper）自動同步。工具箱內容從積木定義檔自動生成，依認知層級過濾，不需手動維護積木清單。

**Why this priority**: P3 開放擴充原則要求「新概念可加入而不破壞既有結構」。顏色和 toolbox 的硬編碼是擴充的主要障礙。

**Independent Test**: 新增一個積木類別，只在集中的顏色定義處設定顏色，驗證該顏色自動出現在 toolbox category 和相關積木上。切換認知層級，驗證 toolbox 正確過濾。

**Acceptance Scenarios**:

1. **Given** 集中的顏色定義表存在，**When** 修改某類別的顏色值，**Then** 該類別的所有積木和 toolbox 分類都自動使用新顏色
2. **Given** BlockSpec 定義了 level=0 的積木，**When** 認知層級設為 L0，**Then** toolbox 只顯示 level <= 0 的積木
3. **Given** BlockSpec 定義了 level=2 的積木，**When** 認知層級設為 L1，**Then** toolbox 不顯示 level=2 的積木
4. **Given** 新增了一個 BlockSpec JSON 積木，**When** 重新載入應用，**Then** 該積木自動出現在正確的 toolbox 類別中，無需修改 toolbox 建構程式碼

---

### User Story 4 — Code Style 影響工具箱 (Priority: P2)

使用者選擇「APCS 風格」時，I/O 類別的工具箱優先顯示 cout/cin 積木；選擇「競賽風格」時，優先顯示 printf/scanf 積木。切換風格後工具箱立即更新。

**Why this priority**: 第一性原理 §3.2 明確規定「Code Style 影響工具箱：APCS 顯示 cout 積木、競賽顯示 printf 積木」。

**Independent Test**: 切換 Code Style preset，驗證 I/O 類別工具箱內容的順序或可見性變化。

**Acceptance Scenarios**:

1. **Given** Code Style 為 APCS，**When** 開啟 I/O 工具箱類別，**Then** `u_print` 和 `u_input` 排在最前面，`c_printf`/`c_scanf` 排在後面或收合
2. **Given** Code Style 為 competitive，**When** 開啟 I/O 工具箱類別，**Then** `c_printf` 和 `c_scanf` 排在最前面
3. **Given** 使用者從 APCS 切換到 competitive，**When** 切換完成，**Then** 工具箱 I/O 類別立即更新排序

---

### User Story 5 — Annotations 積木可見 (Priority: P2)

使用者的程式碼中含有行尾註解（如 `x = 1; // set x`），轉換為積木後，該註解在積木上以可見的方式呈現（如小型文字標籤或 tooltip），使用者知道註解沒有丟失。

**Why this priority**: 第一性原理 §1.3 要求「註解不改變程式行為，但丟了會導致系統無法用於現有專案維護」。

**Independent Test**: 將含行尾註解和獨立註解的程式碼轉為積木，驗證註解在積木視圖中可見或可透過 tooltip 查看。

**Acceptance Scenarios**:

1. **Given** 程式碼 `x = 1; // set x`，**When** 轉換為積木，**Then** `x = 1` 積木上顯示一個註解標記（如灰色文字 `// set x`），hover 可見完整內容
2. **Given** 獨立註解 `// section header`，**When** 轉換為積木，**Then** 出現一個獨立的註解積木，顯示註解文字
3. **Given** 積木上有附著的 annotation，**When** 從積木生成程式碼，**Then** annotation 還原為程式碼註解在正確位置

---

### User Story 6 — Block Style 可配置與 Style 切換 UI (Priority: P3)

使用者可透過狀態列或設定面板切換 Code Style preset（APCS / competitive / google）和 Block Style preset（Scratch 風格 / 經典風格 / 教學風格），切換後積木外觀和程式碼格式立即更新。

**Why this priority**: 第一性原理 §3.2 定義了 Block Style 五個面向（renderer、density、colour scheme、inputs inline、orientation），但非教育核心功能。

**Independent Test**: 在 UI 中切換 Code Style 和 Block Style preset，驗證積木外觀和程式碼輸出正確變化。

**Acceptance Scenarios**:

1. **Given** 狀態列顯示目前的 Code Style preset，**When** 點擊該區域，**Then** 彈出 preset 選單（APCS / competitive / google）
2. **Given** 使用者選擇新的 Code Style，**When** 選擇完成，**Then** 程式碼面板立即以新風格重新生成，積木不變
3. **Given** 狀態列顯示目前的 Block Style preset，**When** 點擊並選擇新 preset，**Then** 積木渲染器、間距、配色立即更新
4. **Given** 使用者選擇「教學風格」Block Style，**When** 套用完成，**Then** 積木使用寬鬆間距和高對比配色

---

### Edge Cases

- 多個降級原因同時存在時（如語法錯誤節點的子節點也是未知寫法），以最嚴重的原因決定顯示
- 空程式碼或全降級程式碼轉換後，工具箱和積木面板仍正常運作
- 認知層級切換後，已存在於 workspace 中的超出層級積木不自動刪除，但顯示提示
- Style 切換不影響語義樹結構，只影響投影（程式碼格式、積木外觀、工具箱排序）
- 極長的 annotation 文字不破壞積木佈局

## Requirements

### Functional Requirements

- **FR-001**: 系統 MUST 對 `degradationCause: 'syntax_error'` 的降級積木顯示紅色背景，tooltip 顯示「程式碼含語法錯誤」
- **FR-002**: 系統 MUST 對 `degradationCause: 'unsupported'` 的降級積木顯示中性灰色背景，tooltip 顯示「系統尚未支援此寫法」
- **FR-003**: 系統 MUST 對 `degradationCause: 'nonstandard_but_valid'` 的降級積木顯示綠色邊框，tooltip 顯示「進階寫法」
- **FR-004**: 系統 MUST 對 `confidence: 'warning'` 的積木顯示黃色邊框，tooltip 顯示「結構匹配但語義可疑」
- **FR-005**: 系統 MUST 對 `confidence: 'inferred'` 的積木顯示淡色或虛線邊框，tooltip 顯示「系統推測」
- **FR-006**: 系統 MUST 對 `confidence: 'high'` 的積木使用正常顯示，無額外裝飾
- **FR-007**: 系統 MUST 在積木上以可見方式呈現 annotations（行尾註解顯示為小型標籤或圖示，hover 顯示完整內容）
- **FR-008**: 系統 MUST 將獨立註解渲染為獨立的註解積木，顯示註解文字
- **FR-009**: 系統 MUST 建立集中的類別顏色定義，所有使用積木顏色的地方引用此定義
- **FR-010**: 系統 MUST 從積木定義 registry 動態生成 toolbox，依據認知層級和類別自動分組
- **FR-011**: 系統 MUST 在 Code Style 切換時，調整 I/O 類別工具箱中 cout/printf 積木的優先順序
- **FR-012**: 系統 MUST 提供 Block Style preset 機制，包含渲染器、間距密度、配色方案的組合
- **FR-013**: 系統 MUST 在狀態列或設定面板提供 Code Style preset 切換入口
- **FR-014**: 系統 MUST 在狀態列或設定面板提供 Block Style preset 切換入口
- **FR-015**: Style 切換 MUST NOT 影響語義樹結構

### Key Entities

- **DegradationVisual**: 降級原因到視覺樣式的映射（顏色、邊框、tooltip 文字）
- **ConfidenceVisual**: confidence 等級到視覺樣式的映射
- **CategoryColor**: 積木類別名稱到顏色值的集中映射
- **BlockStylePreset**: Block Style 的參數組合（renderer、density、colour scheme、inputs inline）
- **ToolboxConfig**: 動態生成的工具箱配置，依據 level、category、style 過濾和排序

## Success Criteria

### Measurable Outcomes

- **SC-001**: 使用者能通過積木顏色區分降級原因（語法錯誤 vs 系統不支援 vs 進階寫法），三種原因的視覺區分度經使用者測試達 90% 正確辨識率
- **SC-002**: 新增積木類別時，只需在 1 個檔案中定義顏色，0 處硬編碼需要手動同步
- **SC-003**: 工具箱 100% 由積木定義 registry 動態生成，0 行硬編碼的積木清單
- **SC-004**: Code Style 切換後 500ms 內工具箱和程式碼面板完成更新
- **SC-005**: 所有現有測試在實作後仍 100% 通過
- **SC-006**: 含有註解的程式碼轉為積木後，100% 的行尾註解和獨立註解在積木視圖中可見或可透過互動查看

## Assumptions

- 降級視覺樣式的具體顏色值可在實作時調整，但三種原因必須視覺可區分
- Block Style preset 初期提供 2-3 個預設選項即可，不需自訂 preset 編輯器
- Tooltip 使用積木系統內建的 tooltip 機制，不需自訂浮動面板
- Annotation 在積木上的呈現方式以不破壞積木佈局為前提，可用圖示 + hover 方案
- 認知層級切換影響 toolbox 可見積木，但不影響 workspace 中已存在的積木
