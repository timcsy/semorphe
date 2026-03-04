# Research: 概念式積木系統重新設計

**Feature**: 002-concept-blocks-redesign
**Date**: 2026-03-03

## 決策 1：積木定義架構——共用與語言特殊的分離方式

**Decision**: 在 BlockSpec 加入 `language` 欄位（`"universal"` 或語言 ID 如 `"cpp"`），共用積木不含 `codeTemplate`/`astPattern`，這些由各語言模組提供映射。

**Rationale**:
- 現有 `BlockSpec` 已經是通用的 JSON 格式，只需加一個欄位即可區分
- 共用積木只需描述 UI 外觀（message、fields、connections），不含任何語言語法
- 各語言模組提供「積木 ID → 程式碼模板」和「AST 節點 → 積木 ID」的映射表
- BlockRegistry 可以按 `language` 過濾，工具箱只顯示 `universal` + 當前語言的積木

**Alternatives considered**:
- 完全分離檔案（共用一套 JSON、每語言一套 JSON）：增加載入複雜度，但組織更清晰。最終採用此方式組織檔案，但 BlockSpec 格式統一。
- 繼承模式（共用積木是父類，語言積木繼承擴充）：過度工程化，YAGNI。

## 決策 2：CodeToBlocksConverter 的語言解耦策略

**Decision**: 引入 `LanguageAdapter` 介面，將 AST 欄位萃取邏輯從 `CodeToBlocksConverter` 移入語言模組。Converter 成為通用骨架，語言模組提供 AST 節點到積木欄位的映射。

**Rationale**:
- 現有 `CodeToBlocksConverter` 有 800+ 行，其中約 500 行是 C++ 特定的欄位萃取方法（`extractForValue`、`extractIfValue` 等）
- 這些方法的邏輯模式一致：從 tree-sitter 節點取出特定 field name 的子節點，轉換為積木欄位值
- 可以將「哪個 tree-sitter 欄位名對應哪個積木欄位」抽象為資料驅動的映射表
- 保留通用的 `buildBlock`、`chainStatements`、`convertToExpression` 在核心

**Alternatives considered**:
- 每個語言完全獨立實作 Converter：重複太多通用邏輯（block building、chaining、position calculation）
- 策略模式（每個 extractXxxValue 方法由語言模組覆寫）：方法太多，介面太肥

## 決策 3：計數式 for 迴圈的 AST 辨識策略

**Decision**: C++ Parser 辨識 for_statement 時，先嘗試匹配「計數模式」（init 是 declaration 或 assignment、condition 是 binary comparison、update 是 increment/decrement），匹配成功則映射到共用的「計數式重複」積木；失敗則降級為 C++ 特殊的「三段式 for」積木。

**Rationale**:
- APCS 常見的 for 迴圈約 80% 符合計數模式 `for (int i = 0; i < N; i++)`
- 計數模式辨識邏輯屬於語言模組（C++ LanguageAdapter），不在共用核心
- 降級路徑確保不遺失任何程式碼資訊

**Alternatives considered**:
- 全部 for 迴圈用三段式積木：失去「概念式」的教學價值
- 用 heuristic 嘗試更多模式（倒數、步進 2 等）：初期不必要，可以未來擴充

## 決策 4：共用積木的程式碼生成方式

**Decision**: 各語言的 Generator 維護一個「共用積木 ID → 生成邏輯」的映射表。Generator 收到共用積木時，查表取得生成函式；收到語言特殊積木時，使用原有的 `codeTemplate` 替換邏輯。

**Rationale**:
- 共用積木沒有 `codeTemplate`（因為不包含任何語言語法），所以 Generator 不能用現有的 substituteTemplate
- 但 Generator 的通用邏輯（statement chaining、indentation、precedence）仍然適用
- 每個語言只需要新增 ~21 個共用積木的生成規則

**Alternatives considered**:
- 共用積木也帶 codeTemplate（每語言一份）：違反 FR-004 的解耦要求
- 全部用 codeTemplate 但不放在 BlockSpec 裡而放在 Generator 配置檔：本質上就是映射表，只是組織方式不同。最終選擇直接寫在 Generator 程式碼中，因為生成邏輯可能包含非模板化的邏輯（如 cin/cout vs scanf/printf 的完全不同結構）

## 決策 5：雙向對照高亮的實作方式

**Decision**: 在 `CodeToBlocksConverter` 過程中，為每個 block 記錄其對應的原始碼行號範圍（source mapping）。Blockly 選取積木時查映射表高亮 CodeMirror 行；CodeMirror 游標位置變動時查映射表反向高亮 Blockly 積木。

**Rationale**:
- tree-sitter 的每個 Node 都有 `startPosition` 和 `endPosition`，可以直接取得行號
- 只需在 `buildBlock` 時附加 `{ startLine, endLine }` 到 block 上
- Blockly 提供 `workspace.addChangeListener` 可以監聽選取事件
- CodeMirror 6 提供 `onUpdate` 可以監聽游標移動

**Alternatives considered**:
- 用 block ID 反查（需要 Generator 也記錄行號映射）：更準確但複雜度更高
- 僅用行號匹配（不精確）：可能高亮錯誤的積木，體驗差
