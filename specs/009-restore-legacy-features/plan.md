# Implementation Plan: 整合舊版已驗證功能至新架構

**Branch**: `009-restore-legacy-features` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-restore-legacy-features/spec.md`

## Summary

將舊版 code-blockly 中已驗證的功能（程式執行、Console/變數面板、雙向高亮、進階積木互動、輔助功能）整合到新的語義樹架構中。核心策略：複用已存在的 interpreter 引擎和 step-controller，升級新版 placeholder panels，在 app.new.ts 中整合 UI 佈局和事件流。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, Monaco Editor, web-tree-sitter 0.26.6, Vite
**Storage**: localStorage（瀏覽器本地）
**Testing**: Vitest（目前 33 test files, 383 tests 全通過）
**Target Platform**: 現代瀏覽器（Chrome/Firefox/Safari），單頁應用
**Project Type**: Web application（教學用積木程式編輯器）
**Performance Goals**: 逐步執行回饋 <200ms，雙向高亮 <100ms，積木操作 <500ms
**Constraints**: 主執行緒執行（搭配 100,000 步上限防無窮迴圈），無後端伺服器
**Scale/Scope**: 單人使用，教學等級程式規模（<500 行）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | PASS | 所有功能都有明確的當前需求（舊版已驗證），不預留假設性擴充 |
| II. 測試驅動開發 | PASS | 將遵循 Red→Green→Refactor 流程，interpreter 已有 48 個測試 |
| III. Git 紀律 | PASS | 每個 User Story 為獨立可提交的里程碑 |
| IV. 規格文件保護 | PASS | 不修改 specs/ 和 .specify/ 下的規格文件 |
| V. 繁體中文優先 | PASS | 規格已用繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/009-restore-legacy-features/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── types.ts                    # SemanticNode, StylePreset 等核心型別
│   ├── semantic-tree.ts            # createNode 等建構函式
│   ├── projection/
│   │   ├── code-generator.ts       # 語義樹 → 程式碼（含 source mapping 擴充）
│   │   └── block-renderer.ts       # 語義樹 → Blockly 積木狀態
│   ├── lift/                       # AST → 語義樹
│   ├── cognitive-levels.ts         # L0/L1/L2 過濾
│   ├── block-spec-registry.ts      # 積木規格註冊
│   ├── storage.ts                  # localStorage 持久化
│   └── diagnostics.ts              # [新增] 積木診斷驗證
├── interpreter/
│   ├── interpreter.ts              # [已存在] SemanticInterpreter
│   ├── scope.ts                    # [已存在] 變數作用域
│   ├── io.ts                       # [已存在] stdin/stdout
│   ├── types.ts                    # [已存在] RuntimeValue, StepInfo 等
│   └── errors.ts                   # [已存在] RuntimeError
├── languages/cpp/
│   ├── generators/                 # C++ 程式碼生成器
│   ├── lifters/                    # C++ AST 提升器
│   ├── parser.ts                   # tree-sitter C++ 解析器
│   └── styles/                     # APCS/Competitive/Google presets
├── ui/
│   ├── app.new.ts                  # [修改] 主 App — 整合執行、面板、高亮
│   ├── sync-controller.ts          # [修改] 擴充 source mapping
│   ├── step-controller.ts          # [已存在] 逐步執行控制器
│   ├── panels/
│   │   ├── blockly-panel.ts        # [修改] 加入 onBlockSelect、highlightBlock
│   │   ├── monaco-panel.ts         # [修改] 加入 addHighlight、onCursorChange、斷點
│   │   ├── console-panel.ts        # [升級] 加入 input、status、collapse
│   │   └── variable-panel.ts       # [升級] 加入 scope groups、change highlight
│   ├── layout/
│   │   ├── split-pane.ts           # [已存在] 左右分割
│   │   ├── bottom-panel.ts         # [新增] 右側底部面板（分頁切換）
│   │   └── status-bar.ts           # [已存在]
│   └── toolbar/
│       ├── level-selector.ts       # [已存在]
│       ├── style-selector.ts       # [已存在]
│       ├── locale-selector.ts      # [已存在]
│       ├── quick-access-bar.ts     # [新增] 快速存取列
│       └── toast.ts                # [新增] Toast 通知
├── i18n/                           # 國際化
└── blocks/                         # 積木定義 JSON

tests/
├── unit/
│   ├── interpreter.test.ts         # [已存在] 48 tests
│   ├── ui/
│   │   ├── sync-controller.test.ts # [已存在]
│   │   ├── step-controller.test.ts # [新增]
│   │   ├── console-panel.test.ts   # [新增]
│   │   ├── variable-panel.test.ts  # [已存在] 6 tests
│   │   ├── bottom-panel.test.ts    # [新增]
│   │   └── quick-access.test.ts    # [新增]
│   └── core/
│       └── diagnostics.test.ts     # [新增]
├── integration/
│   ├── interpreter-integration.test.ts  # [已存在] 8 tests
│   ├── execution-flow.test.ts           # [新增] 完整執行流程
│   ├── source-mapping.test.ts           # [新增] 雙向高亮
│   └── block-mutations.test.ts          # [新增] else-if/var-ref/input
└── ...existing tests...
```

