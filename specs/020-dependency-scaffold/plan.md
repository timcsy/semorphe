# Implementation Plan: DependencyResolver 抽象 + Program Scaffold

**Branch**: `020-dependency-scaffold` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-dependency-scaffold/spec.md`

## Summary

將 C++ 專用的 ModuleRegistry + computeAutoIncludes 泛化為語言無關的 DependencyResolver 介面，建立 ProgramScaffold 層統一管理程式基礎設施 boilerplate（imports、preamble、entryPoint、epilogue），並在 Monaco 編輯器中實現 Ghost Line 視覺呈現。

**重要發現**：目前系統**不會**產生 `int main() { ... }` 或 `return 0;`。Program generator 直接渲染語句序列。ProgramScaffold 需要**新增**此功能，而非重構現有硬編碼。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor 0.52.2, Vite 7.3.1
**Storage**: N/A（記憶體中）
**Testing**: Vitest
**Target Platform**: 瀏覽器（Vite dev server）
**Project Type**: Web application（教學用積木程式編輯器）
**Performance Goals**: 同步延遲 < 100ms（現有水準）
**Constraints**: 零 regression（所有現有測試必須通過）
**Scale/Scope**: 單語言（C++），~50 個 concept，~30 個 std header

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 備註 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | DependencyResolver 介面取代現有 moduleRegistry 型別，不新增複雜度；ProgramScaffold 是新功能但有明確當前需求（Ghost Line + 認知等級） |
| II. 測試驅動開發 | ✅ PASS | 每個 User Story 有獨立測試標準；現有 auto-include 測試作為 regression guard |
| III. Git 紀律 | ✅ PASS | 每個 User Story 完成後 commit |
| IV. 規格文件保護 | ✅ PASS | 不修改 specs/ 或 .specify/ 下的文件 |
| V. 繁體中文優先 | ✅ PASS | 規格與計畫文件以繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/020-dependency-scaffold/
├── spec.md              # 功能規格
├── plan.md              # 本文件
├── research.md          # Phase 0 研究結果
├── data-model.md        # 資料模型
├── quickstart.md        # 快速驗證指南
├── contracts/           # 介面契約
│   ├── dependency-resolver.md
│   └── program-scaffold.md
├── checklists/
│   └── requirements.md  # 規格品質檢查表
└── tasks.md             # 任務清單（/speckit.tasks 產出）
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── types.ts                          # 現有 SemanticNode 等型別
│   ├── cognitive-levels.ts               # 現有認知等級定義
│   ├── dependency-resolver.ts            # 【新增】DependencyResolver 介面
│   ├── program-scaffold.ts               # 【新增】ProgramScaffold 介面
│   └── projection/
│       └── code-generator.ts             # 【修改】消費 DependencyResolver + ProgramScaffold
├── languages/cpp/
│   ├── std/
│   │   ├── module-registry.ts            # 【修改】實作 DependencyResolver 介面，移除 getRequiredHeaders
│   │   └── index.ts                      # 【修改】匯出 DependencyResolver 實作
│   ├── cpp-scaffold.ts                   # 【新增】C++ ProgramScaffold 實作
│   ├── auto-include.ts                   # 【修改】使用 DependencyResolver 介面
│   └── core/generators/
│       └── statements.ts                 # 【修改】消費 ProgramScaffold
├── ui/
│   ├── panels/
│   │   └── monaco-panel.ts               # 【修改】Ghost Line 裝飾 + tooltip
│   ├── app.ts                            # 【修改】接線 DependencyResolver + ProgramScaffold
│   └── style.css                         # 【修改】Ghost Line CSS
tests/
├── unit/
│   ├── core/
│   │   ├── dependency-resolver.test.ts   # 【新增】介面契約測試
│   │   └── program-scaffold.test.ts      # 【新增】介面契約測試
│   └── languages/cpp/
│       ├── module-registry.test.ts       # 【修改】驗證 DependencyResolver 實作
│       └── cpp-scaffold.test.ts          # 【新增】C++ Scaffold 測試
├── integration/
│   └── scaffold-codegen.test.ts          # 【新增】端到端 scaffold + codegen 測試
```

**Structure Decision**: 延續現有 `src/core/` + `src/languages/cpp/` 分層，核心介面定義在 `src/core/`，語言實作在 `src/languages/cpp/`。

## Complexity Tracking

無違反事項。DependencyResolver 介面取代現有 `moduleRegistry` 型別定義（非新增抽象層），`getRequiredHeaders` 移除不保留向後相容。ProgramScaffold 是滿足認知等級 P4 需求的最小設計。
