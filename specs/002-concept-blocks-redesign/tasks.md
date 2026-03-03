# Tasks: 概念式積木系統重新設計

**Input**: Design documents from `/specs/002-concept-blocks-redesign/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 依據 Constitution 的「測試驅動開發」原則，每階段先寫測試再實作。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 更新核心型別定義與建立共用積木 JSON

- [X] T001 Update core types: add `language` field to BlockSpec, add LanguageModule/LanguageAdapter/SourceMapping/CodeTemplate/AstPattern interfaces in `src/core/types.ts`
- [X] T002 [P] Create 21 universal block definitions (u_var_declare, u_var_assign, u_var_ref, u_number, u_string, u_arithmetic, u_compare, u_logic, u_logic_not, u_if, u_if_else, u_count_loop, u_while_loop, u_break, u_continue, u_func_def, u_func_call, u_return, u_print, u_input, u_array_declare, u_array_access) in `src/blocks/universal.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 基礎架構更新——Registry 語言過濾、LanguageAdapter 骨架、C++ 積木重組

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Unit tests for updated BlockSpec type validation (language field, universal vs language-specific) and new interface contracts in `tests/unit/types.test.ts`
- [X] T004 [P] Reorganize C++ block JSON files: split existing blocks into `special.json` (三段式 for, do-while, switch), `advanced.json` (STL, class, template), and new `io.json` (printf/scanf, cout/cin) in `src/languages/cpp/blocks/`
- [X] T005 Update BlockRegistry to support `language` field filtering: `getByLanguage(lang)` returns `universal` + matching language blocks, update `registerFromJSON` to validate language field in `src/core/block-registry.ts`
- [X] T006 Unit tests for BlockRegistry language filtering (universal-only, cpp-filtered, unknown language returns universal-only) in `tests/unit/block-registry.test.ts`
- [X] T007 [P] Create CppLanguageAdapter implementing LanguageAdapter interface with method stubs (matchNodeToBlock, extractFields, generateCode) in `src/languages/cpp/adapter.ts`
- [X] T008 Create CppLanguageModule implementing LanguageModule interface (wire getParser→CppParser, getGenerator→CppGenerator, getAdapter→CppAdapter, getBlockSpecs→load cpp blocks) in `src/languages/cpp/module.ts`

**Checkpoint**: Foundation ready - BlockRegistry supports language filtering, CppLanguageModule wired up, user story implementation can begin

---

## Phase 3: User Story 1 - 學生透過概念積木理解程式碼結構 (Priority: P1) 🎯 MVP

**Goal**: C++ 程式碼 → 概念式積木轉換 + 雙向對照高亮。學生貼上程式碼後看到自然語言積木，點選可互相高亮。

