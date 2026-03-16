# Implementation Plan: C++ 指標與參照積木 UX 重設計

**Branch**: `047-pointer-ref-ux` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/047-pointer-ref-ux/spec.md`

## Summary

重新設計 C++ 指標與參照的 Blockly 積木 UX，讓初學者能直覺理解和使用。主要變更：(1) 指標宣告積木新增可選初始化槽位，(2) 所有標籤改為描述式並附帶原始符號，(3) 參照積木使用「別名」語義，(4) 指標/參照積木增加視覺區分，(5) tooltip 提供教育性類比說明。

## Technical Context

**Language/Version**: TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite
**Primary Dependencies**: Blockly（積木渲染）, tree-sitter-cpp（AST 解析）, Vitest（測試）
**Storage**: localStorage（瀏覽器自動儲存）
**Testing**: Vitest（`npm test`）+ `npx tsc --noEmit`
**Target Platform**: 瀏覽器（現代 Chrome/Firefox/Safari）
**Project Type**: 教育用 Web 應用
**Performance Goals**: N/A（UX 變更，非效能相關）
**Constraints**: 向後相容——舊版積木序列化資料必須能自動遷移
**Scale/Scope**: 影響 ~11 個 BlockSpec 定義、對應的 i18n 標籤、generator/lifter 不變

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 僅修改現有積木的 UX（標籤、槽位、tooltip），不引入新抽象層 |
| II. 測試驅動開發 | ✅ PASS | 每項變更都有 round-trip 測試驗證 |
| III. Git 紀律 | ✅ PASS | 每個邏輯步驟完成後 commit |
| IV. 規格文件保護 | ✅ PASS | 不涉及 spec/plan 文件的刪除 |
| V. 繁體中文優先 | ✅ PASS | 所有文件以繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/047-pointer-ref-ux/
├── spec.md              # 功能規格
├── plan.md              # 本文件
├── research.md          # Phase 0 研究
├── data-model.md        # Phase 1 資料模型
└── checklists/
    └── requirements.md  # 規格品質檢查
```

### Source Code (repository root)

```text
src/
├── languages/cpp/core/
│   ├── blocks.json              # BlockSpec 修改（指標宣告加 INIT 槽位、標籤更新）
│   ├── concepts.json            # 概念定義更新（cpp_pointer_declare 加 children.initializer）
│   ├── generators/
│   │   └── declarations.ts      # 指標宣告 generator（已支援 initializer，不需改）
│   └── lifters/
│       └── strategies.ts        # 指標宣告 lifter（已支援 initializer，不需改）
├── interpreter/executors/
│   └── pointers.ts              # executor（已支援 initializer，不需改）
├── i18n/
│   ├── zh-TW/blocks.json        # 中文標籤更新（附帶原始符號）
│   └── en/blocks.json           # 英文標籤更新（附帶原始符號）
└── ui/                          # 可能涉及 toolbox 子分類渲染

tests/
├── integration/
│   ├── roundtrip-arrays-pointers.test.ts    # 既有測試（不應破壞）
│   └── roundtrip-cpp-reference-static.test.ts  # 既有測試
└── unit/
    └── languages/cpp/
        └── pointer-ref-ux.test.ts  # 新測試
```

**Structure Decision**: 不新增目錄，在現有結構內修改。主要變更集中在 `blocks.json` 和 i18n 檔案。

## Implementation Phases

### Phase A: BlockSpec 結構變更（P1 核心）

**目標**：修改指標宣告積木，新增可選初始化槽位。

**現狀分析**：
- `c_pointer_declare` BlockSpec 目前只有 TYPE（dropdown）和 NAME（field_input）
- **但** generator（`declarations.ts:184-199`）、lifter（`strategies.ts:46-58`）、executor（`pointers.ts:28-37`）都**已經支援** `initializer` children
- 這代表只需修改 BlockSpec JSON 和 renderMapping，不需動 TypeScript 程式碼

**變更**：
1. 在 `c_pointer_declare` 的 `args0` 新增 `input_value` 型別的 INIT 欄位
2. 更新 `renderMapping` 加入 `"inputs": { "INIT": "initializer" }`
3. 更新 `message0` i18n key 以容納新的 `%3` 佔位符
4. 更新 `concepts.json` 中 `cpp_pointer_declare` 的 `children` 加入 `initializer: "expression"`

### Phase B: i18n 標籤重設計

**目標**：所有指標/參照積木使用描述式標籤 + 括號內附原始符號。

