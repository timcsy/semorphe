# Feature Specification: 積木文字全面中文化與初學者友善改善

**Feature Branch**: `005-block-i18n-friendly`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "積木文字全面中文化與初學者友善改善"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Universal 積木文字友善化 (Priority: P0)

一位高中生第一次使用 Code Blockly，從工具箱拖出「建立變數」積木。他看到型別下拉選單顯示 `int（整數）` 而不是只有 `int`，立刻知道要選哪個型別。積木上顯示「把**變數** x 設成」讓他清楚知道 x 是一個變數。滑鼠移到積木上時，tooltip 用白話解釋這個積木在做什麼。

**Why this priority**: Universal 積木是所有初學者最先接觸的核心積木，佔使用時間 80% 以上。如果這些積木看不懂，學生會直接放棄。

**Independent Test**: 打開應用程式，逐一檢查所有 universal 積木的 message、tooltip、下拉選單，確認不含未解釋的專有名詞。

**Acceptance Scenarios**:

1. **Given** 使用者從工具箱拖出任何 universal 積木, **When** 檢查積木上的文字, **Then** 所有文字為中文，術語旁有括號說明（如 `int（整數）`）
2. **Given** 使用者將滑鼠移到任何 universal 積木上, **When** tooltip 顯示, **Then** tooltip 用白話說明功能和效果，不含未解釋的術語
3. **Given** 使用者打開型別下拉選單, **When** 查看選項, **Then** 每個型別旁都有中文說明（如 `double（精確小數）`、`void（無回傳）`）
4. **Given** 使用者拖出賦值積木, **When** 查看積木文字, **Then** 積木明確標示「變數」二字讓使用者知道欄位的身份
5. **Given** 使用者拖出陣列存取積木, **When** 查看積木文字, **Then** 積木明確標示「陣列」和「格」讓使用者知道這是在存取陣列

---

### User Story 2 - Basic/Special 積木中文化 (Priority: P1)

一位學生切換到進階模式，看到 switch、for 迴圈、printf 等 C/C++ 特有積木。這些積木的 message 不再顯示原始 C++ 語法，而是用中文描述（如「根據 %1 的值」）。tooltip 用白話解釋每個積木的用途。`#include` 的下拉選單顯示功能說明（如 `iostream（輸入輸出）`）。

**Why this priority**: 這些積木在進階模式中出現，學生接觸頻率次於 universal 積木。中文化後，學生不需要先背語法就能理解邏輯。

**Independent Test**: 切換到進階模式，檢查 basic.json 和 special.json 中所有積木的 message、tooltip、下拉選單文字。

**Acceptance Scenarios**:

1. **Given** 使用者在進階模式看到 switch 積木, **When** 查看積木文字, **Then** 顯示中文描述而非原始 C++ 語法
2. **Given** 使用者在進階模式看到 for 迴圈積木, **When** 查看積木文字, **Then** 顯示中文描述（初始、條件、更新）
3. **Given** 使用者拖出引入函式庫積木, **When** 打開下拉選單, **Then** 每個選項旁有功能說明
4. **Given** 使用者拖出格式輸出積木, **When** 查看 tooltip, **Then** tooltip 說明格式符號的意義
5. **Given** 使用者拖出命名空間積木, **When** 查看 tooltip, **Then** tooltip 說明效果（讓 cout、cin 等可以直接使用）

---

### User Story 3 - Advanced 積木中文化 (Priority: P1)

一位學生進入進階模式後，看到指標、結構、容器、類別等進階積木。這些積木的 message 用中文描述（如「建立 int（整數）指標變數 ptr」「建立 int（整數）列表變數 vec」），tooltip 用白話解釋概念（如「指標是一個記住其他變數位址的變數」「列表是可變長度的陣列，可以自動增長」）。

**Why this priority**: 進階積木概念較困難，更需要中文解釋輔助理解。與 US2 同為 P1，因為都是進階模式的內容。

**Independent Test**: 切換到進階模式，檢查 advanced.json 中所有積木的 message、tooltip、下拉選單文字。

**Acceptance Scenarios**:

1. **Given** 使用者看到指標宣告積木, **When** 查看積木文字, **Then** 顯示中文描述而非 C++ 指標語法
2. **Given** 使用者看到容器宣告積木（vector/map/stack/queue/set）, **When** 查看積木文字, **Then** 顯示中文名稱（列表/對照表/堆疊/佇列/集合）
3. **Given** 使用者看到容器積木, **When** 查看 tooltip, **Then** tooltip 用生活比喻解釋資料結構（堆疊像疊盤子、佇列像排隊）
4. **Given** 使用者看到類別積木, **When** 查看積木文字, **Then** 顯示中文描述（定義類別、公開、私有）

