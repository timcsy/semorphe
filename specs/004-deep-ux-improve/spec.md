# Feature Specification: 積木系統 UX 深度改善（第二波）

**Feature Branch**: `004-deep-ux-improve`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "積木系統 UX 深度改善 — 預設模板、工具箱分級、變數 dropdown、連接型別檢查、快捷列、即時錯誤提示"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 預設程式骨架（消除空白畫布恐懼） (Priority: P1)

學生開啟工具時，workspace 已經預先放好 C++ iostream 程式的基本骨架（`#include <iostream>`, `using namespace std;`, `int main() { return 0; }`），學生只需在 main 函式的 body 裡面填入邏輯，不用每次從零開始拖基礎積木。進階使用者可以一鍵清空模板。

**Why this priority**: 每次開啟都要重複拖 3 個儀式性積木是最大的時間浪費，且空白畫布會讓初學者不知從何下手。這是投入最少、改善最大的功能。

**Independent Test**: 開啟全新 workspace，驗證骨架積木已存在且產出的程式碼包含完整的 main 函式結構。

**Acceptance Scenarios**:

1. **Given** 使用者首次開啟工具（無 localStorage 資料），**When** workspace 載入完成，**Then** workspace 中已包含 `c_include`（iostream）、`c_using_namespace`（std）、`u_func_def`（main, int）+ `u_return`（0）的骨架積木
2. **Given** workspace 已有模板骨架，**When** 使用者點擊「清空」按鈕，**Then** workspace 清空為空白狀態
3. **Given** 使用者已有 localStorage 儲存的 workspace，**When** 再次開啟工具，**Then** 載入使用者儲存的狀態而非預設模板

---

### User Story 2 - 工具箱分級顯示（減少選擇癱瘓） (Priority: P1)

工具箱支援「初級」和「進階」兩種模式。初級模式只顯示約 15 個最常用的積木（涵蓋基礎程式設計概念），進階模式顯示全部積木。預設為初級模式。初級模式下，同功能的 C/C++ 積木（如 printf/scanf）被隱藏，只保留通用積木（u_print/u_input）。

**Why this priority**: 67 個積木對初學者造成嚴重的選擇癱瘓。將可見積木降至 ~15 個可以大幅降低認知負荷，同時保留進階能力。

**Independent Test**: 切換到初級模式，驗證只顯示指定的 ~15 個常用積木；切換到進階模式，驗證所有 67 個積木都可見。

**Acceptance Scenarios**:

1. **Given** 工具箱處於初級模式（預設），**When** 使用者查看工具箱，**Then** 只顯示約 15 個常用積木，分類數量 ≤ 6 個
2. **Given** 工具箱處於初級模式，**When** 使用者點擊「進階模式」切換按鈕，**Then** 工具箱顯示全部 67 個積木及所有分類
3. **Given** 工具箱處於進階模式，**When** 使用者切換回初級模式，**Then** 工具箱恢復為 ~15 個常用積木
4. **Given** 工具箱處於初級模式，**When** 使用者尋找 printf 積木，**Then** printf 不可見，但「輸出」(u_print) 可見
5. **Given** 使用者切換模式後關閉工具，**When** 再次開啟，**Then** 保持上次選擇的模式

---

### User Story 3 - 變數引用自動完成（消除拼字錯誤） (Priority: P2)

當使用者需要引用一個變數時，u_var_ref 積木改為 dropdown 選單，自動列出當前 workspace 中已宣告的所有變數（從 u_var_declare 的 NAME 欄位和 u_count_loop 的 VAR 欄位收集）。宣告新變數後 dropdown 選項自動更新。使用者仍可手動輸入自訂名稱以處理邊界情況。

**Why this priority**: 自由文字輸入是積木系統中最大的矛盾——積木的價值在於消除語法錯誤，但手動輸入變數名稱又引入拼字錯誤。Dropdown 從根本上解決此問題。

**Independent Test**: 宣告變數 `x` 後，拖出 u_var_ref，驗證 dropdown 選單中包含 `x`；刪除變數宣告後，驗證 dropdown 選單不再包含 `x`。

**Acceptance Scenarios**:

