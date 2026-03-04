# Feature Specification: 程式碼與 Blockly 積木雙向轉換工具

**Feature Branch**: `001-code-blockly-converter`
**Created**: 2026-03-02
**Status**: Draft
**Input**: 模組化的程式碼與 Blockly 積木雙向轉換工具（Web 應用），支援積木定義規範、C/C++ 語言模組、雙向即時同步。

## Clarifications

### Session 2026-03-02

- Q: MVP 的 C/C++ 積木應涵蓋到什麼語法範圍？ → A: 完整涵蓋——C 基礎（變數、運算、條件、迴圈、陣列、函式、scanf/printf）+ 指標、結構體、字串處理 + C++ I/O（cin/cout）、STL 容器（vector、map、string）、sort + 類別（class）、模板（template）、進階 STL（stack、queue、set）
- Q: 使用者工作的持久化方式？ → A: 瀏覽器本地儲存（localStorage）自動儲存/恢復 + 手動匯出/匯入檔案
- Q: 積木定義檔的載入方式？ → A: 內建預設積木 + 使用者可在執行時上傳自訂積木定義檔
- Q: Code → Block 對不完全匹配的解析策略？ → A: 盡量深入解析，外層結構轉為積木，僅不認識的最小片段用原始碼積木
- Q: 程式碼編輯器功能層級？ → A: 語法高亮的程式碼編輯器（嵌入式編輯器元件）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 定義積木規範並註冊積木 (Priority: P1)

使用者（積木開發者）撰寫一份積木定義檔，描述積木的外觀、對應的程式碼模板、以及在程式碼 AST 中的匹配模式。系統讀取定義檔後，自動在 Blockly 工具箱中顯示該積木，並支援該積木的雙向轉換。系統內建一組預設的 C/C++ 積木，使用者也可在執行時上傳自訂積木定義檔來擴充。

**Why this priority**: 積木定義規範是整個系統的基礎，所有轉換功能都依賴它。沒有規範就沒有積木，沒有積木就沒有轉換。

**Independent Test**: 可以透過載入一份積木定義檔，驗證積木是否正確出現在工具箱中，且定義檔的格式驗證是否正常運作。

**Acceptance Scenarios**:

1. **Given** 一份符合規範的積木定義檔，**When** 系統載入該定義檔，**Then** 對應的積木出現在 Blockly 工具箱中，且積木外觀與定義一致
2. **Given** 一份格式錯誤的積木定義檔，**When** 系統嘗試載入，**Then** 系統顯示明確的錯誤訊息，指出哪個欄位有問題
3. **Given** 多份積木定義檔，**When** 系統同時載入，**Then** 所有積木都正確註冊且不互相衝突
4. **Given** 使用者上傳一份自訂積木定義檔，**When** 上傳完成，**Then** 自訂積木與內建積木一同顯示在工具箱中

---

### User Story 2 - Blockly 積木轉換為 C/C++ 程式碼 (Priority: P2)

使用者在 Blockly 編輯器中拖拉積木組合程式邏輯，系統即時將積木組合轉換為對應的 C/C++ 程式碼並顯示在具有語法高亮的程式碼編輯器中。

**Why this priority**: 這是最直覺的使用方向——視覺化程式設計產出可編譯的程式碼，也是 Blockly 原生就擅長的方向。

**Independent Test**: 可以在 Blockly 編輯器中組合積木（如一個 for 迴圈包含 printf），驗證產出的 C 程式碼語法正確且可編譯。

**Acceptance Scenarios**:

1. **Given** 使用者在 Blockly 中組合了一組積木，**When** 積木組合完成，**Then** 程式碼面板即時顯示對應的 C/C++ 程式碼，且具有語法高亮
2. **Given** 使用者修改了積木組合（新增、刪除、移動積木），**When** 修改完成，**Then** 程式碼面板即時更新
3. **Given** 產出的 C/C++ 程式碼，**When** 使用者複製該程式碼到編譯器，**Then** 程式碼語法正確且可編譯

---

### User Story 3 - C/C++ 程式碼轉換為 Blockly 積木 (Priority: P3)

使用者在程式碼面板中輸入或貼上 C/C++ 程式碼，系統解析程式碼並在 Blockly 編輯器中呈現對應的積木組合。系統盡量深入解析，外層可辨識的結構轉為積木，僅不認識的最小片段降級為原始碼積木。

**Why this priority**: 這是較困難的方向（Code → Blockly），但對於學習者來說非常有價值——可以看到既有程式碼的視覺化結構。

**Independent Test**: 可以在程式碼面板輸入一段簡單的 C 程式碼（如含有 if-else 和 for 迴圈），驗證 Blockly 編輯器中是否正確產生對應的積木組合。

**Acceptance Scenarios**:

1. **Given** 使用者在程式碼面板輸入合法的 C/C++ 程式碼，**When** 輸入完成，**Then** Blockly 編輯器顯示對應的積木組合
2. **Given** 程式碼中包含系統不認識的語法結構，**When** 系統解析時遇到無法映射的部分，**Then** 系統以特殊的「原始碼」積木呈現該最小不認識片段，外層可辨識的結構仍以正常積木呈現
3. **Given** 使用者修改程式碼面板中的程式碼，**When** 修改完成，**Then** Blockly 編輯器即時更新積木組合

---

### User Story 4 - Web UI 雙向同步編輯 (Priority: P4)

使用者開啟 Web 應用，看到左右分割的畫面：一邊是 Blockly 積木編輯器，一邊是具有語法高亮的程式碼編輯器。任一邊的修改都會即時反映到另一邊。工作內容自動儲存於瀏覽器本地儲存，使用者也可手動匯出/匯入檔案。

