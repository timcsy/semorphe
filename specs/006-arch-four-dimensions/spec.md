# Feature Specification: 架構重構 — 四維分離與語義模型

**Feature Branch**: `006-arch-four-dimensions`
**Created**: 2026-03-04
**Status**: Draft
**Input**: 基於 docs/first-principles.md 六個基本原則（P1-P6），將現有系統重構為四維正交架構（Concept × Language × Style × Locale），使得未來加新程式語言、新編碼風格、新 UI 語言都是 O(1) 的工作量。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Locale 分離：積木文字與積木結構解耦 (Priority: P1)

教師或開發者需要將積木介面切換為不同語言（如英文），或修改某個積木的中文用詞時，只需要編輯一個翻譯檔案，不需要動到積木定義本身。

**Why this priority**: Locale 分離是整個四維架構的基礎，也是風險最低、收益最高的第一步。目前中文文字直接寫死在 67+ 個積木的 JSON 定義中，任何文字修改都要在多個檔案中搜尋。分離後，所有文字集中管理，且為後續維度（Language、Style）打下基礎。

**Independent Test**: 將所有積木文字抽離到翻譯檔後，開啟應用程式，所有積木的 message、tooltip、dropdown label 顯示與重構前完全一致。

**Acceptance Scenarios**:

1. **Given** 積木定義 JSON 中不包含任何自然語言文字（message、tooltip 皆為 key 引用），**When** 應用程式啟動並載入 zh-TW 翻譯檔，**Then** 所有 67+ 個積木的 message、tooltip、dropdown label 顯示的中文與重構前完全一致
2. **Given** 一份新的 locale 翻譯檔（如 en），**When** 應用程式載入該翻譯檔並啟動，**Then** 所有積木顯示對應語言的文字，無需修改任何積木定義 JSON
3. **Given** 動態積木（u_print、u_func_def、u_var_declare 等在程式碼中定義的積木），**When** 應用程式啟動，**Then** 這些積木的文字也從翻譯檔載入，不寫死在程式碼中
4. **Given** 修改翻譯檔中某個 tooltip 的文字，**When** 重新載入應用程式，**Then** 對應積木的 tooltip 更新，其他積木不受影響

---

### User Story 2 - Language Module：型別系統與語言專屬積木解耦 (Priority: P1)

系統需要支援未來新增其他程式語言（如 Python、Java）。型別清單、語言專屬積木、tooltip 覆蓋等都應該由語言模組提供，而非寫死在 universal 積木定義中。

**Why this priority**: 與 US1 同為 P1，因為目前 universal 積木中混入了 C++ 特有的型別（double、char、long long），這違反了概念分層原則。Language Module 介面的建立是支援多語言的前提。

**Independent Test**: 將 C++ 型別清單從 universal.json 移到語言模組後，開啟應用程式，所有型別 dropdown 的選項與重構前完全一致。

**Acceptance Scenarios**:

1. **Given** universal 積木定義中的型別 dropdown 不包含具體型別選項，**When** C++ 語言模組載入，**Then** 所有型別 dropdown（u_var_declare、u_func_def、u_array_declare 等）自動填入 C++ 型別清單
2. **Given** 語言模組提供了某個 universal 積木的 tooltip 覆蓋，**When** 應用程式啟動，**Then** 該積木的 tooltip 顯示語言模組提供的版本，而非預設版本
3. **Given** 語言模組指定某些 universal 積木不適用（如 Python 不需要型別宣告），**When** 切換到該語言，**Then** 工具箱中不顯示那些積木
4. **Given** 語言模組提供了語言專屬積木定義，**When** 切換到該語言，**Then** 工具箱中出現語言專屬的積木分類

---

### User Story 3 - Style Layer：編碼風格可切換 (Priority: P2)

學生或教師可以選擇不同的編碼風格 preset（如 APCS 考試、競賽、Google Style），系統會根據風格生成對應格式的程式碼，並能從貼入的程式碼自動偵測風格。

**Why this priority**: 風格切換是進階功能，依賴 US1/US2 的基礎架構。但它對教學有重要價值——不同教材、考試、競賽使用不同的 coding style，學生需要能在不同風格之間切換。

**Independent Test**: 選擇「競賽風格」preset 後，同一組積木生成的程式碼使用 printf/scanf，切回「APCS 風格」後生成 cout/cin，積木本身不變。

**Acceptance Scenarios**:

1. **Given** 使用者已用積木拼出一段程式（包含 u_print 輸出積木），**When** 從「APCS 風格」切換到「競賽風格」，**Then** 積木不變，但程式碼編輯器中的程式碼從 cout 語法變為 printf 語法（同一個 u_print 積木，generator 根據風格產出不同語法）
2. **Given** 使用者貼入一段使用 printf/scanf 的程式碼，**When** 系統解析該程式碼，**Then** 自動偵測到「競賽風格」並轉換為相同的 universal 積木（u_print/u_input）
3. **Given** 目前風格設定為任何風格，**When** 使用者瀏覽工具箱，**Then** 工具箱顯示統一的 universal I/O 積木（u_print/u_input），不區分 cout/printf
4. **Given** 使用者切換風格，**When** 切換完成後進行程式碼→積木→程式碼的 round-trip 轉換，**Then** 語義保持不變，僅格式風格不同

