# Feature Specification: Topic System（主題 × 層級樹 × 積木覆蓋）

**Feature Branch**: `022-topic-system`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Phase 6: Topic System — Implement the Topic dimension for Semorphe so that the same language (e.g. C++) can have different Topics (beginner, competitive, Arduino) with different level trees, block visibility, and block shape overrides. Topic is a pure projection-layer concept."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 使用者在同一語言的不同 Topic 間切換 (Priority: P1)

使用者在 Semorphe 中使用 C++，根據當前的工作情境選擇不同的 Topic。例如：寫基礎程式時用「初學 C++」Topic（cout/cin、變數、if、while）；準備競賽時切換到「競賽程式」Topic（scanf/printf、陣列、排序在較早層級出現）；做嵌入式專案時切換到「Arduino」Topic（digitalRead、Serial.print 等硬體 API 優先）。

Topic 不限於教學——任何需要「同一語言、不同積木子集和呈現」的情境都適用：課程設計、工作坊、專案範本、領域特化開發環境等。

**Why this priority**: Topic 是本功能的核心價值——讓同一語言在不同情境下有不同的積木組合和呈現。沒有這個，其他功能都沒有意義。

**Independent Test**: 可以透過在 UI 中切換 Topic 並驗證 toolbox 內容變化來獨立測試。

**Acceptance Scenarios**:

1. **Given** 系統已載入 C++ 語言，且至少有兩個 Topic 定義（cpp-beginner, cpp-competitive），**When** 使用者從 Topic 選擇器切換 Topic，**Then** toolbox 立即更新為該 Topic 的層級樹所定義的積木子集
2. **Given** 使用者在 cpp-beginner Topic 下已建立一棵語義樹，**When** 切換到 cpp-competitive Topic，**Then** 語義樹內容完全不變，只有積木的呈現方式和 toolbox 可見性改變
3. **Given** cpp-beginner 的 print 概念只顯示 VALUE 輸入，**When** 切換到 cpp-competitive，**Then** 同一個 print 概念改為顯示 FORMAT + ARG 輸入（printf 風格）

---

### User Story 2 - 使用者沿層級樹展開概念 (Priority: P1)

使用者在某個 Topic 下工作，最初只看到 L0 的基礎積木（約 8 個）。隨著需要，在層級選擇器中展開特定分支——例如展開「函式」分支看到 for 迴圈和函式定義，或展開「資料結構」分支看到陣列和字串操作。使用者可以同時啟用多個分支，不必一次開放整層所有概念。

**Why this priority**: 層級樹是 Topic 的核心機制。線性 L0/L1/L2 不足以支撐不同使用路徑，樹狀結構讓使用者按需展開，符合漸進揭露原則。

**Independent Test**: 可以透過操作層級選擇器 UI 並驗證 toolbox 隨分支啟用/停用而變化來獨立測試。

**Acceptance Scenarios**:

1. **Given** 使用者在 L0 層級，**When** 展開 L1a 分支，**Then** toolbox 顯示 L0 + L1a 的積木聯集
2. **Given** 使用者已啟用 L1a 和 L1b 兩個分支，**When** 查看 toolbox，**Then** 顯示 L0 + L1a + L1b 的積木聯集（分支可疊加）
3. **Given** 使用者啟用了 L2a 分支，**When** 停用 L2a 分支，**Then** toolbox 回到 L0 + L1a 狀態，已放置在畫布上使用 L2a 概念的積木保持原形狀但降低透明度並標記為「超出範圍」，不可拖曳到新位置

---

### User Story 3 - BlockSpec 覆蓋讓同一概念在不同 Topic 有不同積木形狀 (Priority: P2)

Topic 定義者為特定情境客製積木形狀。例如 Arduino Topic 中 `print` 概念需要額外的 SERIAL_PORT 下拉選單，只需在 Topic 定義檔中為 `print` 加 BlockOverride，覆蓋 args 欄位（新增 SERIAL_PORT），其餘保持 base BlockSpec 不變。

**Why this priority**: BlockOverride 是讓 Topic 能真正差異化呈現的機制。沒有它，Topic 只能控制可見性而無法改變積木形狀。但基本的 Topic 切換和層級樹（P1）已經提供核心價值。

**Independent Test**: 可以透過定義含 BlockOverride 的 Topic JSON，在該 Topic 下渲染積木並驗證形狀改變來獨立測試。

**Acceptance Scenarios**:

