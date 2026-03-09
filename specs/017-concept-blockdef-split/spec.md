# Feature Specification: Concept 與 BlockDef 分離

**Feature Branch**: `017-concept-blockdef-split`
**Created**: 2026-03-09
**Status**: Draft
**Input**: Phase 3 of architecture-evolution.md — 拆分 BlockSpec JSON 為語意層與投影層，建立語言套件 manifest

## User Scenarios & Testing *(mandatory)*

### User Story 1 - BlockSpec JSON 兩層拆分 (Priority: P1)

開發者目前維護的 BlockSpec JSON 檔案將 concept 語意定義（conceptId、properties、children、role、annotations）和 Blockly 投影定義（blockDef、renderMapping）混在同一個物件中。這導致：
- 新增一種視圖（如 DataFlow 或 VSCode）時，必須碰到所有語言套件的 JSON 檔案
- concept 語意和 UI 投影無法獨立演進
- 無法在不載入 Blockly 的環境中使用 concept 資訊

拆分後，語意層 `semantics/concepts.json` 定義 concept 的純語意資訊，投影層 `projections/blocks/*.json` 定義 Blockly 積木的 UI 規格，兩者透過 `conceptId` 關聯。

**Why this priority**: 這是 Phase 3 的核心目標，也是 Phase 4（VSCode Extension）的前置條件。沒有 concept/blockDef 分離，新視圖就必須依賴 Blockly。

**Independent Test**: 給定一組 concepts.json 和 block-specs.json，ConceptRegistry 和 BlockSpecRegistry 各自正確載入對應的資料，且兩者透過 conceptId 可關聯查詢。現有的所有 lifter、generator、renderer、extractor 測試均通過不退化。

**Acceptance Scenarios**:

1. **Given** 現有的 BlockSpec JSON 檔案, **When** 執行拆分遷移, **Then** 產出的 concepts.json 包含所有 concept 定義（conceptId、abstractConcept、properties、children、role、annotations），block-specs.json 包含所有 blockDef 和 renderMapping，且兩者透過 conceptId 一對一關聯
2. **Given** 拆分後的 JSON 檔案, **When** 應用程式啟動, **Then** ConceptRegistry 從 concepts.json 載入，BlockSpecRegistry 從 block-specs.json 載入，所有功能（code↔blocks 雙向轉換、toolbox 建構、cognitive level 過濾）行為不變
3. **Given** 拆分後的系統, **When** 只讀取 concepts.json（不載入 block-specs.json）, **Then** ConceptRegistry 可獨立使用，不依賴任何 Blockly 相關模組

---

### User Story 2 - 語言套件 Manifest (Priority: P2)

目前 C++ 語言模組的載入邏輯硬編碼在 `src/languages/cpp/module.ts` 中，直接 import 各 JSON 檔案和引擎。未來新增語言套件時，需要複製大量樣板程式碼。

建立 `languages/cpp/manifest.json`，聲明語言套件的 metadata 和提供的資源路徑，讓 LanguageModule 的載入可以由 manifest 驅動，為未來的多語言套件鋪路。

**Why this priority**: Manifest 是語言套件標準化的基礎，但不影響現有功能。在 P1 完成 concept/blockDef 拆分後，manifest 可以宣告拆分後的路徑。

**Independent Test**: 給定 manifest.json，LanguageModule 能正確找到並載入所有宣告的資源（concepts、block-specs、templates、lift-patterns），行為與硬編碼 import 一致。

**Acceptance Scenarios**:

1. **Given** languages/cpp/manifest.json 存在, **When** LanguageModule 載入, **Then** manifest 中宣告的所有資源路徑正確解析並載入
2. **Given** manifest 中宣告 `provides: ["concepts", "blocks", "templates", "lift-patterns"]`, **When** 查詢語言套件能力, **Then** 系統能判斷該語言套件提供哪些資源
3. **Given** manifest 中移除 `blocks` 資源, **When** 載入, **Then** ConceptRegistry 仍可載入 concepts（語意層獨立於投影層）

---

