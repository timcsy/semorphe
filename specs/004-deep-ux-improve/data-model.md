# Data Model: 積木系統 UX 深度改善（第二波）

**Date**: 2026-03-04 | **Branch**: `004-deep-ux-improve`

## 實體定義

### ToolboxLevel

工具箱顯示層級設定。

| 欄位 | 型別 | 說明 |
|------|------|------|
| level | 'beginner' \| 'advanced' | 目前顯示模式 |

**持久化**: localStorage key `code-blockly-toolbox-level`
**預設值**: `'beginner'`

### BeginnerBlockList

初級模式允許顯示的積木 ID 清單（靜態常數）。

| 分類 | 積木 ID |
|------|---------|
| data | u_var_declare, u_var_assign, u_var_ref, u_number, u_string |
| operators | u_arithmetic, u_compare, u_logic |
| control | u_if, u_if_else, u_count_loop, u_while_loop |
| functions | u_func_def, u_func_call, u_return |
| io | u_print, u_input, u_endl |

**總計**: 18 個積木，6 個分類

### DefaultTemplate

首次開啟時預載的 workspace JSON 狀態。

**積木結構**:
```
c_include (HEADER: 'iostream')
  → next: c_using_namespace (NAMESPACE: 'std')
    → next: u_func_def (NAME: 'main', RETURN_TYPE: 'int')
      → BODY: u_return (VALUE: u_number(NUM: '0'))
```

### QuickAccessItem

快捷列項目定義。

| 欄位 | 型別 | 說明 |
|------|------|------|
| blockType | string | 積木類型 ID |
| label | string | 顯示標籤 |
| icon | string | SVG 圖示或 emoji |

**預設快捷列**:
| 積木 | 標籤 |
|------|------|
| u_var_declare | 變數 |
| u_print | 輸出 |
| u_input | 輸入 |
| u_if | 如果 |
| u_count_loop | 迴圈 |
| u_func_def | 函式 |

### ConnectionType

積木連接型別標籤。

| 型別 | 用途 |
|------|------|
| 'Statement' | 有 previousStatement/nextStatement 的積木（if、while、print 等） |
| 'Expression' | 有 output 的積木（數字、變數引用、運算等） |

**規則**:
- `previousStatement` / `nextStatement` → 值為 `"Statement"`
- `output` → 值為 `"Expression"`
- `input_value.check` → `"Expression"`
- `input_statement.check` → `"Statement"`

### WorkspaceDiagnostic

即時錯誤檢查結果。

| 欄位 | 型別 | 說明 |
|------|------|------|
| blockId | string | 相關積木的 ID |
| type | 'missing_return' \| 'undeclared_variable' | 錯誤類型 |
| message | string | 人類可讀的錯誤描述 |

## 關係

- **ToolboxLevel** 影響 **BlockRegistry.toToolboxDef()** 的過濾行為
- **DefaultTemplate** 只在無 localStorage 儲存狀態時使用
- **QuickAccessItem** 的積木必須已在 **BlockRegistry** 中註冊
- **ConnectionType** 標籤嵌入在所有積木 JSON 定義和動態積木程式碼中
- **WorkspaceDiagnostic** 由 workspace change listener 產生，映射到具體積木

## 狀態轉換

### 工具箱模式
```
beginner ←→ advanced （使用者切換按鈕）
```

### Workspace 初始化
```
無 localStorage → 載入 DefaultTemplate
有 localStorage → 載入儲存狀態
使用者按清空 → workspace 清空為空白
```
