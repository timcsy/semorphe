# Feature Specification: DependencyResolver 抽象 + Program Scaffold

**Feature Branch**: `020-dependency-scaffold`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "DependencyResolver 抽象 + Program Scaffold：將 C++ 專用的 auto-include 泛化為語言無關的 DependencyResolver 介面，並建立 ProgramScaffold 層統一管理程式基礎設施 boilerplate。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 語言無關的依賴解析介面 (Priority: P1)

作為系統架構的維護者，我希望依賴解析（concept→import 語句）有一個語言無關的核心介面，讓未來新增語言時不需要修改核心引擎。目前 C++ 的 ModuleRegistry 是專用實作，核心引擎（code-generator.ts）直接知道 C++ 的 `#include` 語法。重構後，核心只定義 DependencyResolver 介面，C++ 模組提供實作，行為完全不變。

**Why this priority**: 這是其他所有 user story 的基礎——ProgramScaffold 和 Ghost Line 都消費 DependencyResolver 的輸出。且此重構必須保證現有測試全部通過。

**Independent Test**: 可透過驗證「核心介面檔案不 import 任何 languages/ 下的模組」以及「C++ auto-include 行為不變」來獨立測試。

**Acceptance Scenarios**:

1. **Given** 核心引擎定義了 DependencyResolver 介面，**When** 檢查核心介面檔案的 import 語句，**Then** 不包含任何 C++ 或其他語言專用的引用
2. **Given** C++ 語言模組實作了 DependencyResolver，**When** 使用者在積木面板拖入 vector 相關積木並同步產生程式碼，**Then** 程式碼中自動出現 `#include <vector>`，行為與重構前完全一致
3. **Given** 語義樹中使用了 cout 和 vector，**When** 系統解析依賴，**Then** 回傳兩條依賴邊（`<iostream>` 和 `<vector>`），每條都標記為 stdlib 類型

---

### User Story 2 - Program Scaffold 統一 boilerplate 管理 (Priority: P2)

作為系統架構的維護者，我希望把散落在 program generator 中的 boilerplate 硬編碼（`#include`、`using namespace std;`、`int main() { ... }`、`return 0;`）統一收進一個 ProgramScaffold 層。ProgramScaffold 從語義樹推導所有需要的基礎設施，並根據認知等級決定每個項目的可見性。

**Why this priority**: Scaffold 層是 Ghost Line 視覺呈現的前置條件，也是多語言擴充時避免重複 boilerplate 邏輯的關鍵。

**Independent Test**: 可透過驗證「ProgramScaffold 產出的 imports/preamble/entryPoint/epilogue 與現有 program generator 硬編碼的結果一致」來獨立測試。

**Acceptance Scenarios**:

1. **Given** 一棵使用 cout 和 vector 的語義樹，**When** ProgramScaffold 在 L0 模式下解析，**Then** 所有 scaffold 項目（imports、preamble、entryPoint、epilogue）標記為 hidden
2. **Given** 同一棵語義樹，**When** ProgramScaffold 在 L1 模式下解析，**Then** 所有 scaffold 項目標記為 ghost，且 imports 的每個項目包含原因說明（如「因為你用了 cout」）
3. **Given** 同一棵語義樹，**When** ProgramScaffold 在 L2 模式下解析，**Then** 所有 scaffold 項目標記為 editable
4. **Given** 使用者手動寫了 `#include <cstdio>` 在程式碼中，**When** ProgramScaffold 解析，**Then** 手動 include 不被 scaffold 覆蓋或重複

---

### User Story 3 - Scaffold 驅動的程式碼產生 (Priority: P3)

作為使用者，我希望從積木面板產生的程式碼能正確包含所有必要的 boilerplate。重構後 program generator 不再硬編碼 boilerplate，而是消費 ProgramScaffold 的結果。從使用者角度，產出的程式碼與重構前完全一致。

**Why this priority**: 這是 US1 和 US2 的整合驗證——確保重構後端到端行為不變。

**Independent Test**: 可透過已有的 roundtrip 測試和 real-world-programs 測試驗證產出的程式碼不變。

**Acceptance Scenarios**:

1. **Given** 積木面板有一個簡單的 hello world 程式（cout），**When** 同步產生程式碼，**Then** 程式碼包含 `#include <iostream>`、`using namespace std;`、`int main() {`、`return 0;` 和 `}`
2. **Given** 積木面板使用了 vector 和 algorithm，**When** 同步產生程式碼，**Then** 程式碼包含 `#include <vector>`、`#include <algorithm>`、`#include <iostream>`（如有 I/O），且順序與之前一致
3. **Given** 所有現有的 roundtrip 測試和 real-world-programs 測試，**When** 執行測試套件，**Then** 全部通過，零 regression

---

### User Story 4 - Ghost Line 視覺呈現 (Priority: P4)

作為學習者（L1 認知等級），我希望在程式碼面板中看到自動產生的 include 和 main 等 boilerplate 以淡灰色顯示，讓我知道它們存在但不需要自己管理。hover 時能看到為什麼需要這一行。

**Why this priority**: 這是 UX 層面的增強，依賴 ProgramScaffold 層完成後才能實作。

**Independent Test**: 可透過在瀏覽器中切換認知等級並觀察程式碼面板的顯示變化來獨立測試。

**Acceptance Scenarios**:

