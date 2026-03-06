# Tasks: 補齊轉換管線（完全重寫版）

**輸入**: 設計文件 `/specs/010-complete-conversion-pipeline/`
**前置條件**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**測試**: 依據憲法 II（TDD 非妥協），每個引擎先寫測試再實作。

**組織**: 依 user story 分組，每個 story 可獨立實作與測試。

## 格式: `[ID] [P?] [Story] 說明`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 user story (US0, US1, US2, US3)
- 所有路徑為實際檔案路徑

---

## Phase 1: Setup（型別定義與 JSON Schema 擴充）

**目的**: 擴充核心型別，為四個引擎奠定基礎

- [x] T001 擴充 AstPattern 型別，新增 patternType、fieldMappings、chain、composite、operatorDispatch、unwrap、contextTransform、multiResult 定義於 src/core/types.ts
- [x] T002 [P] 新增 RenderMapping 型別（fields、inputs、statementInputs、dynamicInputs）定義於 src/core/types.ts
- [x] T003 [P] 新增 UniversalTemplate 型別（conceptId、pattern、styleVariants、styleKey）定義於 src/core/types.ts
- [x] T004 [P] 新增 LiftPattern 型別（完整 lift pattern JSON schema，含 extract rules）定義於 src/core/types.ts
- [x] T005 為 basic.json 中 8 個積木補齊 concept 欄位（conceptId + abstractConcept）於 src/languages/cpp/blocks/basic.json
- [x] T006 [P] 為 advanced.json 中 27 個積木補齊 concept 欄位於 src/languages/cpp/blocks/advanced.json
- [x] T007 [P] 為 special.json 中 9 個積木補齊 concept 欄位於 src/languages/cpp/blocks/special.json
- [x] T008 [P] 為 universal.json 中 29 個積木補齊 concept 欄位（conceptId + renderMapping）於 src/blocks/universal.json

**Checkpoint**: 所有型別定義完成，JSON schema 補齊，`npx vitest run` 通過（零回歸）

---

## Phase 2: Foundational（四個通用引擎）

**目的**: 建立四個 JSON 驅動的通用引擎，這是所有 user story 的基礎

**⚠️ 關鍵**: 所有 user story 都依賴此階段完成

### 引擎 1: Pattern Lifter（Code → Semantic）

- [x] T009 撰寫 pattern-lifter 單元測試（simple、constrained、fieldMappings 模式）於 tests/unit/core/pattern-lifter.test.ts
- [x] T010 撰寫 pattern-lifter 進階測試（operatorDispatch、chain、composite、unwrap 模式）於 tests/unit/core/pattern-lifter.test.ts
- [x] T011 實作 PatternLifter 類別：從 BlockSpecRegistry 建立 nodeType→Pattern[] 索引，simple/constrained 匹配，fieldMappings 提取，於 src/core/lift/pattern-lifter.ts
- [x] T012 實作 PatternLifter 進階模式：operatorDispatch（運算子分派）、chain（左遞迴鏈偵測）、composite（多子節點聯合匹配）、unwrap（透明解包）、contextTransform、multiResult 於 src/core/lift/pattern-lifter.ts
- [x] T013 修改 Lifter.liftWithContext()：Level 1 改為查詢 PatternLifter，保留 Level 3/4 回退機制於 src/core/lift/lifter.ts

### 引擎 2: Template Generator（Semantic → Code）

- [x] T014 [P] 撰寫 template-generator 單元測試（${PROP}、${CHILD}、${BODY}、${CHILDREN:sep}、${?CHILD:template} 語法）於 tests/unit/core/template-generator.test.ts
- [x] T015 實作 TemplateGenerator：解析 codeTemplate pattern，支援屬性替換、子節點表達式、區塊結構、分隔符 join、條件區塊、styleVariants 於 src/core/projection/template-generator.ts
- [x] T016 修改 code-generator.ts generateNode()：對於有 codeTemplate 的概念優先使用 TemplateGenerator，無模板時回退為既有 generator 於 src/core/projection/code-generator.ts