**Independent Test**: 貼上一段含 for/if/cin/cout 的 C++ 程式碼，驗證 Blockly 顯示概念積木（如「重複：i 從 0 到 9」）而非語法積木，且點選積木可高亮對應程式碼行。

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US1] Integration tests for CppAdapter.matchNodeToBlock: verify for_statement→u_count_loop, if_statement→u_if/u_if_else, declaration→u_var_declare, expression_statement(cout)→u_print, etc. in `tests/integration/cpp-adapter.test.ts`
- [X] T010 [P] [US1] Integration tests for CppAdapter.extractFields: verify field extraction for each universal block type (VAR/FROM/TO for u_count_loop, COND/BODY for u_if, etc.) in `tests/integration/cpp-adapter.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement matchNodeToBlock in CppLanguageAdapter: map AST node types to universal block IDs (for_statement counting→u_count_loop, if_statement→u_if/u_if_else, declaration→u_var_declare, etc.), return null for unmappable nodes in `src/languages/cpp/adapter.ts`
- [X] T012 [US1] Implement extractFields in CppLanguageAdapter: extract tree-sitter node fields into block fields/inputs for all 21 universal block types in `src/languages/cpp/adapter.ts`
- [X] T013 [US1] Refactor CodeToBlocksConverter to delegate AST→block mapping to LanguageAdapter instead of hardcoded switch/case: use adapter.matchNodeToBlock() then adapter.extractFields() in `src/core/code-to-blocks.ts`
- [X] T014 [US1] Generate SourceMapping[] during code-to-blocks conversion: record {blockId, startLine, endLine} from tree-sitter node positions in `src/core/code-to-blocks.ts`
- [X] T015 [US1] Update SyncController to carry SourceMapping[] alongside workspace JSON, expose mapping for highlight events in `src/ui/sync-controller.ts`
- [X] T016 [P] [US1] Add line highlight API to CodeEditor: addHighlight(startLine, endLine)/clearHighlight() using CodeMirror decorations in `src/ui/code-editor.ts`
- [X] T017 [US1] Implement bidirectional highlight: Blockly block select → highlight code lines via SourceMapping; CodeMirror cursor change → highlight Blockly block via reverse SourceMapping lookup in `src/ui/sync-controller.ts`
- [X] T018 [US1] Integration test: full C++ code (with for/if/cin/cout) → concept blocks + verify SourceMapping correctness in `tests/integration/cpp-adapter.test.ts`

**Checkpoint**: US1 complete — C++ code converts to concept blocks with bidirectional highlight

---

## Phase 4: User Story 2 - 學生使用共用積木拖拉組合程式邏輯 (Priority: P2)

**Goal**: 學生從工具箱拖出概念積木組合邏輯，系統即時產生正確 C++ 程式碼。

**Independent Test**: 從工具箱拖出「建立變數」「重複」「輸出」積木組合一個印出 1-10 的程式，驗證產出正確 C++ 程式碼。

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T019 [P] [US2] Tests for CppAdapter.generateCode: verify each universal block ID generates correct C++ code (u_var_declare→`int x = 0;`, u_count_loop→`for(...)`, u_print→`cout<<...`, etc.) in `tests/integration/cpp-generator.test.ts`

### Implementation for User Story 2

- [X] T020 [US2] Implement generateCode for all 21 universal blocks in CppAdapter: map block ID + fields to C++ code strings (handle indentation, semicolons, includes) in `src/languages/cpp/adapter.ts`
- [X] T021 [US2] Refactor CppGenerator to route universal blocks through CppAdapter.generateCode(), keep codeTemplate substitution for language-specific blocks in `src/languages/cpp/generator.ts`
- [X] T022 [US2] Update blockly-editor toolbox with concept categories (資料/流程控制/函式/輸入輸出/運算/陣列) using universal block colours (330/40/60/180/210/260) in `src/ui/blockly-editor.ts`
- [X] T023 [US2] Integration test: concept blocks → C++ code → concept blocks roundtrip verification in `tests/integration/cpp-generator.test.ts`

**Checkpoint**: US1 + US2 complete — bidirectional sync with concept blocks works end-to-end

---

## Phase 5: User Story 3 - 共用積木支援多語言程式碼生成 (Priority: P3)

**Goal**: 架構上支援多語言——LanguageModule 注入、語言切換 UI、工具箱按語言過濾。

**Independent Test**: 在 C++ 模式下驗證工具箱顯示 universal + C++ 積木；架構上驗證新增語言模組不需修改核心程式碼。

### Tests for User Story 3 ⚠️

- [X] T024 [P] [US3] Tests for LanguageModule injection: verify Converter uses injected module's adapter/parser/generator in `tests/integration/sync.test.ts`

### Implementation for User Story 3

- [X] T025 [US3] Update App.ts to accept LanguageModule, wire Converter with module's parser/generator/adapter, pass languageId to BlockRegistry in `src/ui/App.ts`
- [X] T026 [US3] Implement toolbox filtering in blockly-editor: show only universal + current language blocks, rebuild toolbox on language change in `src/ui/blockly-editor.ts`
- [X] T027 [US3] Update Converter to inject LanguageModule: use module.getAdapter() for code-to-blocks, module.getGenerator() for blocks-to-code in `src/core/converter.ts`
- [X] T028 [US3] Integration test: verify adding a language module requires no changes to universal blocks or core converter in `tests/integration/sync.test.ts`

**Checkpoint**: US1 + US2 + US3 complete — multi-language architecture in place, C++ fully working

---

## Phase 6: User Story 4 - 語言特殊積木處理獨有概念 (Priority: P4)

**Goal**: C++ 特殊積木（三段式 for、指標、printf/scanf、struct、namespace、do-while、switch）完整整合。

**Independent Test**: 貼上含指標操作和 printf 的 C++ 程式碼，驗證以語言特殊積木呈現且標籤為自然語言概念描述。

### Tests for User Story 4 ⚠️

- [X] T029 [P] [US4] Tests for C++ special block conversion: 三段式 for (non-counting)→cpp_for_3part, do-while→cpp_do_while, switch→cpp_switch, printf→cpp_printf, pointer→cpp_pointer_deref in `tests/integration/cpp-adapter.test.ts`

### Implementation for User Story 4

- [X] T030 [US4] Implement special block matchNodeToBlock in CppAdapter: for non-counting for_statement→cpp_for_3part, do_statement→cpp_do_while, switch_statement→cpp_switch in `src/languages/cpp/adapter.ts`
- [X] T031 [US4] Implement special block extractFields in CppAdapter: extract fields for all C++ special blocks (INIT/COND/UPDATE for 三段式 for, FORMAT/ARGS for printf, etc.) in `src/languages/cpp/adapter.ts`
- [X] T032 [US4] Verify special block generateCode uses codeTemplate substitution (already handled by T021 CppGenerator refactor) in `src/languages/cpp/generator.ts`
- [X] T033 [US4] Integration test: mixed universal + special blocks roundtrip (e.g., for loop with pointer inside) in `tests/diagnostic/conversion-check.test.ts`

**Checkpoint**: All user stories complete — full concept-based block system working for C++

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 更新既有測試、驗證效能、確保品質

- [X] T034 Update all existing tests that reference old block IDs or formats to use new universal/language-specific system in `tests/`
- [X] T035 Run quickstart.md validation: test all 10 implementation steps are working correctly
- [X] T036 Performance verification: confirm blocks→code sync < 1s and code→blocks sync < 2s
- [X] T037 Verify edge cases: unrecognized syntax → raw code block, mixed universal + special blocks, counting vs non-counting for-loop detection

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 types must be done first)
- **US1 (Phase 3)**: Depends on Foundational phase (T005 registry + T007 adapter + T008 module)
- **US2 (Phase 4)**: Depends on US1 (T012 adapter extractFields must exist; T013 converter refactor)
- **US3 (Phase 5)**: Depends on US2 (T021 generator refactor; T022 toolbox)
- **US4 (Phase 6)**: Depends on US1 adapter framework (T011-T013) but can start in parallel with US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — core code→blocks pipeline
- **User Story 2 (P2)**: Depends on US1 (shares CppAdapter; uses same converter) — core blocks→code pipeline
- **User Story 3 (P3)**: Depends on US2 (language module wires both directions) — architecture generalization
- **User Story 4 (P4)**: Depends on US1 adapter framework — can start after T013, parallel with US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Adapter logic before converter integration
- Core implementation before UI changes
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T004 and T007 can run in parallel (different files, no dependency)
- T009 and T010 can run in parallel (same file but independent test sections)
- T016 can run in parallel with T014-T015 (different file: code-editor.ts vs sync-controller.ts)
- US4 (Phase 6) can run in parallel with US3 (Phase 5) since US4 only depends on US1's adapter framework

---

## Parallel Example: User Story 1

```bash
# Launch tests first (parallel):
Task T009: "Integration tests for matchNodeToBlock in tests/integration/cpp-adapter.test.ts"
Task T010: "Integration tests for extractFields in tests/integration/cpp-adapter.test.ts"

