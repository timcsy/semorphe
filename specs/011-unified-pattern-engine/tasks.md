# 任務清單：統一 Pattern Engine 三層表達能力架構

**輸入**：設計文件來自 `/specs/011-unified-pattern-engine/`
**前置條件**：plan.md、spec.md、research.md、data-model.md、contracts/

**組織方式**：任務按使用者故事分組，以便獨立實作和測試。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可並行執行（不同檔案、無依賴）
- **[Story]**：所屬使用者故事（如 US1、US2、US3、US4）
- 描述中包含確切的檔案路徑

---

## 第一階段：基礎建設（共用設施）

**目的**：建立三個 Registry 類別——所有層級的基礎元件

- [X] T001 [P] 在 `src/core/registry/transform-registry.ts` 建立 TransformRegistry 類別（Map 封裝，含 register/get/has，依照 contracts/transform-registry.md）
- [X] T002 [P] 在 `src/core/registry/lift-strategy-registry.ts` 建立 LiftStrategyRegistry 類別（Map 封裝，含 register/get/has，依照 contracts/lift-strategy-registry.md）
- [X] T003 [P] 在 `src/core/registry/render-strategy-registry.ts` 建立 RenderStrategyRegistry 類別（Map 封裝，含 register/get/has，依照 contracts/render-strategy-registry.md）
- [X] T004 在 `src/core/registry/index.ts` 建立 barrel export

---

## 第二階段：核心增強（阻塞性前置條件）

**目的**：增強核心引擎的型別和管線，支援 transform/strategy/$namedChildren[N]。必須在任何遷移之前完成。

**關鍵**：此階段完成前，不可開始任何使用者故事的工作

- [X] T005 在 `src/core/types.ts` 擴展 FieldMapping 型別，新增選用的 `transform` 欄位（依照 contracts/enhanced-field-mapping.md）
- [X] T006 在 `src/core/types.ts` 擴展 LiftPattern 型別，新增選用的 `liftStrategy` 欄位
- [X] T007 在 `src/core/lift/pattern-lifter.ts` 的 `resolveAstField()` 中新增 `$namedChildren[N]` 語法支援（依照 contracts/enhanced-field-mapping.md）
- [X] T008 在 `src/core/lift/pattern-lifter.ts` 的欄位提取中新增 transform 查找——當 `extract: "text"` 且 `transform` 存在時，呼叫 `TransformRegistry.get(transform)`
- [X] T009 在 `src/core/lift/pattern-lifter.ts` 新增 liftStrategy 分派——當 pattern 含 `liftStrategy` 時，在 pattern matching 之前呼叫 `LiftStrategyRegistry.get()`
- [X] T010 在 `src/core/projection/pattern-renderer.ts` 擴展 RenderMapping 型別新增選用的 `strategy` 欄位，並新增 renderStrategy 分派——當 renderSpec 含 `strategy` 時，呼叫 `RenderStrategyRegistry.get()`
- [X] T011 在 `src/ui/app.new.ts` 中接線三個 Registry 至應用初始化，傳入 PatternLifter 和 PatternRenderer

**檢查點**：核心引擎現已支援全部三層。既有測試必須仍然通過（行為尚未改變）。

---

## 第三階段：使用者故事 1 & 2 — Layer 1 純 JSON + Layer 2 JSON+Transform（優先級：P1）

**目標**：將 string_literal、char_literal、comment、return_statement 從 hand-written lifter 遷移到 Layer 1/2 的 JSON pattern。註冊核心和 C++ 的 transform。

**獨立測試**：`"hello"` → 語義 `{ value: "hello" }`（無引號），`// comment` → `{ text: "comment" }`（無前綴），`return 0;` → `{ value: <number_literal> }` ——全部僅透過 JSON pattern 完成。

### 實作

- [X] T012 [P] [US2] 在引擎初始化時註冊核心 transform（`stripQuotes`、`stripAngleBrackets`），位於 `src/core/registry/transform-registry.ts` 或 `src/ui/app.new.ts`
- [X] T013 [P] [US2] 在 `src/languages/cpp/lifters/transforms.ts` 建立 C++ transform 函數（`cpp:stripComment`），並在 `src/languages/cpp/lifters/index.ts` 中註冊
- [X] T014 [US2] 更新 `src/languages/cpp/lift-patterns.json` 中的 `string_literal` pattern——在 value 的 fieldMapping 中加入 `"transform": "stripQuotes"`
- [X] T015 [P] [US2] 更新 `src/languages/cpp/lift-patterns.json` 中的 `char_literal` pattern——在 value 的 fieldMapping 中加入 `"transform": "stripQuotes"`
- [X] T016 [US1] 更新 `src/languages/cpp/lift-patterns.json` 中的 `return_statement` pattern——將 ast 從 `value` 改為 `$namedChildren[0]`，`extract: "lift"`
- [X] T017 [US2] 更新 `src/languages/cpp/lift-patterns.json` 中的 `comment` pattern——在 text 的 fieldMapping 中加入 `"transform": "cpp:stripComment"`
- [X] T018 從 `src/languages/cpp/lifters/index.ts` 的 `preferHandWritten` 陣列中移除 `string_literal`、`char_literal`、`comment`、`return_statement`（保留剩餘 3 個：preproc_include、function_definition、declaration）
- [X] T019 從 `src/languages/cpp/lifters/index.ts` 中移除 string_literal、char_literal、comment、return_statement 對應的 hand-written lifter 函數（若有共用則標記未使用）
- [X] T020 執行 `npx vitest run`——驗證 Layer 1/2 遷移後全部測試通過

