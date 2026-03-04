# Research: 積木系統 UX 深度改善（第二波）

**Date**: 2026-03-04 | **Branch**: `004-deep-ux-improve`

## R1: 預設模板載入機制

**Decision**: 使用 `Blockly.serialization.workspaces.load()` 載入預設 JSON 狀態

**Rationale**:
- Blockly 12.x 提供 `Blockly.serialization.workspaces.load(state, workspace)` 原生 API
- 可直接用 JSON 定義巢狀積木結構（function body 內包含 return）
- 與現有 `setState()` / `getState()` 序列化格式完全相容
- 在 `App.restoreState()` 中，若 localStorage 無資料則載入模板 JSON

**Alternatives considered**:
- 程式化建立積木（`workspace.newBlock()`）→ 更脆弱，維護成本高
- 從 C++ 程式碼反向轉換 → 增加啟動延遲，依賴 parser 初始化完成

## R2: 工具箱分級切換

**Decision**: 使用 `workspace.updateToolbox()` 動態切換不同的 toolbox 定義

**Rationale**:
- Blockly 原生支援 `workspace.updateToolbox(toolboxDef)` 動態替換整個工具箱
- `BlockRegistry.toToolboxDef()` 已存在，只需擴充支援過濾參數
- 初級模式的積木清單為靜態設定（約 15 個），存為常數陣列
- 切換只影響工具箱顯示，不移除 workspace 中已存在的積木

**Alternatives considered**:
- Blockly 自帶的 toolbox category 摺疊 → 無法完全隱藏積木，只是收合
- 多個 toolbox XML → 已改用 JSON 格式，不適用

**初級模式積木清單**（~15 個）:
| 分類 | 積木 |
|------|------|
| 資料 | u_var_declare, u_var_assign, u_var_ref, u_number, u_string |
| 運算 | u_arithmetic, u_compare, u_logic |
| 流程控制 | u_if, u_if_else, u_count_loop, u_while_loop |
| 函式 | u_func_def, u_func_call, u_return |
| 輸入輸出 | u_print, u_input, u_endl |

共 18 個積木，6 個分類。

## R3: 變數 Dropdown 動態更新

**Decision**: 使用 `FieldDropdown` 搭配函式生成器（function generator）掃描 workspace

**Rationale**:
- `new Blockly.FieldDropdown(generateOptions)` 接受函式，每次打開下拉選單時即時呼叫
- 可透過 `workspace.getBlocksByType('u_var_declare', false)` 掃描所有變數宣告
- 同時收集 `u_count_loop` 的 VAR 欄位
- Blockly 要求至少 1 個選項，無變數時提供預設佔位 `('(自訂)', '__CUSTOM__')`
- 手動輸入：使用「自訂」選項 + 額外 FieldTextInput 欄位，或改用可編輯的 dropdown 模式

**Alternatives considered**:
- workspace change listener 維護全域變數列表 → 額外狀態同步成本
- Blockly Variables API → 不適用，因為我們自定義了變數宣告積木

## R4: 連接型別檢查

**Decision**: 在 JSON 積木定義中使用 `"check"` 屬性，搭配 `"Statement"` / `"Expression"` 型別字串

**Rationale**:
- 現有積木已部分使用 `"check": "Expression"` 在 value inputs 上
- 現有積木已使用 `"output": "Expression"` 在 expression 積木上
- 但 `previousStatement` 和 `nextStatement` 皆為 `null`（無限制），需改為 `"Statement"`
- `appendStatementInput('BODY')` 需加上 `.setCheck('Statement')`
- Blockly 原生的 check 機制：兩端 check 至少有一個共同字串即可連接，`null` = 接受一切

**變更範圍**:
- 所有 JSON 積木定義：`"previousStatement": null` → `"previousStatement": "Statement"`，`"nextStatement": null` → `"nextStatement": "Statement"`
- 動態積木（blockly-editor.ts）：同步更新 `setPreviousStatement` / `setNextStatement` 參數
- Statement inputs（BODY, DO, ELSE 等）：加上 `"check": "Statement"`
- **不影響**載入已儲存的 workspace（Blockly 在 load 時不做 check 驗證）

**Alternatives considered**:
- Custom ConnectionChecker plugin → 過於複雜，標準 setCheck 已足夠
- 自訂更細的型別（Number, Boolean, String）→ 初期只需 Statement vs Expression 二分法

## R5: 快捷列實作

**Decision**: 在 workspace 上方新增 HTML 按鈕列，使用 `Blockly.serialization.blocks.append()` 建立積木

**Rationale**:
- 快捷列是 Blockly 外部的 HTML UI 元素，不是 Blockly 工具箱的一部分
- `Blockly.serialization.blocks.append(blockState, workspace)` 可在任意位置建立積木
- 位置計算：使用 `workspace.getMetrics()` 取得可見區域中央座標
- 連續點擊的位移：累加 offset（30px）避免重疊

**Alternatives considered**:
- 使用 Blockly 的 flyout → 無法自訂為圖示按鈕列
- context menu → 需要右鍵操作，不夠直覺

## R6: 即時錯誤提示

**Decision**: 使用 `block.setWarningText()` + workspace change listener + debounce

**Rationale**:
- `block.setWarningText('message')` 會在積木上顯示黃色警告三角圖示
- 點擊圖示或 hover 會顯示錯誤訊息（Blockly 原生 UI）
- `block.setWarningText(null)` 清除警告
- 多個獨立警告：`setWarningText('msg', 'warningId')` 支援 ID 管理
- workspace change listener：過濾 `isUiEvent` 提升效能
- 300ms debounce 避免頻繁觸發

**檢查規則**:
1. **非 void 函式缺少 return**: 掃描所有 `u_func_def`，若 RETURN_TYPE ≠ 'void' 則檢查 BODY 中是否有 `u_return`
2. **未宣告變數**: 掃描所有 `u_var_ref`，檢查 NAME 值是否存在於任何 `u_var_declare.NAME` 或 `u_count_loop.VAR`

**Alternatives considered**:
- 自訂 SVG 覆層 → 額外維護成本，不如用原生 warning API
- block.setEnabled(false) → 過於激進，spec 要求不阻止操作