### User Story 3 - Dummy 唯讀視圖驗證解耦 (Priority: P3)

為驗證 concept 與 blockDef 的分離確實有效，新增一個極簡的 dummy 唯讀視圖，它只消費 ConceptRegistry 和 SemanticTree，不依賴 Blockly 或任何投影層模組。這證明新視圖可以只使用語意層資訊。

**Why this priority**: 純驗證性質，確認架構解耦成功。

**Independent Test**: dummy 視圖只 import `src/core/` 下的模組，不 import `blockly`、`src/ui/panels/`、或 `projections/` 下的任何東西。視圖能正確顯示 SemanticTree 中的 concept 名稱和屬性。

**Acceptance Scenarios**:

1. **Given** 一棵包含 var_declare 和 print 的 SemanticTree, **When** dummy 視圖渲染, **Then** 顯示每個節點的 concept 名稱和 properties
2. **Given** dummy 視圖的原始碼, **When** 靜態分析 import, **Then** 不包含 `blockly`、`panels/`、或 `projections/` 的任何 import

---

### Edge Cases

- BlockSpec 缺少 concept 欄位 → 遷移時應報錯或產出帶有 TODO 標記的條目
- concepts.json 中有 conceptId 但 block-specs.json 中無對應 blockDef → ConceptRegistry 可獨立存在，BlockSpecRegistry 查詢時回傳 null
- 重複的 conceptId → 註冊時後者覆蓋前者（與現行行為一致）
- manifest.json 格式錯誤 → 啟動時拋出明確錯誤訊息

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 將現有 BlockSpec JSON 中的 `concept` 欄位拆分到獨立的 concepts.json 檔案
- **FR-002**: 系統 MUST 將現有 BlockSpec JSON 中的 `blockDef`、`renderMapping`、`codeTemplate`、`astPattern` 保留在 block-specs.json 中，並以 `conceptId` 參照語意層
- **FR-003**: ConceptRegistry MUST 能從 concepts.json 獨立載入，不依賴 BlockSpecRegistry 或 Blockly
- **FR-004**: BlockSpecRegistry MUST 能從 block-specs.json 載入，並透過 conceptId 關聯 ConceptRegistry 中的 concept 定義
- **FR-005**: 拆分後所有現有測試 MUST 通過，功能不退化
- **FR-006**: 系統 MUST 提供 `languages/cpp/manifest.json`，宣告語言套件的 id、name、version、provides 清單、parser 資訊
- **FR-007**: LanguageModule MUST 能從 manifest 驅動載入，不再硬編碼資源路徑
- **FR-008**: 系統 MUST 包含一個 dummy 唯讀視圖，只依賴語意層（`src/core/`），不依賴 Blockly 或投影層
- **FR-009**: concepts.json 中的每個 concept MUST 包含：conceptId、layer、level、properties、children、role、annotations（可選）
- **FR-010**: block-specs.json 中的每個條目 MUST 包含：id、conceptId（參照 concepts.json）、blockDef、codeTemplate、astPattern、renderMapping（可選）

### Key Entities

- **Concept**: 語意概念定義，包含 conceptId、layer、level、properties、children、role、annotations。獨立於任何視圖。
- **BlockProjection**: Blockly 投影定義，包含 blockDef、renderMapping，透過 conceptId 關聯到 Concept。
- **LanguageManifest**: 語言套件描述檔，包含 id、name、version、provides、parser 等 metadata。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: concepts.json 和 block-specs.json 覆蓋所有原 BlockSpec JSON 中的定義，無遺漏
- **SC-002**: 所有現有測試（1484+ 個）通過，零退化
- **SC-003**: ConceptRegistry 可在不 import blockly 的環境中獨立載入 concepts.json
- **SC-004**: dummy 唯讀視圖的 import 清單不包含 blockly 或投影層模組
- **SC-005**: manifest.json 正確宣告所有 C++ 語言套件資源，LanguageModule 從 manifest 驅動載入成功
- **SC-006**: 專案建構（`npm run build`）成功，無新增警告