---

### User Story 4 - 動態積木同步與測試驗證 (Priority: P2)

應用程式中有部分積木是動態註冊的（u_print、u_func_def、u_var_declare、u_var_ref、u_input），這些積木的文字也需要同步更新。更新後，所有現有測試必須通過，程式碼生成功能不受影響。

**Why this priority**: 動態積木的文字改動需要同步修改程式碼和相關測試，屬於收尾整合工作。

**Independent Test**: 執行全部測試確保通過，在瀏覽器中測試程式碼與積木的雙向轉換功能正常。

**Acceptance Scenarios**:

1. **Given** 動態積木文字已更新, **When** 執行全部測試, **Then** 所有測試通過
2. **Given** 使用者拖出函式定義動態積木, **When** 查看回傳型別下拉, **Then** 顯示中文說明（如 `void（無回傳）`、`int（整數）`）
3. **Given** 使用者拖出輸入動態積木, **When** 查看積木文字, **Then** 明確標示「變數」身份
4. **Given** 使用者進行程式碼→積木→程式碼 round-trip, **When** 轉換完成, **Then** 程式碼生成結果與改動前一致

---

### Edge Cases

- 改動下拉選單顯示文字後，已儲存在 localStorage 中的舊版 workspace 能否正確載入？（下拉值未改，應不受影響）
- 積木 message 文字變長後，是否會導致積木在畫面上過寬影響排版？
- 程式碼→積木轉換是否依賴 message 文字？（應該只依賴 field value，不受影響）
- 積木→程式碼生成是否依賴下拉選單的顯示文字？（應該只依賴 value，不受影響）
- 測試中是否有硬編碼的 message 字串比對需要同步更新？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 所有 universal.json 積木的 tooltip MUST 使用白話中文說明，不含未解釋的術語
- **FR-002**: 所有積木的 message MUST 在適當位置標示身份（變數、函式、陣列、列表等）
- **FR-003**: 所有出現型別下拉選單的積木 MUST 顯示中文說明（如 `int（整數）`），下拉值不變
- **FR-004**: 所有 basic.json 積木的 message MUST 改為中文描述，tooltip MUST 用白話說明
- **FR-005**: 所有 advanced.json 積木的 message MUST 改為中文描述，tooltip MUST 用白話說明
- **FR-006**: 所有 special.json 積木的 message MUST 改為中文描述，tooltip MUST 用白話說明
- **FR-007**: `#include` 下拉選單的標頭檔名稱旁 MUST 加上功能說明
- **FR-008**: 動態積木 MUST 同步更新文字，與 JSON 積木風格一致
- **FR-009**: 所有文字改動 MUST NOT 影響程式碼生成結果（只改顯示文字，不改 field value）
- **FR-010**: 所有文字改動 MUST NOT 破壞程式碼→積木和積木→程式碼的轉換功能
- **FR-011**: 已儲存的 workspace 狀態 MUST 能正確載入（向後相容）

### Key Entities

- **Block Definition（積木定義）**: 包含 message（顯示文字）、tooltip（提示說明）、args（欄位與下拉選單）的結構，每個積木有一份定義
- **Dropdown Option（下拉選項）**: 由顯示標籤（label）和儲存值（value）組成的配對，本次只改動 label 不改 value
- **Dynamic Block（動態積木）**: 在應用程式碼中註冊的積木，需要修改原始碼中的文字

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 67 個積木中的每一個，其 message 和 tooltip 皆不含未解釋的英文語法或專業術語
- **SC-002**: 所有型別下拉選單選項 100% 附帶中文說明
- **SC-003**: 所有 `#include` 下拉選項 100% 附帶功能說明
- **SC-004**: 程式碼生成 round-trip 測試結果與改動前完全一致
- **SC-005**: 全部現有測試通過
- **SC-006**: 一位無程式設計經驗的使用者能僅透過積木文字和 tooltip 理解每個積木的用途

## Assumptions

- 積木 message 中保留必要的術語（如 int、void、struct），但旁邊加括號中文說明
- 下拉選單的 value 不改動，確保程式碼生成和 workspace 序列化不受影響
- 學生若想看原本的 C++ 語法，可以查看右側程式碼編輯器
- 測試中如有引用特定積木文字（如 message 字串比對），需要同步更新