**變更對照表**：

| Key | 現行 zh-TW | 新 zh-TW | 新 en |
|-----|-----------|---------|------|
| `C_POINTER_DECLARE_MSG0` | `建立 %1 指標變數 %2` | `建立 %1 指標變數 %2 初始值 %3 (*)` | `Create %1 pointer %2 init %3 (*)` |
| `C_POINTER_DEREF_MSG0` | `取出 %1 指向的值` | `取得 %1 指向的值 (*)` | `Get value pointed to by %1 (*)` |
| `C_ADDRESS_OF_MSG0` | `取得 %1 的位址` | `取得 %1 的位址 (&)` | `Address of %1 (&)` |
| `C_POINTER_ASSIGN_MSG0` | `把 %2 存到 %1 指向的位置` | `把 %2 存到 %1 指向的位置 (*=)` | `Store %2 at where %1 points to (*=)` |
| `C_REF_DECLARE_MSG0` | `宣告 %1 參考變數 %2 = %3` | `建立 %1 別名 %2 綁定 %3 (&)` | `Create %1 alias %2 bound to %3 (&)` |

**Tooltip 增強**（新增 TOOLTIP key）：

| Key | zh-TW | en |
|-----|-------|----|
| `C_POINTER_DECLARE_TOOLTIP` | `指標像是寫著地址的便條紙——它記錄另一個變數在記憶體中的位置。留空初始值會產生未初始化指標，可能導致程式崩潰。` | `A pointer is like a note with an address — it records where another variable lives in memory. Leaving init empty creates an uninitialized pointer, which may cause crashes.` |
| `C_POINTER_DEREF_TOOLTIP` | `解參照：跟著便條紙上的地址去找到那個變數的值。` | `Dereference: follow the address on the note to find the variable's value.` |
| `C_ADDRESS_OF_TOOLTIP` | `取址：把變數在記憶體中的地址寫到便條紙上。` | `Address-of: write down the variable's memory address on a note.` |
| `C_REF_DECLARE_TOOLTIP` | `參照是變數的別名（另一個名字），改變參照就是改變原本的變數。和指標不同，參照一旦綁定就不能改指向。` | `A reference is an alias (another name) for a variable. Changing the reference changes the original. Unlike pointers, references cannot be rebound.` |

### Phase C: 視覺區分

**目標**：指標積木和參照積木有明確的視覺區分。

**方案**：
- 目前指標在 `pointers` category，參照在 `data` category → **已經分開**
- 問題是它們在 topic tree 中被歸在同一層級節點（`L2b: 指標與記憶體`）
- **解決**：在 toolbox 中增加子分類標籤（Blockly 的 `<label>` 元素），在指標分類內用 label 分隔「指標操作」和「記憶體管理」

### Phase D: 向後相容遷移

**目標**：舊版 `c_pointer_declare` 積木（無 INIT 槽位）載入時自動相容。

**方案**：
- Blockly 的 `input_value` 天然支援可選——不連接任何積木時等同於空
- 舊版序列化的 `c_pointer_declare` 不含 INIT 輸入的資料，載入時 Blockly 會建立空的 INIT 輸入 → 自動相容
- 不需要額外的遷移邏輯

### Phase E: 測試驗證

**目標**：確保所有變更通過完整的驗證管線。

1. `npx tsc --noEmit` — 型別檢查
2. `npm test` — 不能破壞現有測試
3. 新增 round-trip 測試：
   - 指標宣告 + 初始化：`int* ptr = &x;`
   - 指標宣告空：`int* ptr;`
   - 參照宣告：`int& ref = x;`
   - 解參照 + 取址組合：`*ptr`、`&x`
4. 確認 i18n 標籤在積木渲染時正確顯示

## Risk Assessment

| 風險 | 可能性 | 影響 | 緩解 |
|------|--------|------|------|
| BlockSpec 修改破壞現有 lifter 的 AST 匹配 | 低 | 高 | lifter 使用 tree-sitter AST，不依賴 BlockSpec 結構 |
| 舊版積木序列化無法載入 | 低 | 高 | Blockly 的 input_value 天然支援可選；測試驗證 |
| i18n 標籤過長導致積木渲染溢出 | 中 | 低 | 測試不同視窗寬度的渲染效果 |
| 新增 INIT 槽位的 renderMapping 與 extractor 不一致 | 中 | 中 | 用 pattern-renderer 自動推導，測試 round-trip |

## Complexity Tracking

無 Constitution 違規，不需要此區段。