1. **Given** Topic 定義了 print 概念的 BlockOverride（新增 SERIAL_PORT arg），**When** 在該 Topic 下渲染 print 積木，**Then** 積木顯示 base BlockSpec 的欄位 + override 新增的 SERIAL_PORT 欄位
2. **Given** Topic 定義了 print 概念的 message override（從 "print" 改為 "Serial.print"），**When** 渲染該積木，**Then** 積木顯示標題為 "Serial.print"
3. **Given** 某概念沒有 BlockOverride，**When** 在該 Topic 下渲染，**Then** 使用 base BlockSpec，行為與無 Topic 時完全相同

---

### User Story 4 - Topic 持久化與自動恢復 (Priority: P3)

使用者在某個 Topic 下工作，啟用了特定分支。關閉瀏覽器後，下次開啟時系統自動恢復到相同的 Topic 和已啟用分支狀態。

**Why this priority**: 持久化是好的使用體驗但不影響核心功能。系統在沒有持久化的情況下仍可運作（每次手動選擇即可）。

**Independent Test**: 可以透過設定 Topic + 分支、重載頁面、驗證狀態恢復來獨立測試。

**Acceptance Scenarios**:

1. **Given** 使用者已選擇 Topic 和啟用了特定分支，**When** 頁面重載，**Then** Topic 和分支狀態自動恢復
2. **Given** 儲存的 Topic 已被移除（例如 Topic JSON 檔案已刪除），**When** 頁面載入，**Then** 系統 fallback 到語言的預設 Topic，不報錯

---

### Edge Cases

- 使用者的語義樹包含當前 Topic/分支不可見的概念時：積木保持原形狀但降低透明度並標記為「超出當前範圍」，不可拖曳到新位置但可查看，語義節點不變
- Topic 的 BlockOverride 改變了一個已在畫布上的積木的 args 時，如何處理？（假設：積木重新渲染，新增的欄位使用預設值，移除的欄位值保留在語義節點中但不顯示）
- 每個語言都必須定義至少一個 Topic。CognitiveLevel 型別被完全移除，不保留向後相容
- 層級樹的分支啟用/停用是否即時生效？（假設：是，toolbox 立即更新）
- 兩個分支包含同一概念時的行為？（假設：概念只要在任一已啟用分支中出現就可見，union 語義）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 支援 Topic 定義，每個 Topic 包含：唯一 ID、所屬語言、顯示名稱、是否為預設（`default`）、層級樹結構、可選的 BlockOverride 集合
- **FR-002**: 系統 MUST 支援樹狀層級結構（LevelNode），每個節點包含：層級編號、標籤、該層新增的概念列表、子節點列表
- **FR-003**: 系統 MUST 提供 TopicRegistry，可按語言查詢可用 Topic、註冊新 Topic、取得特定 Topic
- **FR-004**: 系統 MUST 根據 Topic 的層級樹和當前已啟用的分支，計算可見概念集合（所有已啟用分支的聯集）
- **FR-005**: 系統 MUST 支援 BlockOverride，可覆蓋 BlockSpec 的 message、tooltip、args、renderMapping 欄位。args 覆蓋採合併語義：同名 arg 覆蓋值、新 arg 追加、未提及的保留 base 值，可用特殊標記移除 base 中的特定 arg
- **FR-006**: 系統 MUST 在查詢 BlockSpec 時支援 Topic 參數，按「Topic override → base BlockSpec」順序查找
- **FR-007**: 系統 MUST 完全移除 `CognitiveLevel` 型別，以 Topic + LevelTree 取代所有層級過濾邏輯。每個語言 MUST 定義至少一個 Topic
- **FR-008**: 系統 MUST 確保 Topic 切換不影響語義樹——SemanticNode 不知道 Topic 的存在
- **FR-009**: 系統 MUST 確保 Lifter 保持 Topic-agnostic——提升過程不受 Topic 影響
- **FR-010**: Toolbox MUST 根據當前 Topic 和已啟用分支動態顯示可用積木
- **FR-011**: 系統 MUST 提供 Topic 選擇 UI，讓使用者在同一語言的不同 Topic 間切換（本 Phase 僅提供選擇，不提供 Topic 編輯功能；未來 Phase 應提供 UI 讓使用者建立/修改自訂 Topic）
- **FR-012**: 系統 MUST 提供層級樹瀏覽 UI，讓使用者啟用/停用層級樹的特定分支
- **FR-013**: 系統 MUST 提供至少兩個 C++ 內建 Topic 定義（如初學者、競賽程式等）
- **FR-014**: 系統 MUST 將使用者的 Topic 選擇和分支啟用狀態持久化到本地儲存
- **FR-015**: 系統 MUST 在 Topic 載入失敗時 gracefully fallback 到預設 Topic（`default: true`）或無 Topic 模式
- **FR-016**: 每個語言 MUST 有且只有一個 Topic 標記為 `default: true`，作為初次使用和 fallback 的預設選擇