**Why this priority**: UI 整合是最終的使用者體驗，但依賴前三個 Story 的轉換功能。

**Independent Test**: 可以在 Web 介面中操作，驗證雙向即時同步是否正常：在積木面板修改後程式碼面板更新，反之亦然。

**Acceptance Scenarios**:

1. **Given** 使用者開啟 Web 應用，**When** 頁面載入完成，**Then** 顯示左右分割畫面，左邊為 Blockly 編輯器，右邊為語法高亮的程式碼編輯器
2. **Given** 使用者在 Blockly 端拖拉積木，**When** 積木變更，**Then** 程式碼端即時更新
3. **Given** 使用者在程式碼端修改程式碼，**When** 修改完成（停止輸入後短暫延遲），**Then** Blockly 端即時更新積木組合
4. **Given** 使用者關閉瀏覽器後重新開啟，**When** 頁面載入完成，**Then** 自動恢復上次的工作內容
5. **Given** 使用者點擊匯出按鈕，**When** 匯出完成，**Then** 下載一份包含積木組合與程式碼的檔案
6. **Given** 使用者上傳一份先前匯出的檔案，**When** 匯入完成，**Then** 編輯器恢復該檔案的工作內容

---

### Edge Cases

- 當程式碼包含巨集（macro）或預處理指令（#include、#define）時，系統以特殊的「預處理指令」積木呈現
- 當使用者同時在兩側編輯時，以最後編輯的一側為準，另一側的更新有短暫的防抖延遲，避免無限迴圈
- 當程式碼語法不完整（使用者正在輸入中）時，等待使用者停止輸入一段時間後才觸發解析
- 當積木定義檔被更新時，已在編輯器中的積木組合自動刷新，若積木類型被移除則以「未知積木」標記
- 當 localStorage 空間不足或不可用時，系統提示使用者手動匯出備份
- 當使用者上傳的自訂積木定義與內建積木 ID 衝突時，系統拒絕載入並提示衝突的積木名稱

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供一套積木定義規範（Block Spec），包含積木外觀、程式碼模板、AST 匹配模式三個部分
- **FR-002**: 系統 MUST 提供積木註冊機制（Block Registry），能載入並管理多份積木定義檔
- **FR-003**: 系統 MUST 驗證積木定義檔的格式正確性，並在錯誤時提供明確的錯誤訊息
- **FR-004**: 系統 MUST 支援將 Blockly 積木組合轉換為 C/C++ 程式碼（Block → Code）
- **FR-005**: 系統 MUST 支援將 C/C++ 程式碼解析並轉換為 Blockly 積木組合（Code → Block）
- **FR-006**: 系統 MUST 提供 Web 介面，包含 Blockly 編輯器與具有語法高亮的程式碼編輯器的左右分割畫面
- **FR-007**: 系統 MUST 支援雙向即時同步——任一側的修改即時反映到另一側
- **FR-008**: 當程式碼包含無法映射的語法結構時，系統 MUST 盡量深入解析，外層可辨識結構轉為積木，僅不認識的最小片段以「原始碼積木」保留，不得遺失內容
- **FR-009**: 系統 MUST 提供一組預設的 C/C++ 積木，涵蓋：變數、運算、條件、迴圈、陣列、函式、scanf/printf、指標、結構體、字串處理（char[]）、cin/cout、STL 容器（vector、map、string）、sort、類別（class）、模板（template）、進階 STL（stack、queue、set）
- **FR-010**: Parser 模組、Generator 模組、積木定義檔 MUST 可獨立替換，核心引擎不得與特定語言耦合
- **FR-011**: 系統 MUST 內建預設積木，且使用者可在執行時上傳自訂積木定義檔來擴充
- **FR-012**: 系統 MUST 自動將工作內容儲存於瀏覽器本地儲存（localStorage），並在頁面載入時自動恢復
- **FR-013**: 系統 MUST 支援手動匯出工作內容為檔案，以及從檔案匯入恢復

### Key Entities

- **Block Spec（積木定義）**: 描述一個積木的完整規格，包含外觀定義、程式碼模板、AST 匹配模式。是系統的核心資料結構
- **Block Registry（積木註冊表）**: 管理所有已載入的積木定義（內建 + 自訂），提供查詢和驗證功能。與 Blockly 工具箱同步
- **Parser Module（解析器模組）**: 負責將特定語言的程式碼解析為 AST。每個支援的語言有各自的 Parser 實作
- **Generator Module（產生器模組）**: 負責將 Blockly 積木組合轉換為特定語言的程式碼。每個支援的語言有各自的 Generator 實作
- **Converter（轉換協調器）**: 協調 Parser、Generator 與 Block Registry 之間的互動，是雙向轉換的中樞

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者可以在 5 分鐘內撰寫一份積木定義檔，並在系統中看到該積木可用
- **SC-002**: 在 Blockly 端修改積木後，程式碼端在 1 秒內更新
- **SC-003**: 在程式碼端修改後，Blockly 端在 2 秒內更新積木組合
- **SC-004**: 系統產出的 C/C++ 程式碼可直接通過編譯器編譯，無語法錯誤
- **SC-005**: 對於系統預設積木涵蓋的語法結構，Code → Block → Code 的往返轉換 MUST 保持語意等價
- **SC-006**: 系統預設提供的 C/C++ 積木 MUST 涵蓋 APCS 實作題及競賽程式設計常見的語法結構（含 C 基礎、指標、結構體、C++ I/O、STL 容器、類別、模板、進階 STL）
- **SC-007**: 使用者關閉瀏覽器後重新開啟，工作內容 MUST 自動恢復且與關閉前一致
