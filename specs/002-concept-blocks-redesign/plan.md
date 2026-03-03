# Implementation Plan: 概念式積木系統重新設計

**Branch**: `002-concept-blocks-redesign` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-concept-blocks-redesign/spec.md`

## Summary

重新設計積木系統，使積木表達「概念」而非「語法」。積木以自然語言（繁體中文）描述程式概念，與右側 CodeMirror 的真實程式碼形成對照，讓學生同時建立概念理解和語法認識。

核心架構變更：將積木定義分為與語言無關的共用積木（21 塊）和語言特殊積木，引入 LanguageModule/LanguageAdapter 介面解耦語言相依性，使同一套共用積木可以產生不同語言的程式碼。完全取代 001 的積木定義和轉換層，Web UI 架構維持不變。新增雙向對照高亮功能。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.x, web-tree-sitter 0.26.x, CodeMirror 6.x
**Storage**: localStorage（瀏覽器本地）
**Testing**: Vitest
**Target Platform**: 現代瀏覽器（WASM 支援）
**Project Type**: Web application（單頁應用）
**Performance Goals**: 積木同步 < 1s、程式碼同步 < 2s
**Constraints**: 無伺服器端、純前端、離線可用
**Scale/Scope**: APCS/競賽程式設計學生、初期僅 C/C++ 語言模組

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. 簡約優先 | PASS | 共用積木僅 21 塊，不為 Python/Java 預先實作，僅預留介面 |
| II. 測試驅動開發 | PASS | 每階段先寫測試再實作 |
| III. Git 紀律 | PASS | 每個 task 完成後 commit |
| IV. 規格文件保護 | PASS | 不覆蓋 specs/ 下的既有文件 |
| V. 繁體中文優先 | PASS | 規格、積木標籤使用繁體中文；程式碼用英文 |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. 簡約優先 | PASS | LanguageAdapter 介面精簡（3 個方法）。不引入多餘的抽象層。共用積木不帶 codeTemplate，由各語言 Generator 直接處理。 |
| II. 測試驅動開發 | PASS | 測試策略：先測共用積木 JSON 格式 → 再測 Registry 過濾 → 再測 Adapter 映射 → 最後測 roundtrip |
| III. Git 紀律 | PASS | 每個功能模組完成後 commit |
| IV. 規格文件保護 | PASS | 不影響既有 specs/ 文件 |
| V. 繁體中文優先 | PASS | 積木 message 全部使用繁體中文 |

## Project Structure

### Documentation (this feature)

```text
specs/002-concept-blocks-redesign/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: data model
├── quickstart.md        # Phase 1: quickstart guide
├── contracts/
│   ├── module-interfaces.md   # Module interface contracts
│   └── block-spec-schema.md   # Block definition schema
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── core/                          # 語言無關的核心邏輯
│   ├── types.ts                   # 核心型別（修改：加 language, 新增介面）
│   ├── block-registry.ts          # 積木註冊表（修改：language 過濾）
│   ├── code-to-blocks.ts          # AST → 積木（修改：使用 LanguageAdapter）
│   └── converter.ts               # 轉換協調器（修改：注入 LanguageModule）
│
├── blocks/                        # 共用積木定義（新增目錄）
│   └── universal.json             # 21 塊共用積木
│
├── languages/
│   └── cpp/                       # C/C++ 語言模組
│       ├── module.ts              # 新增：CppLanguageModule
│       ├── adapter.ts             # 新增：CppLanguageAdapter
│       ├── generator.ts           # 修改：支援共用積木
│       ├── parser.ts              # 不變
│       └── blocks/
│           ├── special.json       # 三段式 for、do-while、switch 等
│           ├── advanced.json      # STL、class、template 等
│           └── io.json            # printf/scanf、cout/cin 等
│
├── ui/
│   ├── App.ts                     # 修改：語言模組注入
│   ├── blockly-editor.ts          # 修改：語言過濾工具箱
│   ├── code-editor.ts             # 修改：行高亮 API
│   ├── sync-controller.ts         # 修改：SourceMapping
│   └── storage.ts                 # 不變
│
└── main.ts                        # 不變

tests/
├── unit/
│   ├── block-registry.test.ts     # 修改：language 過濾測試
│   ├── cpp-generator.test.ts      # 修改：共用積木生成
│   ├── types.test.ts              # 修改：新型別驗證
│   └── sync-controller.test.ts    # 修改：SourceMapping
├── integration/
│   ├── cpp-adapter.test.ts        # 新增：C++ Adapter 測試
│   ├── cpp-generator.test.ts      # 修改：roundtrip 測試
│   ├── block-registry-integration.test.ts  # 修改
│   └── sync.test.ts               # 修改
└── diagnostic/
    └── conversion-check.test.ts   # 修改：概念積木驗證
```

**Structure Decision**: 沿用現有單專案結構，新增 `src/blocks/` 目錄放共用積木 JSON，C++ 語言模組保持在 `src/languages/cpp/` 下。主要變更是新增 `adapter.ts`、`module.ts` 和重組積木 JSON 檔案。

## Complexity Tracking

> 無違反需要記錄。