**Structure Decision**: 沿用既有單專案結構，新檔案放在對應的功能目錄中。不建立新的頂層目錄。

## Architecture Design

### US1: 程式執行流程

```
使用者點擊「執行」
  → [偵測未同步?] → 顯示同步提示對話
  → extractSemanticTree() → 語義樹
  → SemanticInterpreter.execute(tree, stdin)
     ├→ io.write() → ConsolePanel.log()
     ├→ io.read() → ConsolePanel.promptInput() → Promise<string>
     └→ scope updates → VariablePanel.update()
  → 完成/錯誤 → ConsolePanel.setStatus()
```

### US1: 逐步執行流程

```
使用者點擊「逐步」
  → SemanticInterpreter.executeWithSteps(tree) → StepInfo[]
  → StepController 管理步驟索引
     每步:
       → VariablePanel.updateFromSnapshot(step.scopeSnapshot)
       → BlocklyPanel.highlightBlock(step.blockId)
       → MonacoPanel.addHighlight(step.sourceRange)
       → ConsolePanel 更新到 step.outputLength
```

### US2: 雙向高亮

```
Source Mapping 建立:
  syncBlocksToCode() 時，code-generator 同時產生
  mapping: { blockId, startLine, endLine }[]

積木→程式碼高亮:
  BlocklyPanel.onBlockSelect(blockId)
  → 查找 mapping 中 blockId 對應的 lines
  → MonacoPanel.addHighlight(startLine, endLine)

程式碼→積木高亮:
  MonacoPanel.onCursorChange(lineNumber)
  → 查找 mapping 中包含 lineNumber 的 blockId
  → BlocklyPanel.highlightBlock(blockId)
```

### 右側面板佈局

```
┌─────────────────────────────┐
│ Monaco Editor (程式碼)        │
│                             │
├─────────────────────────────┤
│ [Console] [變數] ← 分頁標籤  │
│ ┌─────────────────────────┐ │
│ │ (active tab content)    │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

BottomPanel 元件管理分頁切換、收合/展開。高度可調整（拖曳分隔線）。

## Key Technical Decisions

1. **主執行緒執行**：教學場景程式碼量小，搭配 100,000 步上限足以防止無窮迴圈。避免 Web Worker 的序列化開銷和除錯複雜度。
2. **複用 SemanticInterpreter**：已有完善的 48 個測試，API 與新版語義樹 (SemanticNode) 相容。
3. **複用 StepController**：callback-based 架構乾淨，直接整合到新版 UI 事件流。
4. **升級 placeholder panels**：新版的 ConsolePanel 和 VariablePanel 已有基本骨架，在其上擴充 input/status/collapse/scope-groups 功能。
5. **Source Mapping 嵌入 code-generator**：在生成程式碼時同步產生 mapping，避免二次遍歷。

## Complexity Tracking

> 無 Constitution 違反，無需填寫。