---

### User Story 4 - 語義模型顯式化：建立程式的中間表示 (Priority: P2)

系統的雙向轉換流程從「程式碼 ↔ 積木」改為「程式碼 ↔ 語義模型 ↔ 積木」，語義模型成為唯一的真實來源，確保所有轉換的無損性。

**Why this priority**: 語義模型是整個架構的核心。本階段將建立真正獨立的 SemanticNode 樹作為程式的中間表示，Blockly workspace 和程式碼都從這棵樹衍生。這使得 round-trip 轉換有明確的正確性判定標準，並為跨語言轉換奠定基礎。由於風險較高且需要大幅重構轉換流程，列為 P2。

**Independent Test**: 使用語義模型作為中間表示後，所有現有的 260+ 測試通過，且 round-trip 轉換結果與重構前一致。

**Acceptance Scenarios**:

1. **Given** 使用者在程式碼編輯器輸入一段程式，**When** 系統進行 code→blocks 轉換，**Then** 內部先轉換為語義模型，再從語義模型渲染為積木，結果與直接轉換一致
2. **Given** 使用者在積木編輯器拖拉積木，**When** 系統進行 blocks→code 轉換，**Then** 內部先從積木讀取語義模型，再從語義模型生成程式碼，結果與直接轉換一致
3. **Given** 一段包含多種語法（變數、迴圈、函式、陣列）的程式，**When** 進行 parse(generate(S)) 的 round-trip，**Then** 得到的語義模型 S' 與原始語義模型 S 在語義上等價
4. **Given** 程式碼中包含系統無法對應的語法，**When** 系統解析該程式碼，**Then** 無法對應的部分被降級為「原始碼」節點，保留在語義模型中，不丟失任何資訊

---

### User Story 5 - 多語言基礎設施驗證 (Priority: P3)

開發者能夠建立一個新的語言模組（如 Python stub），註冊到系統中，驗證整個 Language Module 架構可以正確運作。

**Why this priority**: 這是驗證性質的 story，確認 US2 建立的介面足夠完整。目前不需要完整實作 Python 支援，只需要用一個最小的 stub 模組驗證架構。

**Independent Test**: 建立一個僅包含基本型別和少數積木的 Python stub 模組，切換到 Python 後工具箱正確顯示，切回 C++ 後一切正常。

**Acceptance Scenarios**:

1. **Given** 一個 Python stub 語言模組（包含 int/float/str/bool 型別和基本變數/迴圈/函式概念），**When** 註冊到系統中，**Then** 系統啟動不報錯
2. **Given** 系統已載入 Python stub 模組，**When** 使用者切換到 Python，**Then** 工具箱顯示 Python 的型別選項（int/float/str/bool），隱藏 C++ 專屬積木（指標、struct 等）
3. **Given** Python 中不存在「指標」概念，**When** 語義模型中包含指標節點嘗試渲染為 Python 積木，**Then** 系統使用降級策略（如顯示為原始碼積木），不崩潰且不丟失資訊
4. **Given** 使用者從 Python 切回 C++，**When** 切換完成，**Then** C++ 所有積木和功能恢復正常，Python 的臨時狀態不影響 C++ 模式

---

### Edge Cases

