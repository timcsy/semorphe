# Implementation Plan: Concept 與 BlockDef 分離

**Branch**: `017-concept-blockdef-split` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-concept-blockdef-split/spec.md`

## Summary

將現有 BlockSpec JSON 的單一結構拆分為兩層：語意層（concepts.json）和投影層（block-specs.json），使 ConceptRegistry 可獨立於 Blockly 運作。同時建立語言套件 manifest 驅動載入機制，並用 dummy 唯讀視圖驗證解耦。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite 7.x
**Storage**: localStorage（瀏覽器自動儲存）+ JSON 檔案匯出匯入
**Testing**: Vitest
**Target Platform**: 瀏覽器（Web）
**Project Type**: 教育用積木程式 IDE（Web 應用）
**Performance Goals**: 無新增效能需求（純重構）
**Constraints**: 所有現有測試 1484+ 必須通過、app 啟動行為不變
**Scale/Scope**: 4 個 JSON 檔案（universal + cpp basic/advanced/special）需拆分

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ 通過 | 拆分是 architecture-evolution.md Phase 3 的明確需求，非假設性未來需求 |
| II. 測試驅動開發 | ✅ 通過 | 先寫測試驗證拆分正確性，再遷移 JSON |
| III. Git 紀律 | ✅ 通過 | 每個 user story 完成後 commit |
| IV. 規格文件保護 | ✅ 通過 | 不覆蓋 specs/ 或 .specify/ 下的既有檔案 |
| V. 繁體中文優先 | ✅ 通過 | 規格文件以繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/017-concept-blockdef-split/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── module-interfaces.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── concept-registry.ts      # 修改：新增 loadFromJSON() 方法
│   ├── block-spec-registry.ts   # 修改：從 block-specs.json 格式載入
│   └── types.ts                 # 修改：新增 ConceptDef JSON schema 型別
├── blocks/
│   ├── universal.json           # 保留（向下相容 adapter）
│   └── semantics/
│       └── universal-concepts.json  # 新增：universal 層 concept 定義
├── languages/
│   └── cpp/
│       ├── manifest.json            # 新增：語言套件 manifest
│       ├── semantics/
│       │   └── concepts.json        # 新增：C++ concept 定義（lang-core + lang-library）
│       ├── projections/
│       │   └── blocks/
│       │       ├── basic.json       # 新增：basic blockDef + renderMapping
│       │       ├── advanced.json    # 新增：advanced blockDef + renderMapping
│       │       └── special.json     # 新增：special blockDef + renderMapping
│       ├── blocks/                  # 保留（向下相容 adapter 或 phase 完成後移除）
│       │   ├── basic.json
│       │   ├── advanced.json
│       │   └── special.json
│       └── module.ts                # 修改：改用 manifest 驅動載入
└── views/
    └── semantic-tree-view.ts        # 新增：dummy 唯讀視圖

tests/
├── unit/
│   ├── core/
│   │   ├── concept-registry-load.test.ts  # 新增
│   │   └── block-spec-split.test.ts       # 新增
│   └── views/
│       └── semantic-tree-view.test.ts     # 新增
└── integration/
    └── manifest-loading.test.ts           # 新增
```

**Structure Decision**: 使用 `semantics/` 和 `projections/blocks/` 子目錄分層，與 architecture-evolution.md 的 Phase 3 設計一致。舊 JSON 檔案暫時保留作為 adapter 層，確保漸進遷移不中斷。

## Complexity Tracking

無 Constitution 違反，無需記錄。
