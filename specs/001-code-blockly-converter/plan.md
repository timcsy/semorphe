# Implementation Plan: 程式碼與 Blockly 積木雙向轉換工具

**Branch**: `001-code-blockly-converter` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-code-blockly-converter/spec.md`

## Summary

建立一個模組化的 Web 應用，讓使用者可以在 Blockly 積木與 C/C++ 程式碼之間雙向轉換。核心是一套積木定義規範（Block Spec JSON），系統透過 tree-sitter WASM 解析 C/C++ 程式碼的 CST，再依據積木定義映射為 Blockly 積木（反向亦然）。前端使用 Blockly 編輯器 + CodeMirror 6 程式碼編輯器，左右分割畫面即時同步。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.x, web-tree-sitter 0.26.x, CodeMirror 6.x
**Storage**: localStorage（自動儲存）+ 檔案匯出/匯入
**Testing**: Vitest + happy-dom
**Target Platform**: 現代瀏覽器（Chrome、Firefox、Safari、Edge）
**Project Type**: Web 應用（純前端，無後端）
**Performance Goals**: Block→Code < 1s, Code→Block < 2s
**Constraints**: 純前端，可離線使用（WASM 資源載入後），無伺服器依賴
**Scale/Scope**: 單使用者桌面瀏覽器使用

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
| ---- | ---- | ---- |
| I. 簡約優先 | ✅ 通過 | 僅實作 MVP 範圍（核心框架 + C/C++），不預留 Python/Arduino |
| II. 測試驅動開發 | ✅ 通過 | 使用 Vitest，TDD 流程將在 tasks 階段執行 |
| III. Git 紀律 | ✅ 通過 | 每個 task 完成後 commit |
| IV. 規格文件保護 | ✅ 通過 | Vite 腳手架不會影響 specs/ 和 .specify/ 目錄 |
| V. 繁體中文優先 | ✅ 通過 | 所有文件以繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/001-code-blockly-converter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── block-spec-schema.md
│   └── module-interfaces.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/                    # 核心引擎（語言無關）
│   ├── block-registry.ts    # 積木註冊表
│   ├── converter.ts         # 轉換協調器
│   └── types.ts             # 共用型別定義（BlockSpec 等）
├── languages/               # 語言模組（可替換）
│   └── cpp/
│       ├── parser.ts        # C/C++ Parser（tree-sitter）
│       ├── generator.ts     # C/C++ Code Generator（Blockly）
│       └── blocks/          # 預設 C/C++ 積木定義 JSON
├── ui/                      # Web UI 層
│   ├── App.ts               # 主應用程式
│   ├── blockly-editor.ts    # Blockly 編輯器封裝
│   ├── code-editor.ts       # CodeMirror 編輯器封裝
│   ├── sync-controller.ts   # 雙向同步控制器
│   └── storage.ts           # localStorage + 匯出匯入
├── main.ts                  # 進入點
└── index.html               # HTML 入口

tests/
├── unit/
│   ├── block-registry.test.ts
│   ├── converter.test.ts
│   └── types.test.ts
├── integration/
│   ├── cpp-parser.test.ts
│   ├── cpp-generator.test.ts
│   ├── roundtrip.test.ts
│   └── sync.test.ts
└── fixtures/                # 測試用積木定義和程式碼範例
    ├── block-specs/
    └── code-samples/
```

**Structure Decision**: 採用單一專案結構（純前端 Web 應用），以 `src/core/` 和 `src/languages/` 分離核心引擎與語言模組，確保模組化。`src/ui/` 負責 Web UI 層。

## Complexity Tracking

> 無違規項目，所有設計符合簡約原則。