### 引擎 3: Pattern Renderer（Semantic → Blocks）

- [x] T017 [P] 撰寫 pattern-renderer 單元測試（自動推導 renderMapping、fields/inputs/statementInputs 映射、dynamicInputs）於 tests/unit/core/pattern-renderer.test.ts
- [x] T018 實作 PatternRenderer：從 BlockSpec 建立 conceptId→RenderSpec 索引，自動從 blockDef.args0 推導 renderMapping，通用欄位/輸入映射於 src/core/projection/pattern-renderer.ts
- [x] T019 修改 block-renderer.ts renderBlock()：對於有 RenderSpec 的概念使用 PatternRenderer，無 spec 時回退為既有 switch-case 於 src/core/projection/block-renderer.ts

### 引擎 4: Pattern Extractor（Blocks → Semantic）

- [x] T020 [P] 撰寫 pattern-extractor 單元測試（從 block fields/inputs 反向提取 semantic properties/children）於 tests/unit/core/pattern-extractor.test.ts
- [x] T021 實作 PatternExtractor：從 BlockSpec 建立 blockType→ExtractSpec 索引，renderMapping 反向使用，通用提取邏輯於 src/core/projection/pattern-extractor.ts
- [ ] T022 修改 blockly-panel.ts extractBlock()：對於有 ExtractSpec 的積木使用 PatternExtractor，無 spec 時回退為既有 switch-case 於 src/ui/panels/blockly-panel.ts

### 引擎整合

- [x] T023 擴充 BlockSpecRegistry：自動從 JSON 建構 conceptId→blockType 索引（取代硬編碼 CONCEPT_TO_BLOCK），新增 getByBlockType()、getAllPatterns() 方法於 src/core/block-spec-registry.ts
- [x] T024 修改 C++ 語言模組 module.ts：載入四引擎、註冊所有 BlockSpec、建立索引於 src/languages/cpp/module.ts

**Checkpoint**: 四個引擎完成，`npx vitest run` 通過（零回歸），引擎可被 user story 使用

---

## Phase 3: User Story 0 — 通用 astPattern Lift 引擎 (Priority: P0) 🎯 MVP

**目標**: 證明 astPattern 引擎能從 JSON 定義自動 lift AST 節點為語義概念

**獨立測試**: 選取 `c_increment`（update_expression），在不寫任何手寫 lifter 的情況下，驗證程式碼 `i++` 能被 astPattern 引擎自動 lift 為 `cpp_increment` 概念再渲染為 `c_increment` 積木

### 測試

- [x] T025 [US0] 撰寫 P3 驗證整合測試：純 JSON 積木（c_increment）的完整四方向轉換（block→semantic→code→AST→semantic→block）於 tests/integration/p3-json-only.test.ts

### 實作

- [x] T026 [US0] 為 basic.json 中 8 個積木補齊 astPattern.fieldMappings（AST→語義欄位映射）於 src/languages/cpp/blocks/basic.json
- [x] T027 [P] [US0] 為 special.json 中尚無手寫 lifter 的積木（c_ifdef、c_ifndef）補齊 fieldMappings 於 src/languages/cpp/blocks/special.json
- [x] T028 [US0] 建立 C++ lift-patterns.json：定義 universal 概念的 C++ AST→語義模式（number_literal、identifier、string_literal、char_literal、true、false、break_statement、continue_statement）於 src/languages/cpp/lift-patterns.json
- [x] T029 [US0] 在 lift-patterns.json 中新增 unwrap 模式（parenthesized_expression、condition_clause、compound_statement）於 src/languages/cpp/lift-patterns.json
- [x] T030 [US0] 在 lift-patterns.json 中新增 contextTransform 模式（expression_statement：func_call_expr → func_call）於 src/languages/cpp/lift-patterns.json
- [x] T031 [US0] 建立 universal-templates.json：為 universal 概念提供 C++ codeTemplate（var_ref、number_literal、string_literal、break、continue、endl）於 src/languages/cpp/templates/universal-templates.json
- [x] T032 [US0] 修改語言模組載入 lift-patterns.json 和 universal-templates.json 並註冊到 PatternLifter 和 TemplateGenerator 於 src/languages/cpp/module.ts

