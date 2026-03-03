# Data Model: 積木系統認知負荷改善

**Date**: 2026-03-03

## 實體變更摘要

本次不新增實體，僅修改現有積木定義和轉換邏輯。

## 積木定義變更（BlockSpec JSON）

### 要刪除的 C++ 積木（8 個）

從 `basic.json` 刪除：
- `c_number`（等價於 `u_number`）
- `c_variable_ref`（等價於 `u_var_ref`）
- `c_binary_op`（等價於 `u_arithmetic` / `u_compare` / `u_logic`）
- `c_var_declare_init_expr`（等價於 `u_var_declare`）

從 `advanced.json` 刪除：
- `c_string_literal`（等價於 `u_string`）
- `cpp_cout`（等價於 `u_print`）
- `cpp_cin`（等價於 `u_input`）
- `cpp_endl`（等價於 `u_endl`）

### 要修改的共用積木

#### u_compare — 標籤自然語言化
```
Before: options = [[">", ">"], ["<", "<"], [">=", ">="], ["<=", "<="], ["==", "=="], ["!=", "!="]]
After:  options = [["大於", ">"], ["小於", "<"], ["大於等於", ">="], ["小於等於", "<="], ["等於", "=="], ["不等於", "!="]]
```

#### u_arithmetic — 標籤自然語言化
```
Before: options = [["+", "+"], ["-", "-"], ["*", "*"], ["/", "/"], ["%%", "%"]]
After:  options = [["+", "+"], ["-", "-"], ["×", "*"], ["÷", "/"], ["餘數", "%"]]
```

#### u_array_access — 中性索引標籤
```
Before: message0 = "%1 的第 %2 個"
After:  message0 = "%1 [ %2 ]"
```

#### u_count_loop — 語意不變，生成邏輯改
```
JSON 定義不變（message0 仍為「重複：%1 從 %2 到 %3」）
adapter.ts 生成改為 VAR <= TO（包含端點）
adapter.ts 解析支援 <= 條件
```

#### u_var_declare — 轉為動態積木（Dropdown 切換）
```
Before: message0 = "建立 %1 變數 %2 = %3"
        args0 = [TYPE dropdown, NAME field_input, INIT value_input]

After:  改為 blockly-editor.ts 中手動定義的動態積木
        初始化狀態（無初始值）：「建立 TYPE 變數 NAME」
        切換為有初始值時：「建立 TYPE 變數 NAME = (value)」
        切換由 INIT_MODE dropdown 的 validator 控制
        saveExtraState: { initMode: "no_init" | "with_init" }
```

#### u_func_def — 轉為動態積木（加減參數）
```
Before: message0 = "定義函式 %1（%2）回傳 %3"
        args0 = [NAME field_input, PARAMS field_input, RETURN_TYPE dropdown]

After:  改為 blockly-editor.ts 中手動定義的動態積木
        基礎：「定義函式 NAME（）回傳 RETURN_TYPE」
        加參數後：「定義函式 NAME（TYPE0 PARAM0, TYPE1 PARAM1）回傳 RETURN_TYPE」
        TYPE_N: dropdown（int/float/double/char/bool/string/void/自訂）
        PARAM_N: field_input
        RETURN_TYPE: dropdown（同上 + void）
        saveExtraState: { paramCount, params: [{type, name}, ...] }
        BODY: statement_input
```

#### u_func_call — 轉為動態積木（加減引數）
```
Before: message0 = "呼叫 %1（%2）"
        args0 = [NAME field_input, ARGS field_input]

After:  改為 blockly-editor.ts 中手動定義的動態積木
        基礎：「呼叫 NAME（）」
        加引數後：「呼叫 NAME（ARG0, ARG1）」
        ARG_N: value_input（接受表達式積木）
        saveExtraState: { argCount }
```

#### u_input — 轉為動態積木（加減變數）
```
Before: message0 = "讀取輸入 → %1"
        args0 = [NAME field_input]

After:  改為 blockly-editor.ts 中手動定義的動態積木
        基礎：「讀取輸入 → NAME0」
        加變數後：「讀取輸入 → NAME0, NAME1, NAME2」
        NAME_N: field_input
        saveExtraState: { varCount }
```

## Adapter 映射變更

### CppLanguageAdapter.generateCode() 修改

| 積木 ID | Before | After |
|---------|--------|-------|
| `u_count_loop` | `for (int ${VAR} = ${FROM}; ${VAR} < ${TO}; ${VAR}++)` | `for (int ${VAR} = ${FROM}; ${VAR} <= ${TO}; ${VAR}++)` |
| `u_func_def` | 讀取 PARAMS field_input 原始文字 | 遍歷 PARAM0..PARAM_N、TYPE0..TYPE_N 動態 field |
| `u_func_call` | 讀取 ARGS field_input 原始文字 | 遍歷 ARG0..ARG_N 動態 value_input |
| `u_input` | 讀取 NAME field_input | 遍歷 NAME0..NAME_N 動態 field_input |

### CppLanguageAdapter.matchNodeToBlock() 修改

無變更——所有被刪的 C++ 積木已有對應的通用積木映射。

### CppLanguageAdapter.extractFields() 修改

| 積木 ID | 修改內容 |
|---------|----------|
| `u_count_loop` | 解析條件支援 `<=`（新增）和 `<`（保留向後相容） |
| `u_func_def` | 提取各參數的 type + name 為獨立的 TYPE_N / PARAM_N field |
| `u_func_call` | 提取各引數為獨立的 ARG_N value |
| `u_input` | 提取 `cin >> a >> b >> c` 中的多個變數為 NAME_N field |
| `u_var_declare` | 新增 INIT_MODE field 提取（根據有無初始值判斷） |

## Workspace 持久化

### saveExtraState 格式

```typescript
// u_var_declare
{ initMode: "no_init" | "with_init" }

// u_func_def
{ paramCount: number, params: Array<{ type: string, name: string }> }

// u_func_call
{ argCount: number }

// u_input
{ varCount: number }

// u_print（不變）
{ itemCount: number }
```

### localStorage 歸零邏輯

```
App.loadState() 中：
try {
  Blockly.serialization.workspaces.load(state, workspace)
} catch (e) {
  // 遇到未註冊 block type → 清除 localStorage，使用空 workspace
  localStorage.removeItem(STORAGE_KEY)
}
```
