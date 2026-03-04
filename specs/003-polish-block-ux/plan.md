# Implementation Plan: 積木系統認知負荷改善

**Branch**: `003-polish-block-ux` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-polish-block-ux/spec.md`

## Summary

全面改善積木系統的 UX 品質，包括：清理工具箱（移除 8 個重複的 C++ 積木定義）、將積木標籤改為自然語言、將函式定義/呼叫/讀取輸入改為動態積木、讓變數宣告支援有/無初始值切換、修正計數迴圈為包含端點語意。技術上主要修改 JSON 積木定義、`blockly-editor.ts` 動態積木註冊、`adapter.ts` 雙向轉換邏輯、以及 `generator.ts` 程式碼生成。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2
**Storage**: localStorage（瀏覽器本地）
**Testing**: Vitest（unit + integration）
**Target Platform**: 瀏覽器（Vite 開發伺服器 + 靜態部署）
**Project Type**: web-app（單頁應用：Blockly 積木編輯器 + CodeMirror 程式碼編輯器）
**Performance Goals**: code-to-blocks 轉換 < 500ms（已達成，本次不影響）
**Constraints**: 積木數量 ≤ 35 個（SC-001）；所有標籤使用繁體中文自然語言
**Scale/Scope**: 單一使用者本地使用；~65 積木降至 ~35 個

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 本次是簡化（刪除積木、清理工具箱），不新增不必要的抽象 |
| II. 測試驅動開發 | ✅ PASS | 每個 User Story 有明確的 Acceptance Scenarios，將以 TDD 流程實作 |
| III. Git 紀律 | ✅ PASS | 按 task 分組 commit |
| IV. 規格文件保護 | ✅ PASS | 不修改 specs/ 和 .specify/ 目錄 |
| V. 繁體中文優先 | ✅ PASS | 標籤全部改為繁體中文自然語言 |

無違規項目，不需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/003-polish-block-ux/
├── plan.md              # 本文件
├── spec.md              # 已完成（含 Clarifications）
├── research.md          # Phase 0 產出
├── data-model.md        # Phase 1 產出
└── tasks.md             # Phase 2 產出（由 /speckit.tasks 建立）
```

### Source Code (repository root)

```text
src/
├── blocks/
│   └── universal.json           # [修改] 更新 20 個共用積木的標籤和欄位定義
├── core/
│   ├── types.ts                 # [不變] BlockSpec 型別系統
│   ├── block-registry.ts        # [微調] 可能調整 toolbox 分類
│   ├── code-to-blocks.ts        # [微調] 確保降級邏輯正確
│   └── converter.ts             # [不變]
├── languages/cpp/
│   ├── adapter.ts               # [修改] 更新雙向轉換映射（移除已刪積木的映射、新增動態積木的欄位提取）
│   ├── generator.ts             # [修改] 更新程式碼生成（動態積木、包含端點迴圈）
│   ├── module.ts                # [不變]
│   ├── parser.ts                # [不變]
│   └── blocks/
│       ├── basic.json           # [修改] 移除 c_number, c_variable_ref, c_binary_op, c_var_declare_init_expr
│       ├── advanced.json        # [修改] 移除 c_string_literal, cpp_cout, cpp_cin, cpp_endl
│       └── special.json         # [不變]
└── ui/
    ├── App.ts                   # [微調] 舊 workspace 歸零邏輯
    ├── blockly-editor.ts        # [大幅修改] 新增動態積木（u_func_def, u_func_call, u_input）、修改 u_var_declare
    ├── code-editor.ts           # [不變]
    ├── storage.ts               # [不變]
    └── sync-controller.ts       # [不變]

tests/
├── unit/
│   ├── block-registry.test.ts   # [更新] 移除已刪積木的測試
│   ├── cpp-generator.test.ts    # [更新] 動態積木、包含端點迴圈
│   ├── types.test.ts            # [不變]
│   └── sync-controller.test.ts  # [不變]
└── integration/
    ├── block-registry-integration.test.ts  # [更新] 工具箱積木計數
    ├── code-to-blocks.test.ts              # [更新] 降級邏輯
    ├── cpp-adapter.test.ts                 # [更新] 動態積木欄位提取
    ├── cpp-generator.test.ts               # [更新] 動態積木程式碼生成
    └── sync.test.ts                        # [更新] 雙向轉換
```

**Structure Decision**: 維持現有專案結構不變。所有修改在既有檔案中進行，不新增目錄或模組。

## Constitution Re-Check (Post-Design)

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 動態積木複用現有 `u_print` 模式，無新抽象層 |
| II. 測試驅動開發 | ✅ PASS | 每個變更都有對應的測試更新計畫 |
| III. Git 紀律 | ✅ PASS | 按 User Story 分組 commit |
| IV. 規格文件保護 | ✅ PASS | 不動 specs/ 和 .specify/ |
| V. 繁體中文優先 | ✅ PASS | 所有新標籤均為繁體中文 |

## Generated Artifacts

| 文件 | 路徑 | 狀態 |
|------|------|------|
| plan.md | `specs/003-polish-block-ux/plan.md` | ✅ 完成 |
| research.md | `specs/003-polish-block-ux/research.md` | ✅ 完成 |
| data-model.md | `specs/003-polish-block-ux/data-model.md` | ✅ 完成 |
| contracts/ | N/A | 跳過（純本地 web app，無外部介面） |
| quickstart.md | N/A | 跳過（既有專案，已有開發環境） |