1. **Given** workspace 中有 `u_var_declare`（NAME='score'），**When** 使用者拖出 u_var_ref 積木，**Then** dropdown 選項包含 'score'
2. **Given** workspace 中有 `u_count_loop`（VAR='i'），**When** 使用者查看 u_var_ref dropdown，**Then** 選項包含 'i'
3. **Given** 使用者新增一個 u_var_declare（NAME='total'），**When** 查看已存在的 u_var_ref dropdown，**Then** 選項即時更新包含 'total'
4. **Given** u_var_ref dropdown 顯示 ['score', 'i']，**When** 使用者需要引用未宣告的變數，**Then** 可透過手動輸入方式輸入自訂名稱

---

### User Story 4 - 連接型別檢查（防止積木錯放） (Priority: P2)

積木的連接點具備型別檢查：Statement 積木（如 if、while、print）只能放在 Statement 位置，Expression 積木（如數字、變數、運算）只能放在 Expression 插槽中。不相容的積木無法拖入錯誤位置。

**Why this priority**: 防止初學者把積木放到錯誤位置（例如把 if 塞進運算的洞裡），減少「程式看起來對但無法執行」的挫折。

**Independent Test**: 嘗試將 u_if 積木拖入 u_arithmetic 的 A 插槽，驗證被拒絕；將 u_number 拖入 u_if 的 BODY 位置，驗證被拒絕。

**Acceptance Scenarios**:

1. **Given** workspace 中有 u_arithmetic 積木，**When** 使用者嘗試將 u_if 積木拖入 A 插槽，**Then** 連接被拒絕（積木彈回）
2. **Given** workspace 中有 u_if 積木的 BODY 位置，**When** 使用者嘗試將 u_number 拖入，**Then** 連接被拒絕
3. **Given** workspace 中有 u_arithmetic 積木的 A 插槽，**When** 使用者將 u_number 拖入，**Then** 連接成功
4. **Given** workspace 中有 u_if 積木的 BODY 位置，**When** 使用者將 u_print 拖入，**Then** 連接成功

---

### User Story 5 - 常用積木快捷列（加速操作） (Priority: P3)

workspace 上方顯示一排 5-8 個最常用積木的圖示按鈕（變數宣告、輸入、輸出、如果、迴圈等）。點擊圖示可直接在 workspace 中央產生對應積木，免去在工具箱分類中翻找。

**Why this priority**: 進一步縮短「我想要某個積木→積木出現在畫布上」的路徑，尤其對已知道自己要什麼的學生。

**Independent Test**: 點擊快捷列上的「輸出」圖示，驗證 u_print 積木出現在 workspace 中央可見區域。

**Acceptance Scenarios**:

1. **Given** workspace 已載入，**When** 使用者查看 workspace 上方區域，**Then** 顯示 5-8 個常用積木的圖示按鈕
2. **Given** 快捷列可見，**When** 使用者點擊「輸出」圖示，**Then** u_print 積木出現在 workspace 目前可見區域的中央
3. **Given** 快捷列可見，**When** 使用者連續點擊同一圖示兩次，**Then** 產生兩個積木且不互相重疊

---

### User Story 6 - 即時錯誤提示（引導修正） (Priority: P3)

workspace 在使用者操作時即時檢查常見錯誤：非 void 函式缺少 return 語句、使用未宣告的變數。偵測到問題時，相關積木以視覺提示（如警告圖示或邊框高亮）標示，hover 顯示具體錯誤訊息。

**Why this priority**: 幫助學生在「拼積木」階段就發現邏輯問題，而非等到轉換成程式碼後才困惑。

**Independent Test**: 建立一個 return type 為 int 的 u_func_def，body 中不放 u_return，驗證出現警告提示。

**Acceptance Scenarios**:

1. **Given** workspace 有 u_func_def（RETURN_TYPE='int'）且 body 無 u_return，**When** workspace 更新，**Then** 該函式積木顯示警告標示
2. **Given** 函式積木顯示警告，**When** 使用者加入 u_return，**Then** 警告消失
3. **Given** workspace 有 u_var_ref（NAME='y'）但無對應的 u_var_declare，**When** workspace 更新，**Then** 該 var_ref 積木顯示警告標示
4. **Given** 積木顯示警告標示，**When** 使用者 hover 該積木，**Then** 顯示具體錯誤訊息（如「函式需要 return 語句」或「變數 'y' 未宣告」）

---

### Edge Cases