# Then implement adapter (sequential - same file):
Task T011: "Implement matchNodeToBlock in src/languages/cpp/adapter.ts"
Task T012: "Implement extractFields in src/languages/cpp/adapter.ts"

# Then converter + UI (T016 parallel with T014-T015):
Task T013: "Refactor CodeToBlocksConverter in src/core/code-to-blocks.ts"
Task T014: "Generate SourceMapping in src/core/code-to-blocks.ts"
Task T015: "Update SyncController in src/ui/sync-controller.ts"
Task T016: "Add line highlight API in src/ui/code-editor.ts"  # [P] with T014-T015
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types + universal.json)
2. Complete Phase 2: Foundational (registry + adapter skeleton + module)
3. Complete Phase 3: User Story 1 (code→blocks + bidirectional highlight)
4. **STOP and VALIDATE**: Paste C++ code, verify concept blocks appear with natural language labels
5. Demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 → Test code→blocks conversion → Demo (MVP!)
3. Add US2 → Test blocks→code generation → Demo (full bidirectional sync)
4. Add US3 → Test language architecture → Demo (multi-language ready)
5. Add US4 → Test special blocks → Demo (complete C++ support)
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- 共用積木 ID 前綴 `u_`，C++ 特殊積木前綴 `cpp_`
- 共用積木不含 codeTemplate/astPattern，由語言 Adapter 提供映射
- 積木標籤使用繁體中文自然語言，數學符號可直接顯示