**Checkpoint**: `c_increment` 純 JSON 四方向轉換通過（SC-005 驗證），`npx vitest run` 通過

---

## Phase 4: User Story 1 — L1 積木雙向轉換 (Priority: P1)

**目標**: 所有 L1 積木（increment、compound_assign、for_loop、do_while、switch/case、char_literal、printf、scanf）來回轉換正確

**獨立測試**: 每種 L1 積木執行 block→code→block 來回轉換，驗證積木類型正確重建

### 測試

- [x] T033 [US1] 撰寫 L1 積木來回轉換整合測試（c_increment、c_compound_assign、c_char_literal、c_printf、c_scanf、c_do_while、c_for_loop、c_switch+c_case）於 tests/integration/roundtrip-l1.test.ts

### 實作

- [x] T034 [US1] 在 lift-patterns.json 中新增 operatorDispatch 模式（binary_expression → arithmetic/compare/logic）於 src/languages/cpp/lift-patterns.json
- [x] T035 [US1] 在 lift-patterns.json 中新增 chain 模式（cout << chain → print、cin >> chain → input）於 src/languages/cpp/lift-patterns.json
- [x] T036 [US1] 在 lift-patterns.json 中新增 composite 模式（counting for_statement → count_loop）於 src/languages/cpp/lift-patterns.json
- [x] T037 [US1] 在 lift-patterns.json 中新增結構提取模式（if_statement → if、while_statement → while_loop、return_statement → return、function_definition → func_def）於 src/languages/cpp/lift-patterns.json
- [x] T038 [US1] 在 lift-patterns.json 中新增 multiResult 模式（declaration 多 declarator → var_declare / array_declare）於 src/languages/cpp/lift-patterns.json
- [x] T039 [US1] 在 lift-patterns.json 中新增 constrained 模式（call_expression function=printf → print、function=scanf → input、其他 → func_call_expr）於 src/languages/cpp/lift-patterns.json
- [x] T040 [US1] 在 lift-patterns.json 中新增 simple 模式（assignment_expression → var_assign，含複合賦值運算子區分）於 src/languages/cpp/lift-patterns.json
- [x] T041 [US1] 在 lift-patterns.json 中新增 unary_expression 模式（! → logic_not、- → negate、++/-- → cpp_increment via operatorDispatch or contextTransform）於 src/languages/cpp/lift-patterns.json
- [x] T042 [US1] 在 lift-patterns.json 中新增 subscript_expression → array_access 模式於 src/languages/cpp/lift-patterns.json
- [x] T043 [US1] 在 lift-patterns.json 中新增預處理器模式（preproc_include → cpp_include/cpp_include_local、using_declaration → cpp_using_namespace、preproc_def → cpp_define、comment → comment）於 src/languages/cpp/lift-patterns.json
- [x] T044 [US1] 在 universal-templates.json 中新增所有 universal 概念的 C++ code template（if、while_loop、count_loop、func_def、func_call、return、var_declare、var_assign、array_declare、array_access、arithmetic、compare、logic、logic_not、negate、print+styleVariants、input+styleVariants）於 src/languages/cpp/templates/universal-templates.json
- [x] T045 [US1] 為 CONCEPT_TO_BLOCK 補齊 L1 C++ 概念映射（cpp_increment → c_increment、cpp_compound_assign → c_compound_assign、cpp_char_literal → c_char_literal、cpp_do_while → c_do_while、cpp_for_loop → c_for_loop、cpp_switch → c_switch、cpp_case → c_case、cpp_printf → c_printf、cpp_scanf → c_scanf）於 src/core/block-spec-registry.ts（自動從 JSON 建構）

