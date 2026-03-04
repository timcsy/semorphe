# Research: 積木系統認知負荷改善

**Date**: 2026-03-03 | **Status**: Complete

## R-001: Blockly 動態積木（Dynamic Inputs）最佳實踐

**Decision**: 使用 `saveExtraState()` / `loadExtraState()` JSON 序列化 + 手動 `plus_()` / `minus_()` 按鈕模式

**Rationale**: 專案中已有成功的先例——`u_print` 積木已實作此模式（`blockly-editor.ts` L84-157）。此模式比 Blockly 的 `Blockly.Extensions.registerMutator()` 更直接，且與專案現有 JSON 序列化流程完全相容。`saveExtraState` / `loadExtraState` 是 Blockly 12.x 推薦的序列化方式。

**Alternatives considered**:
- Blockly mutator 彈出泡泡（bubble）：對學生來說操作步驟太多，概念上不必要
- 固定最大參數數量（如 10 個）並隱藏未使用的：浪費空間，積木會很長

## R-002: Blockly Dropdown 動態控制輸入顯示/隱藏

**Decision**: 使用 `setValidator()` 在 Dropdown 值變更時呼叫 `removeInput()` / `appendInput()` 來切換 `u_var_declare` 的初始值插槽

**Rationale**: Blockly 的 `FieldDropdown` 支援 `setValidator(callback)` 回調，在選項變更時觸發。可在回調中根據新值動態增減 input。這比 mutator 簡潔，也是 Blockly 官方範例中常見的模式。需搭配 `saveExtraState` / `loadExtraState` 來持久化選擇狀態。

**Alternatives considered**:
- 兩個獨立積木（`u_var_declare` + `u_var_declare_init`）：違反 spec 的 clarification 決定（使用 Dropdown）
- Mutator：對單一二選一的切換來說過度設計

## R-003: 被移除積木的 code-to-blocks 降級策略

**Decision**: 在 `CppLanguageAdapter.matchNodeToBlock()` 中，原本會返回已移除積木對應通用積木的映射保持不變（如 `number_literal` → `u_number` 仍成立），因為這些節點現在會映射到通用積木。只有那些在 registry 中被完全刪除且 adapter 也不處理的情況才會降級到 `c_raw_code`。

**Rationale**: 仔細檢查後發現：
- `c_number` 被刪但 `u_number` 仍在 → `number_literal` 在 adapter 中直接映射到 `u_number`（不需要經過 registry 的 `c_number`）
- `cpp_cout` 被刪但 `u_print` 仍在 → `cout <<` 在 adapter 中直接映射到 `u_print`
- `cpp_cin` 被刪但 `u_input` 仍在 → `cin >>` 在 adapter 中直接映射到 `u_input`
- `c_binary_op` 被刪但 `u_arithmetic`/`u_compare`/`u_logic` 仍在 → adapter 已處理
- `c_variable_ref` 被刪但 `u_var_ref` 仍在 → adapter 已處理
- `c_string_literal` 被刪但 `u_string` 仍在 → adapter 已處理
- `c_var_declare_init_expr` 被刪但 `u_var_declare` 仍在 → adapter 已處理

實際上，降級到 `c_raw_code` 的情況只會發生在 adapter 完全無法辨識的 AST 節點上，這與目前行為一致。

**Alternatives considered**:
- 保留被移除積木的 JSON 定義但標記為 hidden：已被 spec clarification 否決（完全刪除）

## R-004: u_func_def 參數結構化的序列化格式

**Decision**: `saveExtraState()` 格式為 `{ paramCount: number, params: Array<{ type: string, name: string }> }`

**Rationale**: 需要記錄每個參數的型別和名稱值，因為這些是動態產生的 field。`loadExtraState()` 重建時先建立正確數量的 input row，再設定各 field 的值。與現有 `u_print` 的 `{ itemCount }` 模式一致但擴展了 field 值的保存。

**Alternatives considered**:
- 只記錄 `paramCount`，讓 field 值由 Blockly 的標準序列化處理：Blockly 的標準序列化可能無法正確處理動態產生的 field，因為在 `loadExtraState` 時 field 尚未存在

## R-005: u_func_call 參數提取策略

**Decision**: `saveExtraState()` 格式為 `{ argCount: number }`；每個引數為獨立的 `value_input`（`ARG0`, `ARG1`, ...），接受任意表達式積木

**Rationale**: 函式呼叫的引數不需要型別資訊（只需要表達式），所以比 `u_func_def` 簡單。與 `u_print` 的 `EXPR0`, `EXPR1` 模式完全一致。

## R-006: 計數迴圈包含端點語意的實作

**Decision**: 在 `adapter.ts` 的 `generateCode()` 中，將 `u_count_loop` 的生成從 `VAR < TO` 改為 `VAR <= TO`；同時在 `extractFields()` 中，解析 `for (int i = 0; i <= 9; i++)` 時正確提取 `TO = 9`

**Rationale**: 只需修改兩處：
1. 生成：`for (int ${VAR} = ${FROM}; ${VAR} <= ${TO}; ${VAR}++)`
2. 解析：`isCountingFor()` 和 `extractFields()` 中識別 `<=` 運算符，提取右運算元作為 TO

**影響範圍**：
- `adapter.ts` 生成和解析
- 所有涉及 `u_count_loop` 的測試（需將預期輸出從 `<` 改為 `<=`）

## R-007: localStorage 舊版資料歸零策略

**Decision**: 在 `App.ts` 的 `loadState()` 中，載入 workspace 時若反序列化失敗或偵測到無效積木類型，直接 `localStorage.removeItem()` 並回傳空 workspace

**Rationale**: 已有 `migrateWorkspaceState()` 處理 migration 的先例。但本次更簡單——不遷移，直接清空。Blockly 的 `serialization.workspaces.load()` 在遇到未註冊的 block type 時會拋出錯誤，可用 try-catch 捕獲後清空。

**Alternatives considered**:
- 逐一檢查每個 block type 是否仍存在：複雜度不必要，直接 try-catch 更簡單
