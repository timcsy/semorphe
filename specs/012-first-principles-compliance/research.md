# Research: First Principles Compliance

## R1: tree-sitter C++ 註解節點行為

**Decision**: tree-sitter C++ 將 `//` 和 `/* */` 解析為 `comment` 節點，且為 named node。comment 節點出現在 AST 的 children 列表中，與其他 sibling 同級。

**Rationale**: 經確認 tree-sitter-cpp grammar，comment 是 named node，可透過 `node.namedChildren` 取得。行尾註解與獨立註解都是 `comment` type，差別在於 `startPosition.row` 是否與前一 sibling 的 `endPosition.row` 相同。

**Alternatives considered**:
- 用 regex 從原始碼文字提取註解 → 脆弱，無法正確處理字串內的 `//`
- 自訂 tree-sitter grammar → 不必要，預設行為已足夠

## R2: Confidence 系統 — 現有程式碼盤點

**Decision**: 現有 `NodeMetadata.confidence` 只有 `'high' | 'inferred'` 兩級。需擴展為 6 級 union type，但保持向後相容（`'high'` 和 `'inferred'` 語義不變）。

**Rationale**:
- `types.ts:24` 定義 `confidence?: 'high' | 'inferred'`
- `lifter.ts:78` 設定 `confidence: 'inferred'`（Level 3 unresolved）
- Level 1-2 未明確設定 confidence（隱含 high）
- Level 4 raw_code 未設定 confidence

需要的修改點：
1. `types.ts` — 擴展 type union + 新增 `degradationCause`
2. `lifter.ts:76-86` — Level 3 設定 `confidence: 'inferred'`
3. `lifter.ts:90-101` — Level 4 新增 `confidence: 'raw_code'` + `degradationCause`
4. 新增判定 `degradationCause` 的邏輯（需要 ConceptRegistry 查表）

**Alternatives considered**:
- 用 number (0-1) 表示 confidence → 離散類別更適合 UI 顯示和業務邏輯分支
- 將 degradationCause 放在 properties 而非 metadata → metadata 是正確的位置（不影響語義）

## R3: 驗證腳本 — 路徑偵測策略

**Decision**: 腳本讀取 JSON 檔案靜態分析，不需要實際初始化引擎。

**Rationale**:
- **lift path**: 從 `BlockSpec.astPattern`（basic/advanced/special.json）和 `LiftPattern`（lift-patterns.json）可靜態判斷
- **render path**: 從 `BlockSpec.renderMapping` 可靜態判斷
- **extract path**: PatternExtractor 依 `renderMapping` 反向運作，所以 `renderMapping` 存在 = extract 存在
- **generate path**: 從 `BlockSpec.codeTemplate` 和 `UniversalTemplate` 可靜態判斷
- 手寫 lifter/generator 需要額外列舉（hardcoded list 或 AST 掃描 `.register()` 呼叫）

**手寫 lifter/generator 偵測**: 用 regex 掃描 `src/languages/cpp/lifters/*.ts` 和 `src/languages/cpp/generators/*.ts` 中的 `.register('conceptId', ...)` 呼叫，提取 concept ID。

**Alternatives considered**:
- 實際初始化所有引擎再查表 → 需要 tree-sitter WASM，在 CI 環境不方便
- 只檢查 JSON → 遺漏手寫路徑的覆蓋

## R4: Code Style — 手寫 generator 覆蓋率

**Decision**: 手寫 generator（`io.ts`, `declarations.ts`, `statements.ts`, `expressions.ts`）部分已支援 style 參數，部分需要補強。

**Rationale**:
- `template-generator.ts` 已支援 `styleVariants`（JSON 模板層面）
- `code-generator.ts` 的 `generate()` 接收 `GenerateContext`（含 `style`）
- 手寫 generator 在 `io.ts` 中需根據 `style.ioPreference` 選 cout vs printf
- `braceStyle` 目前僅在 template 層面支援，手寫的 `if`/`while`/`for` generator 需要檢查

**Alternatives considered**:
- 所有 generator 改為 JSON template → 部分概念（如 for loop）太複雜，不適合純模板
- 在 generate 後做 formatter → 增加依賴，且不解決 I/O 函式選擇問題

## R5: 積木視覺區分方案

**Decision**: 使用 Blockly 的 `setStyle()` / `setColour()` API 搭配 CSS class 來區分降級原因。

**Rationale**:
- Blockly 支援 block-level style（`block.setStyle('degraded_error')`）
- 可透過 CSS theme 定義不同 style 的顏色
- tooltip 用 `block.setTooltip()` 設定人類可讀的降級說明

**視覺方案**:
- `syntax_error` → `#FF6B6B` 紅色背景 + ⚠ tooltip
- `unsupported` → `#9E9E9E` 灰色背景 + ℹ tooltip
- `nonstandard_but_valid` → 正常背景 + `#4CAF50` 綠色邊框 + ✓ tooltip

**Alternatives considered**:
- 用 badge/icon overlay → Blockly 不原生支援，需要 hack
- 用 warning bubble → 太醒目，且 unsupported 不應該像 error