**Checkpoint**: 所有 L1 積木來回轉換通過，`npx vitest run` 通過

---

## Phase 5: User Story 2 — L2 積木雙向轉換 (Priority: P2)

**目標**: 所有 L2 積木（指標、結構體、STL、OOP、前處理器）來回轉換正確

**獨立測試**: 每種 L2 積木執行 block→code→block 來回轉換

### 測試

- [x] T046 [US2] 撰寫 L2 積木來回轉換整合測試（27 個 advanced.json 積木 + c_ifdef/c_ifndef）於 tests/integration/roundtrip-l2.test.ts

### 實作

- [x] T047 [P] [US2] 為 advanced.json 中 27 個積木補齊 astPattern.fieldMappings（指標、結構體、字串函式、STL 容器、容器操作、OOP）於 src/languages/cpp/blocks/advanced.json
- [x] T048 [US2] 在 lift-patterns.json 中新增所有 L2 AST 模式（若 advanced.json 的 simple astPattern 不足，補充 constrained 或 composite 模式）於 src/languages/cpp/lift-patterns.json
- [x] T049 [US2] 為 CONCEPT_TO_BLOCK 確認所有 L2 概念映射完整（自動從 JSON concept.conceptId → blockDef.type 建構）於 src/core/block-spec-registry.ts

**Checkpoint**: 所有 L2 積木來回轉換通過，`npx vitest run` 通過

---

## Phase 6: User Story 3 — 手寫程式碼轉積木 (Priority: P3)

**目標**: 學生手寫的 C++ 程式碼能轉換為最精確的積木類型

**獨立測試**: 在程式碼編輯器中輸入常見 C++ 程式碼模式，驗證每個模式對應到正確的積木類型

### 測試

- [x] T050 [US3] 撰寫手寫程式碼→積木整合測試（spec.md 中 10 個驗收情境：i++、x+=5、for loop、do-while、switch/case、int *p、printf、scanf、vector<int>、v.push_back）於 tests/integration/code-to-blocks.test.ts
- [x] T051 [P] [US3] 撰寫邊界情況測試（for(;;) → raw_code、巢狀結構、混用 C/C++ I/O、空 switch/case、**pp 多重指標、前置/後置遞增）於 tests/integration/edge-cases.test.ts

### 實作

- [x] T052 [US3] 針對測試失敗的邊界情況，補充 lift-patterns.json 中的模式定義或調整 fieldMappings 於 src/languages/cpp/lift-patterns.json
- [x] T053 [US3] 確保不支援的構造（lambda、模板特化等）優雅退化為 c_raw_code 而非當機，驗證 PatternLifter 的 Level 3/4 回退機制於 src/core/lift/pattern-lifter.ts

**Checkpoint**: 所有手寫程式碼→積木測試通過，邊界情況正確處理，`npx vitest run` 通過

---

## Phase 7: 遷移清理 & 完整性驗證

**目的**: 刪除所有手寫 lifter/generator/renderer/extractor 程式碼，確認四引擎完全接管