- 模板骨架的積木被使用者部分刪除後（如只刪 `#include` 但保留 main），清空功能移除所有積木回到空白狀態，不是恢復模板
- 工具箱模式切換時，workspace 中已存在的進階積木不被刪除，只影響工具箱顯示
- 變數 dropdown 在 workspace 有大量變數宣告（>20 個）時仍按宣告順序列出所有選項
- 連接型別檢查不影響現有已存檔的 workspace 載入（載入時不做型別檢查，只在使用者拖動時檢查）
- 即時錯誤檢查使用 debounce（300ms）避免大型 workspace 上的效能問題
- u_func_def 的 RETURN_TYPE 為 'void' 時不檢查缺少 return（void 函式不需 return）
- 快捷列產生的積木自動位移避免重疊（每次偏移 30px）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在首次開啟（無儲存狀態）時載入預設 C++ iostream 程式骨架模板
- **FR-002**: 系統 MUST 提供「清空」按鈕，一鍵移除所有 workspace 積木
- **FR-003**: 系統 MUST 在有 localStorage 儲存狀態時優先載入儲存狀態而非模板
- **FR-004**: 工具箱 MUST 支援「初級」和「進階」兩種顯示模式
- **FR-005**: 初級模式 MUST 只顯示約 15 個涵蓋基礎程式概念的積木（變數、I/O、條件、迴圈、函式、資料型別、運算）
- **FR-006**: 初級模式 MUST 隱藏與通用積木功能重複的 C/C++ 積木（如 c_printf、c_scanf）
- **FR-007**: 模式偏好 MUST 持久化儲存，下次開啟時保持
- **FR-008**: u_var_ref 積木 MUST 提供 dropdown 選單，列出 workspace 中已宣告的變數名稱
- **FR-009**: 變數 dropdown MUST 在 workspace 變更時即時更新（新增/刪除變數宣告）
- **FR-010**: 變數 dropdown MUST 保留手動輸入自訂名稱的能力
- **FR-011**: Statement 類積木 MUST 不能放入 Expression 類插槽
- **FR-012**: Expression 類積木 MUST 不能放入 Statement 類位置
- **FR-013**: 系統 MUST 在 workspace 上方顯示 5-8 個常用積木的快捷列
- **FR-014**: 點擊快捷列圖示 MUST 在 workspace 可見區域中央產生對應積木
- **FR-015**: 系統 MUST 即時檢測非 void 函式缺少 return 語句的錯誤
- **FR-016**: 系統 MUST 即時檢測使用未宣告變數的錯誤
- **FR-017**: 偵測到錯誤時 MUST 在積木上顯示視覺警告標示
- **FR-018**: 使用者 hover 警告標示時 MUST 顯示具體錯誤訊息

### Key Entities

- **ToolboxLevel**: 工具箱顯示層級（初級/進階），決定哪些積木可見
- **BlockTemplate**: 預設骨架模板，定義首次載入時的 workspace 初始狀態
- **VariableScope**: workspace 中已宣告的變數集合，供 dropdown 引用
- **ConnectionType**: 積木連接點的型別標籤（Statement / Expression），用於型別檢查
- **QuickAccessItem**: 快捷列項目，包含積木類型和顯示圖示
- **WorkspaceDiagnostic**: 即時錯誤檢查結果，包含錯誤類型、相關積木 ID、錯誤訊息

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 首次開啟時使用者無需手動拖放即可看到可運行的程式骨架（0 個操作即可產出合法 C++ 程式）
- **SC-002**: 初級模式下工具箱可見積木數量 ≤ 18 個，分類 ≤ 6 個
- **SC-003**: 使用者引用變數時無需手動輸入名稱（可從 dropdown 選擇），拼字錯誤率降為 0
- **SC-004**: 不相容型別的積木連接被 100% 阻止（Statement 不能進 Expression 槽，反之亦然）
- **SC-005**: 從想要一個常用積木到積木出現在畫布上，最多需要 1 次點擊（透過快捷列）
- **SC-006**: 函式缺少 return、變數未宣告等常見錯誤在操作後 500ms 內被標示
- **SC-007**: 所有新功能的自動化測試通過率 100%

## Assumptions

- 目標語言仍為 C/C++ with iostream，模板骨架使用 iostream 風格
- 初級模式的積木清單為固定設定，不需要使用者自訂（但快捷列可自訂）
- 變數 dropdown 只收集當前 workspace 的直接子層變數宣告，不做巢狀 scope 分析
- 連接型別檢查使用 Blockly 內建的 setCheck() 機制，不需自行實作拖動物理引擎
- 即時錯誤提示僅為視覺警告，不阻止使用者操作（非強制修正）
- 快捷列預設顯示的積木清單與初級模式的核心積木一致
