# Tasks: 架構重構 — 四維分離與語義模型

**Input**: Design documents from `/specs/006-arch-four-dimensions/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/, quickstart.md

**Tests**: 本專案 constitution 要求 TDD（測試先於實作）。每個 User Story phase 包含測試任務。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup — 核心介面定義與目錄結構

**Purpose**: 建立所有新增介面的型別定義和目錄結構，不包含實作邏輯

- [X] T001 定義 SemanticNode、ConceptId（UniversalConcept + LanguageSpecificConcept）、SemanticModel、NodeMetadata、ProgramMetadata 型別，依照 contracts/semantic-model.ts 建立 `src/core/semantic-model.ts`
- [X] T002 [P] 定義新版 LanguageModule、TypeEntry、ConceptDefinition、Generator、Parser、LanguageAdapter、LanguageRegistry 介面，依照 contracts/language-module.ts 建立 `src/languages/types.ts`（保留舊介面在 src/core/types.ts 供漸進遷移）
- [X] T003 [P] 定義 CodingStyle、IoPreference、NamingConvention、BraceStyle、HeaderStyle、StylePresetId、StyleDetectionResult、StyleManager 介面，依照 contracts/coding-style.ts 建立 `src/languages/style.ts`
- [X] T004 [P] 建立 `src/i18n/` 目錄結構（zh-TW/、en/），定義 LocaleBundle 和 LocaleLoader 介面，依照 contracts/locale.ts 建立 `src/i18n/loader.ts`

**Checkpoint**: 所有型別定義完成，可被其他模組 import。尚無實作邏輯。

---

## Phase 2: User Story 4 - 語義模型顯式化 (Priority: P2, Foundational) 🎯 MVP

**Goal**: 建立獨立的 SemanticNode 樹作為程式的中間表示，重構雙向轉換流程為 Code ↔ SemanticModel ↔ Blocks

**Independent Test**: 所有現有 260+ 測試通過，且 round-trip 轉換 parse(generate(S)) ≡ S

**⚠️ CRITICAL**: 所有其他 User Story 依賴此 phase 完成

### Tests for User Story 4

- [X] T005 [US4] 撰寫 SemanticNode 工具函式測試（createNode、semanticEquals、walkNodes、serializeModel、deserializeModel），在 `tests/unit/semantic-model.test.ts`
- [X] T006 [P] [US4] 撰寫 ConceptRegistry 測試（註冊 universal 概念、註冊 language-specific 概念、查詢、列舉），在 `tests/unit/concept-registry.test.ts`

### Implementation for User Story 4

- [X] T007 [US4] 實作 SemanticModel 工具函式（createNode、semanticEquals ignoring metadata、walkNodes、serializeModel、deserializeModel）在 `src/core/semantic-model.ts`
- [X] T008 [US4] 實作 ConceptRegistry（registerUniversal、registerLanguageSpecific、lookup、listAll、isSupported），預載所有 23 個 universal 概念定義，在 `src/core/concept-registry.ts`
- [X] T009 [US4] 重構 CppLanguageAdapter — 新增 toSemanticNode(cstNode) 方法，將 tree-sitter CST 節點轉換為 SemanticNode（涵蓋所有 22 個 universal 概念 + C++ 特有概念），在 `src/languages/cpp/adapter.ts`
- [X] T010 [US4] 重構 CppLanguageAdapter — 新增 toBlockJSON(semanticNode) 方法，將 SemanticNode 轉換為 Blockly block JSON（含 fields、inputs、next 映射），在 `src/languages/cpp/adapter.ts`
- [X] T011 [US4] 重構 CppLanguageAdapter — 新增 fromBlockJSON(blockJson) 方法，從 Blockly block JSON 讀取為 SemanticNode，在 `src/languages/cpp/adapter.ts`
- [X] T012 [US4] 重構 CppGenerator — 新增 generateFromModel(model: SemanticModel, style: CodingStyle) 方法，走訪 SemanticNode 樹生成 C++ 程式碼（保留原有 generate(workspace) 供漸進遷移），在 `src/languages/cpp/generator.ts`
- [X] T013 [US4] 重構 CppParser — 新增 parseToModel(code: string): Promise<SemanticModel> 方法，內部呼叫 tree-sitter parse 後透過 adapter.toSemanticNode 建立語義模型，在 `src/languages/cpp/parser.ts`
- [X] T014 [US4] 重構 CodeToBlocksConverter — 新增經由 SemanticModel 的轉換路徑（parseToModel → toBlockJSON），保留原有路徑供漸進遷移，在 `src/core/code-to-blocks.ts`
- [X] T015 [US4] 重構 SyncController — 新增 SemanticModel 中心的同步模式（code→SemanticModel→blocks 和 blocks→SemanticModel→code），SourceMapping 從 SemanticNode metadata 取得，在 `src/ui/sync-controller.ts`
- [X] T016 [US4] 在 App.ts 中整合 SemanticModel 同步模式，加入 SemanticModel 序列化到 localStorage，在 `src/ui/App.ts`
- [X] T017 [US4] 撰寫 round-trip 整合測試（多種程式碼樣本的 parse→generate→parse 語義等價性），在 `tests/integration/round-trip.test.ts`
- [X] T018 [US4] 更新因 SemanticModel 重構而失敗的現有測試（adapter、generator、parser、sync、code-to-blocks 相關測試），在 `tests/`
- [X] T019 [US4] 執行全部測試（npm test），修復所有剩餘測試失敗

**Checkpoint**: SemanticModel 完整運作，所有雙向轉換經由語義模型，所有測試通過

---

## Phase 3: User Story 1 - Locale 分離 (Priority: P1)

**Goal**: 將所有 67 個積木的 message、tooltip、dropdown label 抽離到 i18n 翻譯檔，積木 JSON 中不包含任何自然語言文字

**Independent Test**: 積木 JSON 中搜尋不到中文字串，所有積木的 message/tooltip 與抽離前一致

### Tests for User Story 1

- [X] T020 [US1] 撰寫 LocaleLoader 測試（load zh-TW、inject Blockly.Msg、key fallback、缺失 key 顯示 key 名稱），在 `tests/unit/i18n-loader.test.ts`

### Implementation for User Story 1

- [X] T021 [US1] 實作 LocaleLoader（載入 locale JSON、遍歷 blocks+types key-value 注入 Blockly.Msg、fallback 邏輯），在 `src/i18n/loader.ts`
- [X] T022 [US1] 將 `src/blocks/universal.json` 中所有 26 個積木的 message0/message1/tooltip 文字抽出到 `src/i18n/zh-TW/blocks.json`，原位替換為 `%{BKY_XXX}` key（如 `%{BKY_U_VAR_DECLARE_MSG0}`）。dropdown label（運算子等）保留原值（運算子是符號非自然語言）
- [X] T023 [US1] 將 `src/languages/cpp/blocks/basic.json` 中所有 8 個積木的 message/tooltip 抽出追加到 `src/i18n/zh-TW/blocks.json`，原位替換為 `%{BKY_XXX}` key
- [X] T024 [US1] 將 `src/languages/cpp/blocks/advanced.json` 中所有 23 個積木的 message/tooltip 抽出追加到 `src/i18n/zh-TW/blocks.json`，原位替換為 `%{BKY_XXX}` key
- [X] T025 [US1] 將 `src/languages/cpp/blocks/special.json` 中所有 10 個積木的 message/tooltip 抽出追加到 `src/i18n/zh-TW/blocks.json`，原位替換為 `%{BKY_XXX}` key
- [X] T026 [US1] 重構 `src/ui/blockly-editor.ts` 中 6 個動態積木（u_print、u_func_def、u_func_call、u_input、u_var_ref、u_var_declare）的硬編碼中文文字，改為從 `Blockly.Msg['KEY']` 讀取，將所有中文 tooltip/label 文字加入 `src/i18n/zh-TW/blocks.json`
- [X] T027 [US1] 建立 `src/i18n/zh-TW/types.json`，包含所有型別 label 翻譯（TYPE_INT: "int（整數）"、TYPE_DOUBLE: "double（小數）" 等），涵蓋 C++ 基本型別和進階型別
- [X] T028 [P] [US1] 建立 `src/i18n/en/blocks.json` 和 `src/i18n/en/types.json` 作為英文 fallback（可用 key 名稱或簡短英文）
- [X] T029 [US1] 重構 `src/core/types.ts` 中 QUICK_ACCESS_ITEMS 的 6 個中文 label（變數→i18n key、輸出→i18n key 等），改為從 Blockly.Msg 讀取或使用 i18n key
- [X] T030 [US1] 整合 locale 載入到 App 啟動流程：在積木初始化前呼叫 LocaleLoader.load('zh-TW')，確保 Blockly.Msg 已注入所有翻譯，在 `src/ui/App.ts`
- [X] T031 [US1] 撰寫 locale 整合測試（啟動後所有 key 存在於 Blockly.Msg、修改翻譯後 tooltip 更新、缺失 key 的 fallback），在 `tests/integration/locale-integration.test.ts`
- [X] T032 [US1] 執行全部測試，修復因 i18n 改動導致的測試失敗（特別是 ux-features.test.ts 中引用積木 message 字串的測試）

**Checkpoint**: 所有積木 JSON 不含中文字串，所有文字從 i18n 翻譯檔載入，所有測試通過

---

## Phase 4: User Story 2 - Language Module (Priority: P1)

**Goal**: 型別清單和語言專屬積木由語言模組動態提供，universal 積木定義不包含語言特定資訊

**Independent Test**: universal.json 中型別 dropdown 無具體選項，啟動後 C++ 型別清單正確注入

### Tests for User Story 2

- [X] T033 [US2] 撰寫 LanguageModule 整合測試（C++ 模組註冊、型別注入、tooltip 覆蓋、概念過濾），在 `tests/integration/language-module.test.ts`

### Implementation for User Story 2

- [X] T034 [US2] 建立 C++ TypeEntry[] 定義（int/double/char/bool/string/long long/float/void，每個含 value + labelKey + category），在 `src/languages/cpp/types.ts`
- [X] T035 [US2] 重構 CppLanguageModule 實作新版 LanguageModule 介面（getTypes 回傳 TypeEntry[]、getSupportedConcepts 回傳所有 universal 概念、getAdditionalConcepts 回傳 C++ 特有概念、getTooltipOverrides），在 `src/languages/cpp/module.ts`
- [X] T036 [US2] 重構 Converter 為 LanguageRegistry（register、get、getAvailableLanguages、getActive、setActive），在 `src/core/converter.ts`
- [X] T037 [US2] 重構 blockly-editor.ts 中型別 dropdown — 移除硬編碼型別選項，改為從 LanguageModule.getTypes() 動態注入（TypeEntry.value + Blockly.Msg[TypeEntry.labelKey]），影響 u_var_declare、u_func_def、u_array_declare 的型別 dropdown，在 `src/ui/blockly-editor.ts`
- [X] T038 [US2] 實作 tooltip 覆蓋機制 — 在 locale 載入後，根據 LanguageModule.getTooltipOverrides() 替換 Blockly.Msg 中的對應 key，在 `src/i18n/loader.ts`
- [X] T039 [US2] 實作概念過濾 — 根據 LanguageModule.getSupportedConcepts() 決定工具箱中顯示哪些 universal 積木，在 `src/ui/blockly-editor.ts` 的 toolbox 建構邏輯
- [X] T040 [US2] 重構 App.ts — 移除硬編碼 languageId='cpp'，改為從 LanguageRegistry 取得 active 語言模組，啟動流程改為：載入 locale → 註冊語言模組 → 設定 active → 初始化 editor，在 `src/ui/App.ts`
- [X] T041 [US2] 從 `src/blocks/universal.json` 的 u_var_declare、u_func_def、u_array_declare 中移除硬編碼型別 dropdown 選項（改為空或 placeholder，由執行時注入），在 `src/blocks/universal.json`
- [X] T042 [US2] 執行全部測試，修復因 LanguageModule 重構導致的測試失敗

**Checkpoint**: 型別清單完全由語言模組提供，universal.json 無語言特定資訊，所有測試通過

---

## Phase 5: User Story 3 - Style Layer (Priority: P2)

**Goal**: 使用者可選擇編碼風格 preset，generator 根據風格生成不同格式的程式碼，parser 可偵測風格

**Independent Test**: 切換風格後積木不變，程式碼從 cout 變為 printf（或反之），偵測風格正確

### Tests for User Story 3

- [X] T043 [US3] 撰寫 CodingStyle 相關測試（preset 正確性、detectStyle 偵測 I/O/命名/縮排、style 切換後程式碼變化），在 `tests/integration/style-switching.test.ts`

### Implementation for User Story 3

- [X] T044 [US3] 建立 3 個 CodingStyle preset（APCS: iostream/camelCase/4-space/using namespace, 競賽: cstdio/snake_case/4-space/bits, Google: iostream/snake_case/2-space/no using namespace），在 `src/languages/cpp/style-presets.ts`
- [X] T045 [US3] 重構 CppGenerator — 在 generateFromModel 中根據 CodingStyle.ioPreference 切換 u_print 的輸出（iostream→cout、cstdio→printf），根據 headerStyle/useNamespaceStd 調整 include 和 namespace 生成，根據 indent 調整縮排，在 `src/languages/cpp/generator.ts`
- [X] T046 [US3] 實作 CppParser.detectStyle(code) — 分析 cout/printf 出現頻率判定 ioPreference、分析變數名模式判定 namingConvention、分析前導空白判定 indent、搜尋 bits/stdc++.h 和 using namespace std，回傳 StyleDetectionResult，在 `src/languages/cpp/parser.ts`
- [X] T047 [US3] 實作 StyleManager（getPresets、getPreset by id、getActive、setActive、detectFromCode 委派給 parser.detectStyle），在 `src/languages/style.ts`
- [X] T048 [US3] 在 App.ts 加入風格選擇器 UI（preset dropdown），切換風格時觸發 code regeneration（blocks→SemanticModel→code with new style），在 `src/ui/App.ts`
- [X] T049 [US3] 執行全部測試，修復因 Style 改動導致的測試失敗

**Checkpoint**: 3 個風格 preset 可切換，偵測風格功能運作，所有測試通過

---

## Phase 6: User Story 5 - Python Stub 多語言驗證 (Priority: P3)

**Goal**: 建立最小的 Python stub 語言模組，驗證 LanguageModule 架構可支援新語言

**Independent Test**: Python stub 模組可註冊、切換到 Python 後型別 dropdown 正確、C++ 專屬積木隱藏、切回 C++ 正常

### Tests for User Story 5

- [X] T050 [US5] 撰寫 Python stub 整合測試（註冊模組、切換語言、型別清單變化、C++ 積木隱藏、降級策略、切回 C++），在 `tests/integration/python-stub.test.ts`

### Implementation for User Story 5

- [X] T051 [P] [US5] 建立 `src/languages/python/` 目錄，建立 Python TypeEntry[]（int/float/str/bool/list/dict），在 `src/languages/python/types.ts`
- [X] T052 [P] [US5] 建立 Python stub LanguageModule 骨架（getTypes 回傳 Python 型別、getSupportedConcepts 回傳不含指標/struct 的 universal 概念子集、getAdditionalConcepts 回傳空陣列），在 `src/languages/python/module.ts`
- [X] T053 [US5] 實作優雅降級策略 — 當 SemanticNode 概念不在 Python supportedConcepts 中時，按 P6 降級順序處理（精確→近似→原始碼→不支援標記），在 `src/languages/python/module.ts`
- [X] T054 [US5] 在 App.ts 註冊 Python stub 模組，確保語言切換 UI 可選擇 Python/C++，在 `src/ui/App.ts`
- [X] T055 [US5] 建立 Python i18n 翻譯（型別 label），在 `src/i18n/zh-TW/types.json` 追加 Python 型別翻譯（TYPE_PY_INT、TYPE_PY_FLOAT 等）

**Checkpoint**: Python stub 可切換、降級策略運作、所有測試通過

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證、清理、確保所有品質標準達成

- [X] T056 執行 quickstart.md 中 6 個驗證場景的逐一檢查
- [X] T057 清理 src/core/types.ts 中已被新介面取代的舊介面定義（LanguageModule、LanguageAdapter、ParserModule、GeneratorModule），確認無其他檔案仍引用舊介面
- [X] T058 移除所有核心模組中殘留的硬編碼語言引用（確認所有 'cpp' 字串都透過 LanguageRegistry 或 LanguageModule.languageId 取得）
- [X] T059 執行全部測試（npm test），確認 100% 通過
- [ ] T060 Git commit 所有改動

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無前置依賴，立即開始。只建立型別定義。
- **Phase 2 (US4 - SemanticModel)**: 依賴 Phase 1 完成。**所有後續 phase 的前置條件**。
- **Phase 3 (US1 - Locale)**: 依賴 Phase 2 完成（i18n key 需要配合 SemanticModel 的新積木結構）
- **Phase 4 (US2 - LanguageModule)**: 依賴 Phase 3 完成（型別注入需要 i18n key 機制已建立）
- **Phase 5 (US3 - Style)**: 依賴 Phase 4 完成（style 影響 generator，需要新版 LanguageModule 介面）
- **Phase 6 (US5 - Python Stub)**: 依賴 Phase 3+4 完成（需要 i18n + LanguageModule 架構）
- **Phase 7 (Polish)**: 依賴所有 User Story 完成

### User Story Dependencies

- **US4 (SemanticModel)**: Foundational — 所有其他 US 依賴
- **US1 (Locale)**: 依賴 US4 — i18n 機制需配合重構後的積木系統
- **US2 (LanguageModule)**: 依賴 US1 — 型別注入需要 i18n key 機制（TypeEntry.labelKey → Blockly.Msg）
- **US3 (Style)**: 依賴 US2 — CodingStyle 作為 generator 參數，需要新版 Generator 介面
- **US5 (Python Stub)**: 依賴 US1+US2 — 需要完整的 i18n + LanguageModule 架構

### Within Each User Story

- 測試任務在實作任務之前（TDD）
- 核心邏輯先於整合邏輯
- 每個 phase 末尾有「執行全部測試」任務
- 同一檔案的 task 必須循序執行

### Parallel Opportunities

- Phase 1: T002/T003/T004 可並行（不同檔案）
- Phase 2: T005/T006 可並行（不同測試檔案）
- Phase 6: T051/T052 可並行（不同檔案）

---

## Parallel Example: Phase 1 Setup

```text
# 這些 task 修改不同檔案，可同時進行：
T002: src/languages/types.ts（LanguageModule 介面）
T003: src/languages/style.ts（CodingStyle 介面）
T004: src/i18n/loader.ts（LocaleLoader 介面）
```

---

## Implementation Strategy

### MVP First (US4 Only)

1. 完成 Phase 1: Setup（介面定義）
2. 完成 Phase 2: US4 SemanticModel
3. **STOP and VALIDATE**: 所有現有測試通過 + round-trip 正確
4. 此時系統內部已改為 SemanticModel 架構，外觀行為不變

### Incremental Delivery

1. US4 (SemanticModel) → 內部架構完成 → 基礎穩固
2. US1 (Locale) → 積木文字 i18n 化 → 翻譯集中管理
3. US2 (LanguageModule) → 型別動態注入 → 語言模組化
4. US3 (Style) → 風格可切換 → 教學場景支援
5. US5 (Python Stub) → 多語言驗證 → 架構完整性確認
6. Polish → 清理 + 最終驗證

### 每個 Phase 完成後

- 執行 `npm test` 確認全部測試通過
- Git commit（每完成一個 phase 至少一次 commit）
- 瀏覽器中快速煙霧測試

---

## Notes

- 不需要向後相容舊版 workspace，重構後可清除 localStorage
- 漸進遷移策略：新方法（如 generateFromModel）與舊方法（如 generate）共存，待所有呼叫點遷移完成後再移除舊方法
- 67 個積木 = 26 universal + 8 basic + 23 advanced + 10 special
- 6 個動態積木在 blockly-editor.ts 中：u_print、u_func_def、u_func_call、u_input、u_var_ref、u_var_declare
- 15 個現有測試檔案需在重構過程中持續維護
- SemanticNode 的 metadata（sourceRange、blockId）用於維持雙向 highlight 功能
