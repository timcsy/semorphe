# Research: 前端 UI/UX 第一性原理合規

## R1: Blockly 積木動態視覺樣式機制

**Decision**: 使用 Blockly 的 `block.setColour()` + `block.setWarningText()` + `block.setTooltip()` API 在積木建立後動態覆蓋樣式，透過 block-renderer.ts 在 BlockState 的 `extraState` 中攜帶 degradationCause/confidence metadata，由 blockly-editor.ts 的 registerBlocks() 或 postRender hook 讀取並套用。

**Rationale**: Blockly 的 BlockState (JSON serialization) 不原生支援 colour 覆蓋，但 `extraState` 是自由格式的擴充欄位。積木在 workspace 載入後可透過 `block.setColour()` 動態修改顏色。這是 Blockly 官方建議的動態樣式方案。

**Alternatives considered**:
- CSS class injection（Blockly 的 SVG 結構不穩定，跨版本風險高）
- 自訂 Blockly renderer plugin（工程量太大，違反簡約原則）
- 在 blockDef 中預定義所有降級變體（違反 P3 開放擴充）

## R2: Toolbox 動態生成現況

**Decision**: 現有系統已有 `BlockRegistry.toToolboxDef()` 動態生成 toolbox，只需：(1) 將 `BEGINNER_BLOCKS` 硬編碼陣列改為讀取 BlockSpec 的 `level` 欄位；(2) 將動態積木的 `setColour()` 硬編碼改為從 JSON spec 讀取；(3) 新增 style-aware 排序邏輯。

**Rationale**: 系統已 ~85% 動態化。不需要重寫 toolbox 系統，只需補齊缺失的 level 查詢和 style 排序。

**Alternatives considered**:
- 完全重寫 toolbox 系統（不必要，現有架構足夠）
- 在 BlockSpec JSON 中加入 toolboxOrder 欄位（過度設計）

## R3: 顏色集中管理策略

**Decision**: 建立 `src/ui/theme/category-colors.ts` 集中定義所有類別顏色，BlockSpec JSON 中的 `colour` 欄位改為引用類別名稱（如 `"colour": "data"`），由 block registration 時查表填入實際顏色值。動態積木的 `setColour()` 也改為引用此表。

**Rationale**: 目前顏色散布在 4 個 JSON 檔案和 blockly-editor.ts 的 13 個 `setColour()` 呼叫中。集中管理讓新增類別時只改一處。但 JSON 中仍保留顏色值以保持可讀性——集中表作為 fallback 和 mutator helper 的來源。

**Alternatives considered**:
- 完全從 JSON 中移除顏色（降低 JSON 可讀性）
- CSS 變數方案（Blockly 使用 SVG fill，不走 CSS 變數）

## R4: Block Style Preset 機制

**Decision**: 建立 `BlockStylePreset` 介面，包含 `renderer`、`density`（影響 `Blockly.BlockSvg.START_HAT` 等）、`colourScheme`、`inputsInline` 預設值。初期提供 3 個 preset：scratch（zelos + compact + Scratch 配色）、classic（geras + normal + 經典配色）、teaching（zelos + spacious + 高對比配色）。切換時重新注入 Blockly workspace 設定。

**Rationale**: Blockly 的 renderer、theme、grid 都可在 workspace 建立時設定。切換 renderer 需要重建 workspace（Blockly 限制），但切換 theme 和 zoom 可以動態。

**Alternatives considered**:
- 只支援 theme 切換不支援 renderer 切換（限制太大）
- 提供完全自訂介面（違反簡約原則，初期 preset 足夠）

## R5: Style 切換 UI 位置

**Decision**: 在現有的 header toolbar 區域（`#toolbar`）新增兩個 dropdown：Code Style 和 Block Style。不新增獨立的狀態列元件。

**Rationale**: 目前沒有獨立的 status bar 元件，狀態資訊嵌在 console panel header 中。在 toolbar 新增 dropdown 最小化 UI 變動，且 toolbar 已有認知層級切換按鈕，風格切換邏輯類似。

**Alternatives considered**:
- 新建獨立 status bar（UI 變動大，且目前資訊量不夠充實）
- 放在設定面板/modal（操作路徑太深，不符合「即時切換」需求）

## R6: Annotation 積木呈現方式

**Decision**: 行尾註解（inline annotation）透過 `block.setCommentText()` 在積木上顯示 Blockly 內建的 comment icon（💬），hover 顯示完整內容。獨立註解使用現有的 `c_comment_line` 積木渲染。

**Rationale**: Blockly 原生支援 `block.setCommentText(text)` 會在積木上顯示一個 📝 圖示，點擊展開完整文字。這是最低工程量且 UX 一致的方案。

**Alternatives considered**:
- 自訂 DOM overlay 在積木旁顯示文字（工程量大，與 Blockly SVG 整合困難）
- 在 tooltip 中顯示（tooltip 已被降級/confidence 資訊佔用）