### Key Entities

- **Topic**: 代表一個使用情境（教學課程、工作坊、專案範本、領域特化等）。包含唯一 ID、語言綁定、名稱、是否為預設（`default`）、層級樹結構、積木覆蓋規則。每個語言可有多個 Topic，其中一個標記為預設。
- **LevelNode**: 層級樹中的一個節點。包含層級編號、標籤、該層新增的概念 ID 列表、子節點列表。形成樹狀結構，分支可疊加。
- **BlockOverride**: Topic 對某個概念的積木呈現覆蓋。可覆蓋 message、tooltip、args、renderMapping 中的任意子集。未覆蓋的欄位沿用 base BlockSpec。
- **TopicRegistry**: Topic 的註冊表。提供查詢、註冊、列表功能。
- **UserContext（Topic 部分）**: 使用者的 Topic 選擇和分支啟用狀態。持久化在本地儲存中。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在同一語言下切換 Topic 後，toolbox 內容在 200ms 內完成更新
- **SC-002**: Topic 切換前後，語義樹的 JSON 序列化結果完全相同（零語義影響）
- **SC-003**: 遷移後所有現有功能測試仍 100% 通過（CognitiveLevel 完全移除，所有層級過濾改走 Topic + LevelTree）
- **SC-004**: 至少 2 個 C++ Topic 定義，每個 Topic 的層級樹至少有 3 層、2 個分支
- **SC-005**: BlockOverride 覆蓋的積木在渲染後，覆蓋的欄位與 override 定義完全一致，未覆蓋的欄位與 base BlockSpec 完全一致
- **SC-006**: 頁面重載後，Topic 和分支狀態 100% 恢復到關閉前的狀態
- **SC-007**: 倍增軟指引：每層的可見積木數量約為上一層的 1.5~2.5 倍（非硬約束，僅在 Topic 定義中以 warning 提示不符合的情況）

## Clarifications

### Session 2026-03-11

- Q: BlockOverride 的 args 覆蓋語義是合併還是替換？ → A: 合併 + 可刪除（merge with removal）。同名 arg 覆蓋、新 arg 追加、未提及的保留，可用特殊標記移除 base 中的 arg。
- Q: 畫布上超出當前可見範圍的積木如何處理？ → A: 半透明標示。積木保持原形狀但降低透明度並標記為「超出範圍」，不可拖曳到新位置但可查看。
- Q: Topic 的建立者角色？ → A: 本 Phase 僅由開發者/設計者以 JSON 檔案定義，不提供 UI 編輯器。未來 Phase 應提供 UI 讓終端使用者建立/修改自訂 Topic。
- Q: 語言有多個 Topic 時，預設 Topic 如何決定？ → A: Topic 定義中有 `default: true` 欄位，由語言模組作者明確指定。
- Q: 是否保留 CognitiveLevel 向後相容？ → A: 不保留。完全移除 CognitiveLevel 型別，以 Topic + LevelTree 取代。所有 JSON 中的 level 欄位移除，概念層級歸屬由 Topic 的 LevelNode.concepts 決定。

## Assumptions

- Topic 定義以 JSON 檔案形式存放在語言模組目錄下（`src/languages/{lang}/topics/`），本 Phase 由開發者/設計者編寫；未來 Phase 規劃提供 UI 編輯器讓終端使用者自訂 Topic
- Topic 的 BlockOverride 只能覆蓋投影屬性（message、tooltip、args、renderMapping），不能改變概念的語義結構
- 「倍增軟指引」是設計建議，不是強制約束——系統只在 Topic 定義載入時發出 warning
- 分支啟用/停用是即時生效的，不需要額外的「套用」步驟
- 超出當前可見範圍的已放置積木不會被刪除，以降級方式顯示（如半透明或標記）
- Arduino Topic 僅預留佔位，實際填充等待 Phase 8（外部套件）完成
