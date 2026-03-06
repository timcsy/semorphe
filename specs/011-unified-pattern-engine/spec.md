# Feature Specification: 統一 Pattern Engine 三層表達能力架構

**Feature Branch**: `011-unified-pattern-engine`
**Created**: 2026-03-07
**Status**: Draft
**Input**: User description: "統一 Pattern Engine 三層表達能力架構：消除雙管線競爭和黑名單，新增 Transform/Strategy Registry，遷移所有 hand-written 邏輯到三層架構"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 概念定義者用純 JSON 定義簡單概念（Layer 1） (Priority: P1)

當概念定義者（開發者或未來的套件作者）要為系統新增一個簡單概念（如 `break`、`number_literal`、`arithmetic`）時，只需在 JSON 檔中定義 `astPattern` 和 `fieldMappings`，Pattern Engine 就能自動完成 AST→Semantic 提升和 Semantic→Block 渲染，無需撰寫任何程式碼。

**Why this priority**: 這是整個三層架構的基礎。80% 的概念屬於 Layer 1，確保純 JSON 路徑正確運作是最核心的價值。

**Independent Test**: 定義一個全新的簡單概念（如 `break_statement`），只用 JSON 描述，驗證它能完成完整的 code→semantic→blocks 和 blocks→semantic→code 雙向轉換。

**Acceptance Scenarios**:

1. **Given** 一個只有 JSON 定義的概念（無任何 transform 或 strategy），**When** 系統解析對應的程式碼，**Then** 能正確提升為語義節點並渲染成積木
2. **Given** 一個純 JSON 概念生成的積木，**When** 系統從積木生成程式碼，**Then** 產生的程式碼語義與原始碼一致
3. **Given** 現有所有 Layer 1 概念（break、continue、number_literal、var_ref、arithmetic、compare、logic 等），**When** 遷移後執行完整測試套件，**Then** 全部測試通過且行為不變

---

### User Story 2 - 概念定義者用 JSON + Transform 處理文字轉換（Layer 2） (Priority: P1)

當概念涉及文字格式轉換（如字串去引號、註解去前綴、include 去角括號）時，概念定義者在 JSON 的 `fieldMappings` 中加上 `"transform": "函數名"` 即可引用一個已註冊的 transform 函數，無需在核心引擎中加入特殊邏輯。

**Why this priority**: 與 P1 同等重要——目前 `preferHandWritten` 黑名單中有 4 個節點（string_literal、char_literal、comment、return_statement）僅因文字轉換或位置索引問題就需要手寫 lifter。Layer 2 直接解決這些問題。

**Independent Test**: 將 `string_literal` 的 hand-written lifter 替換為 JSON + `stripQuotes` transform，驗證 `"hello"` 能正確提升為 `{ value: "hello" }`（無引號）。

**Acceptance Scenarios**:

1. **Given** 一個 JSON 定義引用了 `"transform": "stripQuotes"` 的概念，**When** 系統提升 `"hello"` 的 AST 節點，**Then** 語義節點的 value 為 `hello`（去除引號）
2. **Given** C++ 語言模組註冊了 `stripComment` transform，**When** 系統提升 `// section header` 的 AST 節點，**Then** 語義節點的 text 為 `section header`（去除前綴並 trim）
3. **Given** JSON 引用了一個不存在的 transform 名稱，**When** 系統嘗試提升，**Then** 該 fieldMapping 退回無 transform 的行為（原始文字），不會崩潰
4. **Given** 系統需要 `$namedChildren[0]` 位置索引存取，**When** JSON 中使用 `"ast": "$namedChildren[0]"`，**Then** 能正確取得第一個具名子節點

---

### User Story 3 - 概念定義者用 JSON + Strategy 處理複雜邏輯（Layer 3） (Priority: P2)

當概念需要條件路由（如 `preproc_include` 依子節點類型分流）、深層巢狀提取（如 `function_definition` 的 `declarator.declarator`）、或動態欄位生成（如 `var_declare` 的 `NAME_0`/`INIT_0`）時，JSON 中引用 `"liftStrategy"` 或 `"renderStrategy"` 指向語言模組註冊的 strategy 函數。