**檢查點**：7 個 preferHandWritten 節點中已遷移 4 個。Layer 1 & 2 驗證完成。全部測試通過。

---

## 第四階段：使用者故事 3 — Layer 3 JSON+Strategy：Lift 側（優先級：P2）

**目標**：將 preproc_include、function_definition、declaration 從 hand-written lifter 遷移到透過 LiftStrategyRegistry 註冊的 liftStrategy 函數。

**獨立測試**：`#include <iostream>` 和 `#include "myfile.h"` 透過 strategy 正確分流到不同概念；`int main() {}` 透過 strategy 正確提取 name/return_type/params。

### 實作

- [X] T021 [US3] 在 `src/languages/cpp/lifters/strategies.ts` 建立 lift strategy 函數，從現有 hand-written lifter 提取：
  - `cpp:liftPreprocInclude`（來自現有 preproc_include lifter）
  - `cpp:liftFunctionDef`（來自現有 function_definition lifter）
  - `cpp:liftDeclaration`（來自現有 declaration lifter）
- [X] T022 [US3] 在 `src/languages/cpp/lifters/index.ts` 中註冊 lift strategy——對每個函數呼叫 `liftStrategyRegistry.register()`
- [X] T023 [US3] 更新 `src/languages/cpp/lift-patterns.json` 中的 `preproc_include` pattern——加入 `"liftStrategy": "cpp:liftPreprocInclude"`
- [X] T024 [P] [US3] 更新 `src/languages/cpp/lift-patterns.json` 中的 `function_definition` pattern——加入 `"liftStrategy": "cpp:liftFunctionDef"`
- [X] T025 [P] [US3] 更新 `src/languages/cpp/lift-patterns.json` 中的 `declaration` pattern——加入 `"liftStrategy": "cpp:liftDeclaration"`
- [X] T026 [US3] 從 `src/languages/cpp/lifters/index.ts` 的 `preferHandWritten` 陣列中移除 `preproc_include`、`function_definition`、`declaration`（陣列此時應為空）
- [X] T027 [US3] 從 `src/languages/cpp/lifters/index.ts` 中移除已轉為 strategy 的剩餘 hand-written lifter 函數
- [X] T028 [US3] 執行 `npx vitest run`——驗證 lift 側 Layer 3 遷移後全部測試通過

**檢查點**：全部 7 個 preferHandWritten 節點已遷移。preferHandWritten 陣列為空。

---

## 第五階段：使用者故事 3 — Layer 3 JSON+Strategy：Render 側（優先級：P2）

**目標**：將全部 7 個 SWITCH_CASE_CONCEPTS（input、var_declare、print、func_def、func_call、func_call_expr、if）從 block-renderer.ts 的 switch-case 遷移到 renderStrategy 函數。

**獨立測試**：多變數 var_declare 透過 strategy 渲染出正確的動態欄位和 extraState；if-else 透過 strategy 渲染出正確的 mutator 結構。

### 實作

- [X] T029 [US3] 在 `src/languages/cpp/renderers/strategies.ts` 建立 render strategy 函數，從 `src/core/projection/block-renderer.ts` 現有的 switch-case 提取：
  - `cpp:renderInput`
  - `cpp:renderVarDeclare`
  - `cpp:renderPrint`
  - `cpp:renderFuncDef`
  - `cpp:renderFuncCall`（func_call 和 func_call_expr 共用）
  - `cpp:renderIf`
- [X] T030 [US3] 在 C++ 語言模組初始化中註冊 render strategy——對每個函數呼叫 `renderStrategyRegistry.register()`
- [X] T031 [US3] 更新 BlockSpec JSON 或 renderMapping 設定，為這 7 個概念加入 `"strategy"` 欄位
- [X] T032 [US3] 執行 `npx vitest run`——驗證 render strategy 與 switch-case 共存時全部測試通過（雙路徑驗證）

**檢查點**：Render strategy 驗證完成。準備移除 switch-case。

---

