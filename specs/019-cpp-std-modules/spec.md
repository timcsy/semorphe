# Feature Specification: C++ Std Modules Reorganization

**Feature Branch**: `019-cpp-std-modules`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "重構 C++ 語言套件的標準函式庫組織：按 header 重新組織到 languages/cpp/std/ 目錄下"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 無功能退化的目錄重構 (Priority: P1)

作為開發者，我希望重構後的系統在功能上與重構前完全一致——所有現有的積木、概念定義、lifters、generators 都正常運作，瀏覽器版和 VSCode 版都不受影響。

**Why this priority**: 這是重構的基礎保證。如果重構破壞了現有功能，其他所有改進都沒有意義。

**Independent Test**: 執行完整測試套件（`npm test`），所有現有測試通過。在瀏覽器和 VSCode 中手動操作所有積木類型，確認行為不變。

**Acceptance Scenarios**:

1. **Given** 重構前的所有測試通過，**When** 完成目錄重組後執行 `npm test`，**Then** 所有測試仍然通過
2. **Given** 重構前瀏覽器版可正常使用所有積木，**When** 重構完成後開啟瀏覽器版，**Then** 所有積木類型、toolbox 分類、程式碼生成結果都與重構前一致
3. **Given** 重構前 VSCode 版可正常使用，**When** 重構完成後開啟 VSCode 版，**Then** 所有功能（toolbar、同步、level 切換、style 切換）正常運作

---

### User Story 2 - 按 header 組織的 std 目錄結構 (Priority: P1)

作為開發者，我希望標準函式庫相關的積木定義按照 C++ header 名稱組織在 `languages/cpp/std/` 目錄下，每個 header 一個子目錄（如 `std/iostream/`、`std/cstdio/`、`std/vector/`），每個子目錄包含該 header 的 concepts.json、blocks.json、lifters.ts、generators.ts。

**Why this priority**: 這是整個重構的核心目標。目前散落在 basic.json、special.json、stdlib-containers.json、stdlib-algorithms.json 中的定義難以查找和維護，按 header 組織後一目了然。

**Independent Test**: 檢查目錄結構是否符合規範：每個 std 子目錄包含預期的四個檔案，且所有 import 路徑正確無錯誤。

**Acceptance Scenarios**:

1. **Given** 系統已完成重構，**When** 查看 `languages/cpp/std/` 目錄，**Then** 可以看到按 header 命名的子目錄（iostream、cstdio、vector、algorithm、string、cmath 等）
2. **Given** 某個 header 子目錄（如 `std/iostream/`），**When** 查看其內容，**Then** 包含 concepts.json、blocks.json、lifters.ts、generators.ts 四個檔案
3. **Given** `languages/cpp/core/` 目錄，**When** 查看其內容，**Then** 只包含不需要 `#include` 的語言核心概念（if、for、while、var_declare、func_def 等）

---

### User Story 3 - iostream/cstdio 平行模組切換 (Priority: P2)

作為使用者，我希望 iostream 和 cstdio 是平行的 std 模組，style 切換時能乾淨地在兩者之間切換，且借音偵測基於「偵測到用了另一個 std 模組的概念」。

**Why this priority**: 這是重構帶來的架構改進。目前的 IO 切換邏輯散落在多處，重構後 iostream 和 cstdio 作為獨立模組，切換邏輯更清晰。

**Independent Test**: 在 APCS style（iostream 為主）下使用 printf 積木，系統偵測到借音；切換到 competitive style（cstdio 為主）時，cout 積木被偵測為借音。

**Acceptance Scenarios**:

1. **Given** 使用 APCS style（偏好 iostream），**When** 使用者拖入 printf 積木，**Then** 系統偵測到這是 cstdio 模組的概念，觸發借音偵測
2. **Given** 使用 competitive style（偏好 cstdio），**When** 使用者拖入 cout 積木，**Then** 系統偵測到這是 iostream 模組的概念，觸發借音偵測
3. **Given** 切換 style preset，**When** toolbox 更新，**Then** 對應 style 的 IO 積木排在優先位置

---

### User Story 4 - Auto-include 機制 (Priority: P3)