**Why this priority**: 這是消除 `preferHandWritten` 和 `SWITCH_CASE_CONCEPTS` 黑名單的關鍵。目前需要 strategy 的概念約佔 5%，但它們的 bug 頻率最高。

**Independent Test**: 將 `preproc_include` 的 hand-written lifter 轉為 strategy 函數並在 JSON 中引用，驗證 `#include <iostream>` 和 `#include "myfile.h"` 都能正確分流到不同概念。

**Acceptance Scenarios**:

1. **Given** 一個 JSON 定義引用了 `"liftStrategy": "cpp:liftFunctionDef"` 的概念，**When** 系統提升 `int main() { }` 的 AST 節點，**Then** 語義節點包含正確的 name、return_type、params
2. **Given** 一個 JSON 定義引用了 `"renderStrategy": "cpp:renderVarDeclare"` 的概念，**When** 系統渲染多變數宣告的語義節點，**Then** 積木包含正確的動態欄位和 extraState
3. **Given** 所有原本在 `SWITCH_CASE_CONCEPTS` 中的概念都遷移到 renderStrategy 後，**When** 執行完整測試套件，**Then** 全部測試通過且行為不變
4. **Given** JSON 引用了一個不存在的 strategy 名稱，**When** 系統嘗試提升/渲染，**Then** 退回到 Layer 1/2 的 JSON pattern 處理，不會崩潰

---

### User Story 4 - 核心引擎只有單一管線（消除黑名單） (Priority: P2)

系統的 Lifter 和 Renderer 各只有一條執行路徑（Pattern Engine），不存在「兩條管線競爭 + 黑名單切換」的機制。`preferHandWritten` set 和 `SWITCH_CASE_CONCEPTS` set 被完全移除。

**Why this priority**: 這是架構品質的保證。雙管線導致隱式控制流、靜默失敗、知識分散，是過去多個 bug 的根本原因。

**Independent Test**: 搜尋整個程式碼庫，確認不存在 `preferHandWritten`、`SWITCH_CASE_CONCEPTS`、或任何「根據節點類型切換管線」的邏輯。

**Acceptance Scenarios**:

1. **Given** 遷移完成後的程式碼庫，**When** 搜尋 `preferHandWritten`，**Then** 找不到任何結果
2. **Given** 遷移完成後的程式碼庫，**When** 搜尋 `SWITCH_CASE_CONCEPTS`，**Then** 找不到任何結果
3. **Given** PatternLifter 處理任何 AST 節點，**When** 該節點有 liftStrategy，**Then** 直接執行 strategy；否則按 Layer 1/2 邏輯處理。不存在「先試某個引擎再試另一個」的分支
4. **Given** 遷移完成，**When** 執行全部 745+ 個既有測試，**Then** 全部通過
5. **Given** 遷移完成，**When** 在瀏覽器中執行原有的程式碼→積木轉換場景，**Then** 行為與遷移前完全一致

---

### Edge Cases

- 當一個概念同時在 lift-patterns.json 和 BlockSpec astPattern 中有定義時，應由 priority 欄位控制優先級（與現行一致）
- 當 transform 函數拋出異常時，系統降級為無 transform 的原始文字（不崩潰）
- 當 strategy 函數回傳 null 時，系統嘗試 Layer 1/2 的 pattern matching 作為 fallback（三層之間有降級鏈）
- 當語言模組忘記註冊 JSON 中引用的 transform/strategy 時，載入時發出 console.warn
- 當多個語言模組註冊同名的 transform/strategy 時，後註冊的覆蓋先註冊的（與一般 Map 行為一致），命名空間（如 `cpp:`）可避免衝突

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供 TransformRegistry，允許語言模組註冊具名的文字轉換函數
- **FR-002**: 系統 MUST 提供 LiftStrategyRegistry，允許語言模組註冊具名的 AST→Semantic 提升函數
- **FR-003**: 系統 MUST 提供 RenderStrategyRegistry，允許語言模組註冊具名的 Semantic→Block 渲染函數
- **FR-004**: PatternLifter 的 fieldMapping MUST 支援 `"transform"` 欄位，引用 TransformRegistry 中的函數
- **FR-005**: PatternLifter MUST 支援 `"liftStrategy"` 欄位，當存在時直接調用 strategy 函數而非走 pattern matching
- **FR-006**: PatternRenderer MUST 支援 `"renderStrategy"` 欄位，當存在時直接調用 strategy 函數而非走 auto-derive 映射
- **FR-007**: PatternLifter 的 AST 欄位解析器 MUST 支援 `$namedChildren[N]` 語法，按位置索引存取具名子節點
- **FR-008**: 所有現有 `preferHandWritten` 中的 7 個 AST 節點類型 MUST 遷移到三層架構（Layer 1/2/3 擇一）
- **FR-009**: 所有現有 `SWITCH_CASE_CONCEPTS` 中的 7 個概念 MUST 遷移到三層架構
- **FR-010**: 遷移完成後，`preferHandWritten` 機制和 `SWITCH_CASE_CONCEPTS` 機制 MUST 被完全移除
- **FR-011**: 當 JSON 引用的 transform 或 strategy 名稱不存在時，系統 MUST 優雅降級（不崩潰），並在載入時發出警告
- **FR-012**: 三個 Registry MUST 支援命名空間（如 `cpp:stripComment`、`python:stripFString`），避免跨語言模組的名稱衝突
- **FR-013**: 遷移後全部既有測試（745+）MUST 通過，瀏覽器中雙向轉換行為 MUST 與遷移前一致