- 翻譯檔缺少某個 key 時，系統顯示 key 名稱作為 fallback，不崩潰
- 語言模組未提供完整型別清單時，universal 積木的型別 dropdown 顯示空清單或預設清單，並在 console 警告
- 切換風格後使用者修改了程式碼再切換回來，以最新的語義模型為準重新生成
- 同時切換語言和風格時，系統逐一套用，先語言再風格
- 積木 workspace 中已有 C++ 專屬積木（如指標），切換到 Python 時使用降級策略保留在 workspace 中
- 重構後不需要向後相容舊版 workspace，可以清除 localStorage 重新開始

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 積木定義檔中不得包含任何自然語言文字字串（message、tooltip），必須使用 i18n key 引用機制
- **FR-002**: 系統必須在啟動時根據設定的 locale 載入對應翻譯檔，並將翻譯注入積木渲染引擎
- **FR-003**: 翻譯檔缺少某個 key 時，系統必須顯示 key 名稱作為 fallback 文字，不得崩潰
- **FR-004**: 系統必須定義語言模組介面，包含型別清單、支援的概念、專屬積木、tooltip 覆蓋等屬性
- **FR-005**: 型別 dropdown 的選項必須由當前語言模組在執行時注入，不得寫死在 universal 積木定義中。語言模組提供型別值和 label key（如 `{value: "int", labelKey: "TYPE_INT"}`），Locale 翻譯檔提供 label 文字（如 `"TYPE_INT": "int（整數）"`），兩者在執行時組合為 dropdown 選項
- **FR-006**: 語言模組必須能覆蓋 universal 積木的 tooltip 文字
- **FR-007**: 語言模組必須能指定哪些 universal 積木不適用，工具箱應據此隱藏不適用的積木
- **FR-008**: 系統必須定義編碼風格介面，包含 I/O 偏好、命名慣例、大括號風格、縮排設定等屬性
- **FR-009**: 系統必須提供至少 3 個預設風格 preset
- **FR-010**: 程式碼生成器必須接受風格參數，根據風格生成不同格式的程式碼
- **FR-011**: 程式碼解析器必須能從程式碼中偵測編碼風格，回傳偵測結果
- **FR-012**: I/O 操作在積木層統一為 universal 積木（u_print/u_input），由 generator 根據風格產出不同語法（cout/printf），積木層不區分 I/O 風格
- **FR-013**: 系統必須建立獨立的 SemanticNode 樹作為程式的中間表示，Blockly workspace 和程式碼都從語義模型衍生，所有雙向轉換必須經由語義模型
- **FR-014**: 語義模型中必須區分語義資訊和呈現資訊，呈現資訊存在 metadata 中
- **FR-015**: 系統必須支援優雅降級策略：當概念在目標投影中不存在時，依精確對應→近似對應→原始碼退回→不支援標記的順序處理
- **FR-016**: Round-trip 轉換必須無損：parse(generate(S)) 的結果在語義上必須等價於原始模型 S
- **FR-017**: 所有重構完成後，現有測試必須全數通過

### Key Entities

- **Locale（翻譯檔）**: 包含所有積木的 message、tooltip、dropdown label 的翻譯對照，按 UI 語言分組
- **LanguageModule（語言模組）**: 代表一個程式語言的完整定義，包含型別系統、支援的概念清單、專屬積木、程式碼生成器、程式碼解析器、tooltip 覆蓋
- **CodingStyle（編碼風格）**: 代表一組編碼格式偏好，包含 I/O 方式、命名慣例、縮排、大括號位置等屬性，以及對工具箱可見性的影響
- **SemanticModel（語義模型）**: 程式的中間表示，是唯一的真實來源，包含語義節點樹和呈現 metadata
- **SemanticNode（語義節點）**: 語義模型中的單一節點，代表一個程式概念，包含概念 ID、屬性、子節點

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 積木定義檔中自然語言文字數量為 0，所有 message/tooltip 皆透過 i18n key 載入
- **SC-002**: 新增一個 locale 翻譯只需建立一個翻譯檔案，不修改任何積木定義或程式邏輯
- **SC-003**: 新增一個程式語言模組只需實作語言模組介面，不修改 universal 積木定義或核心轉換邏輯
- **SC-004**: 切換編碼風格後，程式碼在 1 秒內更新，積木不發生任何變化
- **SC-005**: 從程式碼自動偵測編碼風格的準確率在常見風格上達到 90% 以上
- **SC-006**: Round-trip 轉換在語義上 100% 無損
- **SC-007**: 重構完成後所有現有測試全數通過
- **SC-008**: 優雅降級在遇到不支援的概念時 100% 不崩潰，並保留完整語義資訊

## Clarifications

### Session 2026-03-04

- Q: Style 切換 I/O 時，已有的積木如何處理？ → A: 同一個 u_print 積木，generator 根據風格產出 cout 或 printf（積木層無 I/O 區分）
- Q: 型別 label（如「int（整數）」）歸屬哪一層？ → A: Language Module 提供 `{value, labelKey}`，Locale 提供 label 文字，執行時組合
- Q: 語義模型在本階段的具體程度？ → A: 建立真正獨立的 SemanticNode 樹作為中間表示，Blockly workspace 和 code 都從這棵樹衍生（完整實作）

## Assumptions

- 目前只需要完整支援 C++ 一個程式語言，其他語言只需要用 stub 驗證介面設計
- zh-TW 是預設且目前唯一需要完整翻譯的 locale，英文翻譯可以用 key fallback 暫代
- 不需要向後相容舊版 workspace，重構後可清除 localStorage 重新開始
- 風格切換不改變變數命名（變數名是語義資訊），只改變程式碼格式
- 語義模型將建立為獨立的 SemanticNode 樹，Blockly workspace 和程式碼都是從語義模型衍生的視圖

## Scope Boundaries

### In Scope

- Locale 分離與翻譯檔機制
- Language Module 介面定義與 C++ 模組遷移
- Coding Style 介面、3 個 preset、自動偵測
- 語義模型完整實作（獨立 SemanticNode 樹）
- 優雅降級策略
- Python stub 語言模組（驗證用）

### Out of Scope

- 完整的 Python/Java 語言支援（generator + parser）
- UI 語言切換介面（目前只需要程式化切換）
- 風格自訂介面（使用者自定義風格 preset）
- 跨語言程式轉換（C++ → Python）
- 跨語言語義轉換（如 C++ SemanticNode 自動轉為 Python SemanticNode）
