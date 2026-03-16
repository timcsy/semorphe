# Data Model: C++ 指標與參照積木 UX 重設計

## 影響的實體

### BlockSpec: `c_pointer_declare`（修改）

| 欄位 | 現行值 | 新值 |
|------|--------|------|
| `message0` | `%{BKY_C_POINTER_DECLARE_MSG0}` (2 args) | `%{BKY_C_POINTER_DECLARE_MSG0}` (3 args) |
| `args0` | `[TYPE dropdown, NAME field]` | `[TYPE dropdown, NAME field, INIT input_value]` |
| `tooltip` | （無或簡單） | `%{BKY_C_POINTER_DECLARE_TOOLTIP}` |
| `renderMapping.inputs` | `{}` | `{ "INIT": "initializer" }` |

### ConceptDef: `cpp_pointer_declare`（修改）

| 欄位 | 現行值 | 新值 |
|------|--------|------|
| `children` | `{}` | `{ "initializer": "expression" }` |

### i18n Labels（修改）

受影響的 i18n key：
- `C_POINTER_DECLARE_MSG0`、`C_POINTER_DECLARE_TOOLTIP`（新增）
- `C_POINTER_DEREF_MSG0`、`C_POINTER_DEREF_TOOLTIP`（新增）
- `C_ADDRESS_OF_MSG0`、`C_ADDRESS_OF_TOOLTIP`（新增）
- `C_POINTER_ASSIGN_MSG0`、`C_POINTER_ASSIGN_TOOLTIP`（新增）
- `C_REF_DECLARE_MSG0`、`C_REF_DECLARE_TOOLTIP`（新增）

### 不修改的實體

| 實體 | 原因 |
|------|------|
| Generator（declarations.ts） | 已支援 `initializer` children |
| Lifter（strategies.ts） | 已支援 pointer_declarator 的 value 欄位 |
| Executor（pointers.ts） | 已支援 `children.initializer` |
| Lift Patterns（lift-patterns.json） | address_of/pointer_deref 的 pattern 不受 BlockSpec 標籤影響 |

## 狀態轉換

無新增狀態轉換。指標宣告積木從「無初始化槽位」擴展為「有可選初始化槽位」，不改變概念的語義行為。