### Key Entities

- **TransformRegistry**: 管理具名文字轉換函數（`string → string`）的全域登錄表
- **LiftStrategyRegistry**: 管理具名 AST→Semantic 提升函數的全域登錄表
- **RenderStrategyRegistry**: 管理具名 Semantic→Block 渲染函數的全域登錄表
- **PatternEntry**: Pattern Engine 的核心資料結構，新增 `transform`、`liftStrategy`、`renderStrategy` 欄位
- **Language Module**: 語言模組（如 C++），負責向三個 Registry 註冊該語言專屬的函數

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 遷移完成後，程式碼庫中不存在 `preferHandWritten` 和 `SWITCH_CASE_CONCEPTS` 的任何引用（0 個搜尋結果）
- **SC-002**: 所有 745+ 個既有測試在遷移後 100% 通過
- **SC-003**: 讀任一概念的 JSON 定義，能在該定義中找到該概念的完整 lift/render 行為描述（純宣告、或引用的 transform/strategy 名稱），無需搜尋散落在核心引擎中的 switch-case
- **SC-004**: 新增一個 Layer 1 概念只需修改 JSON 檔案（0 行核心程式碼變更）
- **SC-005**: 新增一個 Layer 2 概念只需修改 JSON 檔案 + 在語言模組中註冊 transform（0 行核心引擎程式碼變更）
- **SC-006**: 新增一個 Layer 3 概念只需修改 JSON 檔案 + 在語言模組中註冊 strategy（0 行核心引擎程式碼變更）
- **SC-007**: 瀏覽器中原有的 10 個程式碼→積木轉換場景（include、using namespace、main 函數、變數宣告、if、cin、cout、return、算術運算、字串）行為與遷移前一致

## Assumptions

- 現有的 PatternLifter 和 PatternRenderer 核心架構保持不變，只增加 transform/strategy 查找機制
- Registry 使用簡單的 Map 實現，不需要持久化或遠端載入
- Transform 函數是同步的純函數（`string → string`），不需要 async 支援
- Strategy 函數簽名與現有 hand-written lifter/renderer 函數一致，可直接遷移
- 命名空間使用冒號分隔（如 `cpp:stripComment`），核心提供的 transform 不加前綴（如 `stripQuotes`）

## Scope Boundaries

### In Scope

- TransformRegistry、LiftStrategyRegistry、RenderStrategyRegistry 的實現
- PatternLifter 增強（transform 支援、strategy 支援、$namedChildren[N]）
- PatternRenderer 增強（renderStrategy 支援）
- 遷移全部 7 個 preferHandWritten 節點和 7 個 SWITCH_CASE_CONCEPTS 概念
- 移除 preferHandWritten 和 SWITCH_CASE_CONCEPTS 機制
- 更新所有受影響的測試

### Out of Scope

- 新增尚未存在的概念（如 do-while、switch/case 等新 AST 支援）
- 跨語言轉換功能
- PatternRenderer 的 indexedMapping 宣告式語法（動態欄位仍使用 renderStrategy）
- 效能最佳化（當前規模不需要）