- [x] T054 撰寫全積木（68 個）來回轉換整合測試於 tests/integration/roundtrip-all.test.ts
- [ ] T055 確認 PatternLifter 完全覆蓋所有 lift-patterns.json + blocks/*.json 的模式，刪除 src/languages/cpp/lifters/ 目錄（statements.ts、declarations.ts、expressions.ts、io.ts、index.ts）
- [ ] T056 確認 TemplateGenerator 完全覆蓋所有 codeTemplate + universal-templates.json，刪除 src/languages/cpp/generators/ 目錄（statements.ts、declarations.ts、expressions.ts、io.ts、index.ts）
- [ ] T057 確認 PatternRenderer 完全覆蓋所有概念的 renderMapping，移除 block-renderer.ts 中的 CONCEPT_TO_BLOCK 硬編碼和 renderBlock() switch-case 於 src/core/projection/block-renderer.ts
- [ ] T058 確認 PatternExtractor 完全覆蓋所有積木的提取，移除 blockly-panel.ts 中的 extractBlock() switch-case 於 src/ui/panels/blockly-panel.ts
- [ ] T059 執行 quickstart.md 全部 7 個驗證場景確認通過
- [x] T060 執行 `npx vitest run` 確認零回歸，所有測試通過（745/745）

---

## 依賴與執行順序

### Phase 依賴

- **Phase 1 (Setup)**: 無依賴，立即開始
- **Phase 2 (Foundational)**: 依賴 Phase 1 完成 — **阻塞所有 user story**
- **Phase 3 (US0)**: 依賴 Phase 2 完成
- **Phase 4 (US1)**: 依賴 Phase 3 完成（US0 的基礎模式被 US1 使用）
- **Phase 5 (US2)**: 依賴 Phase 2 完成（可與 US1 平行，但建議 US1 先完成以驗證引擎穩定性）
- **Phase 6 (US3)**: 依賴 Phase 4 + Phase 5 完成（需要所有 lift pattern 就緒）
- **Phase 7 (Polish)**: 依賴所有 user story 完成

### User Story 依賴

- **US0 (P0)**: Phase 2 完成後開始 — 無其他 story 依賴
- **US1 (P1)**: US0 完成後開始 — 使用 US0 建立的基礎模式
- **US2 (P2)**: Phase 2 完成後可開始 — 與 US1 獨立（不同積木集）
- **US3 (P3)**: US1 + US2 完成後開始 — 需要所有 lift pattern 就緒

### 各 Story 內部順序

- 測試先寫（Red）→ 實作（Green）→ 重構
- JSON 定義先完成 → 引擎整合 → 驗證

### 平行機會

- Phase 1: T002-T004 可平行（不同型別定義），T005-T008 可平行（不同 JSON 檔案）
- Phase 2: 引擎 1-4 的測試可平行撰寫（T009/T014/T017/T020），但實作依序進行
- Phase 4: T034-T043 內部多個 lift-patterns 新增可平行
- Phase 5: T047 單獨可大量平行（27 個積木的 fieldMappings）

---

## 平行範例：Phase 1

```bash
# 型別定義可平行：
Task T002: 新增 RenderMapping 型別
Task T003: 新增 UniversalTemplate 型別
Task T004: 新增 LiftPattern 型別

# JSON 補齊可平行：
Task T005: basic.json concept 欄位
Task T006: advanced.json concept 欄位
Task T007: special.json concept 欄位
Task T008: universal.json concept + renderMapping
```

---

## 實作策略

### MVP 先行（US0 only）

1. 完成 Phase 1: Setup（型別擴充 + JSON 補齊）
2. 完成 Phase 2: Foundational（四引擎核心）
3. 完成 Phase 3: US0（c_increment 純 JSON 四方向轉換）
4. **停下驗證**: P3 原則達成？純 JSON 積木能雙向轉換？
5. 確認後繼續

### 增量交付

1. Setup + Foundational → 基礎就緒
2. US0 → P3 驗證通過（MVP!）
3. US1 → L1 積木全覆蓋
4. US2 → L2 積木全覆蓋
5. US3 → 手寫程式碼導入
6. 遷移清理 → 刪除所有手寫程式碼

---

## 備註

- [P] 標記的任務可平行執行
- [Story] 標籤對應 spec.md 中的 user story
- 憲法 II 要求 TDD：先寫測試再實作
- 憲法 III 要求：每個 task 完成後 commit
- 遷移策略：四引擎漸進覆蓋，最後才刪除手寫程式碼（零回歸保證）