1. **Given** 認知等級設為 L1，**When** 程式碼面板顯示自動產生的 `#include <iostream>`，**Then** 該行以淡灰色（與正常程式碼有明顯視覺區別）顯示
2. **Given** 認知等級設為 L1 且有 ghost line，**When** 使用者 hover 在 ghost line 上，**Then** 顯示 tooltip 說明為什麼需要這一行
3. **Given** 認知等級設為 L0，**When** 程式碼面板顯示程式碼，**Then** 編輯器隱藏所有 boilerplate 行（include、using namespace、main 等），使用者只看到自己的邏輯，但底層程式碼字串仍包含完整可編譯的程式碼
4. **Given** 認知等級設為 L2，**When** 程式碼面板顯示程式碼，**Then** boilerplate 以正常顏色顯示，使用者可以編輯
5. **Given** 認知等級設為 L1 且有 ghost line，**When** 使用者對某個 ghost line 執行「固定」操作，**Then** 該行變為 editable，後續不受 scaffold 自動管理

---

### Edge Cases

- 語義樹為空（無任何概念）時，ProgramScaffold 應產出最小骨架（main + return 0）或空結果，取決於認知等級
- 使用者手動寫了與 auto-include 重複的 include 時，不應產生重複行
- 認知等級在程式編輯過程中切換時，ghost line 狀態應即時更新
- 語義樹中只有 raw_code 節點（無已知概念）時，DependencyResolver 回傳空依賴列表
- 使用者固定（pin）了一個 ghost line 後切回 L0，該固定的行應保持可見（因為使用者明確選擇保留）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 定義一個語言無關的 DependencyResolver 介面，接受概念 ID 列表，回傳依賴邊列表
- **FR-002**: 每條依賴邊 MUST 包含來源類型（builtin/stdlib/external）和語言專用的 import 指令字串
- **FR-003**: C++ 語言模組 MUST 提供 DependencyResolver 的實作，行為與現有 ModuleRegistry + computeAutoIncludes 完全一致
- **FR-004**: 系統 MUST 定義一個 ProgramScaffold 介面，接受語義樹和認知等級，回傳結構化的 scaffold 結果
- **FR-005**: Scaffold 結果 MUST 包含四個區段：imports、preamble、entryPoint、epilogue
- **FR-006**: 每個 scaffold 項目 MUST 根據認知等級標記為 hidden（L0）、ghost（L1）或 editable（L2+）
- **FR-007**: Ghost 類型的 scaffold 項目 MUST 包含原因說明（如「因為你用了 cout」）
- **FR-008**: Program generator MUST 消費 ProgramScaffold 的結果來產生 boilerplate，不再硬編碼
- **FR-009**: ProgramScaffold MUST 尊重使用者手動寫的 import，不產生重複
- **FR-010**: DependencyResolver 核心介面檔案 MUST 不 import 任何語言專用模組
- **FR-011**: 程式碼面板 MUST 在 L1 認知等級下以淡灰色顯示 ghost scaffold 項目
- **FR-012**: 程式碼面板 MUST 在 hover ghost line 時顯示原因 tooltip
- **FR-013**: 程式碼面板 MUST 提供「固定」操作，將 ghost line 轉為 editable
- **FR-014**: 認知等級切換時，scaffold 可見性 MUST 即時更新

### Key Entities

- **DependencyEdge**: 表示一個概念對某個模組的依賴關係，包含來源類型、import 指令、可選的套件規格
- **ScaffoldItem**: 表示一個 boilerplate 程式碼行，包含程式碼內容、可見性等級、原因說明
- **ScaffoldResult**: 表示完整的程式基礎設施，分為 imports、preamble、entryPoint、epilogue 四個區段

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 重構後所有現有測試全部通過，零 regression
- **SC-002**: DependencyResolver 核心介面不包含任何語言專用引用（靜態分析可驗證）
- **SC-003**: C++ 語言模組的依賴解析結果與重構前完全一致（所有 auto-include 測試通過）
- **SC-004**: Program generator 中的 boilerplate 硬編碼全部移除（program generator 不再包含 `#include`、`using namespace`、`int main` 等字串常量）
- **SC-005**: L0 模式下產生的程式碼字串仍包含完整 boilerplate（保證可編譯），但編輯器隱藏 boilerplate 行，使用者只看到自己的邏輯
- **SC-006**: L1 模式下 ghost line 在程式碼面板中以視覺區別顯示，且 hover 顯示原因
- **SC-007**: 新增語言的 DependencyResolver 實作不需要修改核心引擎的任何檔案

## Clarifications

### Session 2026-03-10

- Q: L0 "hidden" 的語義——boilerplate 是否仍存在於程式碼字串中？ → A: 程式碼字串包含完整 boilerplate（保證可編譯），編輯器隱藏不顯示

## Assumptions

- 本次範圍僅涵蓋 C++ 語言的 DependencyResolver 實作，其他語言留待 Phase 6
- 外部套件（非 stdlib）的安裝狀態檢查不在本次範圍
- Ghost line 的「固定」操作在本次實作為基礎版本（切換 visibility），進階互動留待後續
- 現有認知等級系統（L0/L1/L2）已存在且可用，本次只消費其值
- 瀏覽器版和 VSCode 版都需要支援 ghost line 顯示

## Scope Boundaries

### In Scope

- DependencyResolver 核心介面定義
- C++ DependencyResolver 實作（從 ModuleRegistry 重構）
- ProgramScaffold 核心介面定義
- C++ ProgramScaffold 實作
- Program generator 重構（消費 scaffold 而非硬編碼）
- 程式碼面板的 ghost line 顯示（淡灰色 + hover tooltip）
- 認知等級切換時的 scaffold 更新
- Ghost line 的「固定」操作

### Out of Scope

- 其他語言的 DependencyResolver 實作（Python、Java 等）
- 外部套件的安裝狀態檢查和一鍵安裝
- 積木面板的 scaffold 相關 UI（積木不顯示 include）
- SemanticDiff 增量更新
- 語義套件市場