## 第六階段：使用者故事 4 — 消除黑名單，建立單一管線（優先級：P2）

**目標**：完全移除 `preferHandWritten` 機制和 `SWITCH_CASE_CONCEPTS` 機制。只保留單一管線。

**獨立測試**：`grep -r "preferHandWritten\|SWITCH_CASE_CONCEPTS" src/` 回傳 0 筆結果。

### 實作

- [X] T033 [US4] 從 `src/core/lift/lifter.ts` 移除 `preferHandWritten` Set、`preferHandWritten()` 方法、以及雙管線分支邏輯——Lifter 將所有 pattern 工作完全委託給 PatternLifter
- [X] T034 [US4] 從 `src/core/projection/block-renderer.ts` 移除 `SWITCH_CASE_CONCEPTS` Set、`CONCEPT_TO_BLOCK` Map、以及整段 switch-case 渲染區塊——renderBlock 將所有工作完全委託給 PatternRenderer
- [X] T035 [US4] 從 `src/languages/cpp/lifters/index.ts` 移除所有已無用的 hand-written lifter import/export
- [X] T036 [US4] 執行 `npx vitest run`——驗證單一管線下全部 745+ 個測試通過

**檢查點**：黑名單已消除。架構現為三層表達能力的單一管線。

---

## 第七階段：收尾與跨領域關注事項

**目的**：最終驗證、清理、瀏覽器確認

- [X] T037 透過 grep 驗證整個程式碼庫中 `preferHandWritten` 和 `SWITCH_CASE_CONCEPTS` 的引用為零
- [X] T038 驗證 `src/languages/cpp/lifters/` 中無殘留未使用的 hand-written lifter 函數
- [X] T039 執行完整測試套件 `npx vitest run`——確認全部測試通過
- [ ] T040 瀏覽器驗證：測試 10 個程式碼→積木轉換場景（include、using namespace、main、var_declare、if、cin、cout、return、算術運算、字串），確認行為與遷移前一致
- [ ] T041 執行 quickstart.md 驗證——僅用 JSON 新增一個 Layer 1 概念並驗證雙向轉換

---

## 依賴關係與執行順序

### 階段依賴

- **第一階段（基礎建設）**：無依賴——可立即開始
- **第二階段（核心增強）**：依賴第一階段——阻塞所有使用者故事
- **第三階段（US1+US2）**：依賴第二階段——Layer 1 & 2 遷移
- **第四階段（US3 Lift）**：依賴第三階段（preferHandWritten 陣列已縮減至 3 個）
- **第五階段（US3 Render）**：僅依賴第二階段（可與第四階段並行，需謹慎）
- **第六階段（US4）**：依賴第四階段和第五階段（所有遷移完成後才能移除）
- **第七階段（收尾）**：依賴第六階段

### 使用者故事依賴

- **US1（P1）**：需要第二階段的 `$namedChildren[N]` 支援
- **US2（P1）**：需要第二階段的 transform 支援——可與 US1 並行
- **US3（P2）**：需要第二階段的 strategy 支援——lift 和 render 側可並行化
- **US4（P2）**：需要 US1+US2+US3 全部完成——移除是最後一步

### 並行機會

- T001、T002、T003 可全部並行（不同檔案）
- T012、T013 可並行（不同檔案）
- T014、T015 可並行（同一檔案但獨立條目）
- T024、T025 可並行（獨立的 JSON 條目）
- 第四階段（lift strategy）和第五階段（render strategy）可部分重疊

---

## 實作策略

### MVP 優先（第一 → 二 → 三階段）

1. 完成第一階段：基礎建設——建立 3 個 Registry
2. 完成第二階段：核心增強——增強核心引擎
3. 完成第三階段：US1+US2——Layer 1/2 遷移（4 個節點）
4. **停下驗證**：執行全部測試，確認 Layer 1/2 運作正常
5. 僅此步驟即可消除 7 個 preferHandWritten 條目中的 4 個

### 完整交付（第四 → 五 → 六 → 七階段）

6. 完成第四階段：US3 lift 側——Layer 3 lift strategy（3 個節點）
7. 完成第五階段：US3 render 側——Layer 3 render strategy（7 個概念）
8. 完成第六階段：US4——移除黑名單
9. 完成第七階段：收尾——最終驗證

---

## 備註

- [P] 任務 = 不同檔案、無依賴
- [Story] 標籤將任務對應到特定使用者故事以便追蹤
- 至少在每個階段完成時 commit 一次
- 所有遷移任務遵循相同模式：提取邏輯 → 在 JSON 中註冊 → 移除舊路徑 → 驗證測試
- Strategy 函數是現有 hand-written 邏輯的直接搬移，只是註冊方式不同
- `preferHandWritten` 陣列應逐步縮減：7 → 3（第三階段）→ 0（第四階段）
