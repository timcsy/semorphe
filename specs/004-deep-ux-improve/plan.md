# Implementation Plan: 積木系統 UX 深度改善（第二波）

**Branch**: `004-deep-ux-improve` | **Date**: 2026-03-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-deep-ux-improve/spec.md`

## Summary

為 APCS 初學者優化積木系統 UX：預設載入 C++ iostream 程式骨架、工具箱分初級/進階模式、變數引用改為 dropdown 選單、積木連接點加入型別檢查、常用積木快捷列、即時錯誤提示。所有功能建構在現有 Blockly 12.4.1 原生 API 之上（setCheck、FieldDropdown 函式生成器、setWarningText、serialization.blocks.append），不引入新依賴。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2
**Storage**: localStorage（瀏覽器本地）
**Testing**: Vitest
**Target Platform**: 現代瀏覽器（Chrome/Firefox/Edge）
**Project Type**: Web application（單頁應用）
**Performance Goals**: 即時錯誤檢查 < 500ms（含 300ms debounce）
**Constraints**: 無新依賴引入，所有功能使用 Blockly 原生 API
**Scale/Scope**: 67 個積木定義，初級模式顯示 18 個

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 所有功能使用 Blockly 原生 API，不引入新依賴或過度抽象 |
| II. 測試驅動開發 | ✅ PASS | 每個 User Story 可獨立測試，先寫測試再實作 |
| III. Git 紀律 | ✅ PASS | 每個 User Story 完成後 commit |
| IV. 規格文件保護 | ✅ PASS | 不修改 spec.md / plan.md / tasks.md |
| V. 繁體中文優先 | ✅ PASS | 規格和計畫文件皆以繁體中文撰寫 |

**Post-Phase 1 Re-check**: ✅ 所有原則持續通過。無新增依賴，無複雜抽象層。

## Project Structure

### Documentation (this feature)

```text
specs/004-deep-ux-improve/
├── plan.md              # 本檔案
├── research.md          # Phase 0: 技術研究
├── data-model.md        # Phase 1: 資料模型
├── quickstart.md        # Phase 1: 測試情境
├── checklists/          # 品質檢查清單
│   └── requirements.md
└── tasks.md             # Phase 2: 任務分解（/speckit.tasks 產出）
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── block-registry.ts      # [修改] 新增 toToolboxDef 過濾參數（beginner/advanced）
│   ├── code-to-blocks.ts
│   ├── converter.ts
│   └── types.ts               # [修改] 新增 ToolboxLevel 型別
├── ui/
│   ├── App.ts                 # [修改] 模板載入、清空按鈕、工具箱切換、快捷列、錯誤檢查
│   ├── blockly-editor.ts      # [修改] u_var_ref dropdown、連接型別、快捷列 API、warning API
│   ├── code-editor.ts
│   ├── sync-controller.ts
│   └── storage.ts             # [修改] 新增 toolbox level 持久化
├── blocks/
│   └── universal.json         # [修改] 加入 Statement/Expression 型別檢查
└── languages/cpp/
    ├── adapter.ts
    ├── generator.ts
    ├── parser.ts
    ├── module.ts
    └── blocks/
        ├── basic.json         # [修改] 加入 Statement/Expression 型別檢查
        ├── advanced.json      # [修改] 加入 Statement/Expression 型別檢查
        └── special.json       # [修改] 加入 Statement/Expression 型別檢查

index.html                     # [修改] 新增清空按鈕、模式切換按鈕、快捷列容器

tests/
├── unit/
│   └── block-registry.test.ts # [修改] 新增 toolbox 過濾測試
└── integration/
    └── ux-features.test.ts    # [新增] UX 功能整合測試
```

**Structure Decision**: 延續現有單一專案結構，所有變更集中在既有檔案中。新增一個整合測試檔案涵蓋所有 6 個 User Story。

## 實作策略

### US1: 預設程式骨架（P1）
- 在 `App.ts` 的 `restoreState()` 中，若 localStorage 無資料則載入預設模板 JSON
- 模板 JSON 定義為常數（c_include → c_using_namespace → u_func_def + u_return）
- 在 `index.html` 新增「清空」按鈕，呼叫 `workspace.clear()`

### US2: 工具箱分級（P1）
- 在 `types.ts` 新增 `ToolboxLevel` 型別
- 在 `block-registry.ts` 的 `toToolboxDef()` 新增 `level` 參數，beginner 模式只包含指定積木
- 在 `App.ts` 新增模式切換邏輯，呼叫 `workspace.updateToolbox()`
- 在 `storage.ts` 新增 toolbox level 持久化
- 在 `index.html` 新增切換按鈕

### US3: 變數 Dropdown（P2）
- 在 `blockly-editor.ts` 修改 u_var_ref 積木定義
- 使用 `FieldDropdown(generateOptions)` 函式生成器
- generateOptions 掃描 workspace 中所有 u_var_declare 和 u_count_loop
- 最後一個選項為「(自訂)」→ 顯示額外 FieldTextInput

### US4: 連接型別檢查（P2）
- 修改所有 JSON 積木定義：`"previousStatement": null` → `"previousStatement": "Statement"`
- 修改所有 JSON 積木定義：`"nextStatement": null` → `"nextStatement": "Statement"`
- 修改所有 statement input 的 check：加入 `"check": "Statement"`
- 修改動態積木（blockly-editor.ts）的 setPreviousStatement / setNextStatement

### US5: 快捷列（P3）
- 在 `index.html` 新增快捷列容器
- 在 `App.ts` 新增快捷列初始化和點擊處理
- 使用 `Blockly.serialization.blocks.append()` 在可見區域中央建立積木
- 累加偏移量避免重疊

### US6: 即時錯誤提示（P3）
- 在 `App.ts` 或 `blockly-editor.ts` 新增 workspace change listener
- 300ms debounce
- 檢查規則 1：非 void u_func_def 缺少 u_return → `setWarningText()`
- 檢查規則 2：u_var_ref 的 NAME 不在已宣告變數中 → `setWarningText()`

## Complexity Tracking

> 無 Constitution 違規，不需填寫。