作為使用者，我希望積木所屬的 std 模組能自動決定需要的 `#include`，不需手動管理 include 積木。Auto-include 與手動 `c_include` 積木合併去重——重複的 header 只出現一次。

**Why this priority**: 這是重構帶來的進階改進。積木已經知道自己屬於哪個 std 模組，自動加入對應的 `#include` 是自然的延伸。

**Independent Test**: 拖入 vector 相關積木後生成程式碼，自動包含 `#include <vector>`。

**Acceptance Scenarios**:

1. **Given** 工作區有使用 vector 的積木，**When** 生成程式碼，**Then** 自動在頂部加入 `#include <vector>`
2. **Given** 工作區同時有 iostream 和 algorithm 的積木，**When** 生成程式碼，**Then** 自動加入 `#include <iostream>` 和 `#include <algorithm>`
3. **Given** 工作區移除了所有 vector 積木，**When** 重新生成程式碼，**Then** `#include <vector>` 不再出現
4. **Given** 工作區有 vector 積木且使用者也手動放了 `c_include <vector>` 積木，**When** 生成程式碼，**Then** `#include <vector>` 只出現一次（合併去重）

---

### Edge Cases

- 某個積木屬於多個可能的 header 時（罕見但理論上可能），以 concepts.json 中的歸屬為準
- core 和 std 的邊界判定：`using namespace std` 屬於 core（語言語法）而非特定 header
- 空的 std 模組：如果某個 header 目前沒有對應的積木，不建立空目錄
- 瀏覽器版和 VSCode 版的 import 路徑差異：兩者共用同一套 std 模組定義，只是入口點不同

## Clarifications

### Session 2026-03-10

- Q: Auto-include 與手動 c_include 積木如何共存？ → A: 合併去重，同一 header 只出現一次

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 將標準函式庫相關定義組織在 `languages/cpp/std/{header}/` 目錄結構下
- **FR-002**: 每個 std 模組 MUST 包含四個檔案：concepts.json、blocks.json、lifters.ts、generators.ts
- **FR-003**: `languages/cpp/core/` MUST 只保留不需要 `#include` 的語言核心概念
- **FR-004**: 語言模組 MUST 統一載入所有 std 模組，不需要外部套件機制（manifest.json、依賴解析等）
- **FR-005**: iostream 和 cstdio MUST 作為平行的 std 模組存在，各自包含完整的概念和積木定義
- **FR-006**: 借音偵測 MUST 基於「偵測到使用了非當前 style 偏好的 std 模組概念」
- **FR-007**: Auto-include 機制 MUST 根據工作區中使用的積木自動決定需要的 `#include` 指令，並與手動 `c_include` 積木合併去重（同一 header 只出現一次）
- **FR-008**: 瀏覽器版和 VSCode 版 MUST 都能正確載入和使用 std 模組
- **FR-009**: 重構後 MUST 所有現有測試通過，無功能退化
- **FR-010**: 每個 std 模組 MUST 聲明自己對應的 header 名稱（用於 auto-include 和借音偵測）

### Key Entities

- **Std Module**: 對應一個 C++ 標準函式庫 header 的完整模組，包含概念定義、積木投影、lifter 規則、generator 規則。屬性：header 名稱、所含概念列表、所含積木列表。
- **Core Module**: 不需要 `#include` 的語言核心概念集合（控制流、變數宣告、函式定義等）。與 Std Module 互斥——一個概念要麼屬於 core，要麼屬於某個 std module。
- **Module Registry**: 負責統一載入和管理所有 std module 和 core module 的注冊中心。提供按 header 查詢、按概念反查所屬模組等能力。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新增一個 std 模組（如 `std/cstring/`）只需在一個目錄下新增四個檔案並在載入入口新增一行 import，無需修改其他模組
- **SC-002**: 所有現有測試（目前 1507+ 個）在重構後全部通過
- **SC-003**: 瀏覽器版和 VSCode 版的功能表現與重構前完全一致
- **SC-004**: iostream 和 cstdio 的切換邏輯只涉及模組層級的配置，不需要散落在多處的特殊處理
- **SC-005**: 開發者能在 5 分鐘內理解某個標準函式庫功能的完整定義在哪裡（只需看對應的 std 子目錄）
