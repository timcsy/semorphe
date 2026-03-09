# Implementation Plan: Phase 2 — app.ts 拆分

**Branch**: `016-app-split` | **Date**: 2026-03-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-app-split/spec.md`

## Summary

將 3586 行的 god object `app.ts` 拆為三個獨立模組：ToolboxBuilder（純資料轉換）、BlockRegistrar（Blockly 動態積木註冊）、AppShell（DOM layout 管理），使 app.ts 只剩初始化膠水碼，目標 < 500 行。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite
**Storage**: localStorage（瀏覽器自動儲存）
**Testing**: Vitest
**Target Platform**: Web (瀏覽器)
**Project Type**: Web application (educational block-code IDE)
**Performance Goals**: 不退化（現有功能響應速度不變）
**Constraints**: app.ts < 500 行，每個新模組可獨立測試
**Scale/Scope**: 3586 行 → 3 個模組 + 瘦身 app.ts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 備註 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 三個模組直接對應 architecture-evolution.md Phase 2 checklist，無過度設計 |
| II. TDD | ✅ PASS | 每個模組先寫測試，驗證獨立可測 |
| III. Git 紀律 | ✅ PASS | 每個 US 完成後 commit |
| IV. 規格文件保護 | ✅ PASS | 不修改 specs/ 下的規格文件 |
| V. 繁體中文優先 | ✅ PASS | 規格和計畫文件使用繁體中文 |

## Project Structure

### Documentation (this feature)

```text
specs/016-app-split/
├── plan.md              # 本檔案
├── research.md          # Phase 0 研究
├── data-model.md        # Phase 1 資料模型
├── contracts/
│   └── module-interfaces.md  # 模組介面契約
└── quickstart.md        # 快速驗證指南
```

### Source Code (repository root)

```text
src/ui/
├── app.ts                    # 瘦身後 < 500 行：初始化膠水碼
├── toolbox-builder.ts        # US1：純資料 toolbox 建構器
├── block-registrar.ts        # US2：Blockly 動態積木註冊
├── app-shell.ts              # US3：DOM layout + toolbar + selectors

tests/unit/ui/
├── toolbox-builder.test.ts   # US1 單元測試
├── block-registrar.test.ts   # US2 單元測試
├── app-shell.test.ts         # US3 單元測試（DOM 結構驗證）
```

**Structure Decision**: 三個新模組放在 `src/ui/` 目錄下（與 app.ts 同級），測試放在對應的 `tests/unit/ui/` 目錄。

## app.ts 程式碼區段映射

根據逐行分析，app.ts 各區段歸屬如下：

### BlockRegistrar（~1960 行）
| 行範圍 | 內容 | 說明 |
|--------|------|------|
| L297-315 | `registerBlocksFromSpecs()` | JSON spec → Blockly.Blocks 註冊 |
| L322-336 | `createOpenDropdown()` | 開放式下拉選單工廠 |
| L338-2118 | `registerDynamicBlocks()` | 所有動態積木定義（u_var_declare, u_print, u_input, c_printf, c_scanf, u_if, u_while, u_count_loop, u_func_def, u_func_call, c_raw_code, c_comment_doc 等） |
| L3122-3191 | `getWorkspaceVarOptions()` | 從 workspace 收集變數選項 |
| L3194-3251 | `getScanfVarOptions()` | scanf 專用變數選項（含 & 前綴） |
| L3254-3277 | `getWorkspaceArrayOptions()` | 陣列名稱選項 |
| L3280-3303 | `getWorkspaceFuncOptions()` | 函式名稱選項 |

### ToolboxBuilder（~130 行）
| 行範圍 | 內容 | 說明 |
|--------|------|------|
| L2120-2246 | `buildToolbox()` | 完整的 toolbox 建構邏輯 |
| L2476-2482 | `updateToolboxForLevel()` | 層級切換時重建 toolbox |

### AppShell（~320 行）
| 行範圍 | 內容 | 說明 |
|--------|------|------|
| L119-234 | `init()` 中的 DOM 建構 | toolbar HTML、SplitPane、BottomPanel、面板容器 |
| L2383-2393 | `setupLevelSelector()` | 層級選擇器初始化 |
| L2396-2413 | `setupStyleSelector()` | 風格選擇器初始化 |
| L2415-2443 | `setupBlockStyleSelector()` | 積木風格選擇器初始化 |
| L2445-2458 | `setupLocaleSelector()` | 語言選擇器初始化 |
| L2460-2474 | 狀態欄位 + `updateStatusBar()` | UI 狀態管理 |
| L2484-2525 | `setupToolbar()` | 工具列按鈕事件 |
| L2527-2606 | `exportWorkspace()`, `importWorkspace()`, `uploadCustomBlocks()` | 匯出匯入功能 |

### app.ts 保留（~470 行估計）
| 行範圍 | 內容 | 說明 |
|--------|------|------|
| L1-96 | imports + 欄位 + constructor | 瘦身：改為 import 模組 |
| L98-295 | `init()` | 瘦身：呼叫模組方法代替 inline |
| L2248-2381 | `setupCodeToBlocksPipeline()` | 同步管線（跨模組接線） |
| L2608-2631 | `autoSave()`, `restoreState()` | 儲存/還原 |
| L2633-3021 | 執行邏輯 | handleRun/Step/Animate/Accelerate |
| L3023-3112 | 停止 + 逐步顯示 + 高亮 | 跨面板互動 |
| L3305-3343 | sync hints + autoSync | 同步狀態管理 |
| L3345-3394 | 執行重置 + 診斷 | |
| L3396-3586 | 執行 UI + 動畫 + dispose | |

> ⚠️ 保留行數約 470 行，需精簡部分邏輯才能確保 < 500。setupCodeToBlocksPipeline 中的 style conformance 回呼可移至 AppShell。

## Complexity Tracking

無違規。三個模組直接對應 architecture-evolution.md Phase 2 checklist。
