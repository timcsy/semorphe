# Research: Semantic Tree Restructure

**Branch**: `008-semantic-tree-restructure` | **Date**: 2026-03-06

## R1: VSCode 風格編輯器佈局

**Decision**: 採用 VSCode 風格的面板佈局——左側 sidebar（工具箱/概念瀏覽器）、中央分割面板（積木 + 程式碼）、底部面板（Console 輸出/診斷）、頂部工具列（投影參數切換）。程式碼編輯器使用 **Monaco Editor**（VSCode 的核心編輯器元件）取代 CodeMirror。

**Rationale**: 使用者明確要求類似 VSCode 的體驗。Monaco Editor 提供與 VSCode 完全一致的編輯體驗（語法高亮、自動完成、多游標、minimap、快捷鍵等），且為 Microsoft 開源專案，社群活躍。相較 CodeMirror，Monaco 開箱即用的功能更豐富，無需額外安裝語言支援插件（內建 C/C++ 語法高亮）。

**Alternatives considered**:
- CodeMirror 6（現有方案）：輕量但需手動配置語言支援，功能不如 Monaco 豐富
- Ace Editor：功能介於 CodeMirror 和 Monaco 之間，但社群不如 Monaco 活躍
- 自建編輯器：完全不必要的過度工程

## R2: 語義樹的資料結構設計

**Decision**: SemanticNode 為不可變的樹節點，每次修改產生新版本。樹的根節點持有 version counter，用於快速比較。

**Rationale**: 不可變樹結構簡化了 undo/redo、diff 比較、以及 localStorage 序列化。Blockly 和 CodeMirror 各自維護內部狀態，語義樹作為 Single Source of Truth 在同步時重建各端。

**Alternatives considered**:
- 可變樹 + observer pattern：雙向綁定複雜，容易產生循環更新
- CRDT：過度設計，不需要多人協作

## R3: lift() 管線實作策略

**Decision**: lift() 由一系列 Lifter（per concept）組成 pipeline。每個 Lifter 負責一種 AST pattern 到語義概念的映射。Lifter 按優先順序排列，第一個匹配的 Lifter 處理該節點。

**Rationale**: 與 JSON 積木定義中的 astPattern 對齊。新增積木 = 新增 Lifter（JSON 驅動），符合 P3 開放擴充。

**Alternatives considered**:
- 大 switch-case：不可擴充
- Visitor pattern on AST：需要為每個語言手寫 visitor，不符合 JSON-only 擴充

## R4: 同步機制（手動觸發）

**Decision**:
- 積木 → 程式碼：Blockly workspace change event → 更新語義樹 → project() 生成程式碼 → 寫入 CodeMirror（自動）
- 程式碼 → 積木：使用者按「同步」按鈕 → parse() → lift() → 更新語義樹 → project() 生成積木 → 寫入 Blockly（手動觸發）
- 語法錯誤時：顯示錯誤提示 + 標示位置 → 使用者確認後部分同步

**Rationale**: Clarification 中確認為手動觸發。避免了打字中途的頻繁重解析，降低複雜度。

## R5: 概念註冊與 JSON 載入

**Decision**: 所有積木定義（Universal + Lang-Core + Lang-Library）統一使用增強版 JSON 格式（含 concept 欄位）。啟動時掃描所有 JSON 檔案，自動註冊到 ConceptRegistry 和 BlockRegistry。

**Rationale**: 符合 P3——新增套件只加 JSON。現有的 JSON 格式已有 blockDef + codeTemplate + astPattern，只需新增 concept 層。

## R6: Style preset 切換策略

**Decision**: Style 定義為 JSON 配置（含 io_style、naming_convention、indent、brace_style 等）。project() 接受 Style 參數，在 code generation 時套用。Style 不影響語義樹。

**Rationale**: 符合 P1 正交性——Style 只影響程式碼投影。

## R7: 漸進揭露實作方式

**Decision**: 每個 BlockSpec JSON 新增 `level` 欄位（0/1/2）。工具箱根據當前認知層級過濾。已在 workspace 中的積木若超出層級，降級為通用積木顯示。

**Rationale**: 最簡實作方式，完全由 JSON 驅動，不需要額外邏輯。

## R8: 持久化格式

**Decision**: 語義樹序列化為 JSON，存入 localStorage key `code-blockly:semantic-tree`。匯出/匯入使用相同格式。包含版本號用於未來遷移。

**Rationale**: JSON 是最自然的序列化格式，與 SemanticNode 結構一一對應。
