# Tasks: Python → C++（第一版）

## Phase 1（不需要型別表，今天）

- [x] T001 契約與登錄：`src/languages/python/to-cpp/contract.ts`（`expr`／`stmt`、`typeOf`、`keep`、`useHelper`）、`registry.ts`（依膠囊目錄對回身分，同 219）
- [x] T002 寫 `tests/unit/languages/python/python-to-cpp.test.ts`：以手寫型別表（`{nodes, basis}`）餵——印出、指定與宣告提前、if／while／for range、清單、函式、input／int()、`//`／`%` 的小函式；保留：聯集、list[?]、unreached、印浮點、印清單、子集以外
- [x] T003 引擎 `src/languages/python/python-to-cpp.ts`：整支換或不換、原因清單（行號）、宣告提前到函式開頭、`main` 包住最外層、`#include` 與小函式只補用到的
- [x] T004 [P] 各顆的 `to-cpp.ts`：program、print（含 end／sep、bool）、var_assign、var_ref、literal_*、arithmetic、compare、logic、if、loop_while、loop_for＋range_make、break、input、cast、array_make、container_append／at／assign／size／sum、math_max／min、func_def、return、func_call、param_decl
- [x] T005 Python 語言套件接 `convertToLanguage(tree, 'cpp', types)`

## Phase 2（Cella 發布 observedTypes 之後）

- [x] T006 升級 Cella（upgrade-cella）；provider 接 `observedTypes(程式 JSON, 輸入, 步數)`
- [x] T007 課文護欄 `tests/integration/python-to-cpp-verdict.test.ts`：python-beginner 每一支換過去而判決、輸出、assumes 相同，或保留附原因；反例清單（SC-002）
- [x] T008 產品：換目標 Python → C++ 時拿型別表（輸入：題目 stdin → 重播上一次 → 沒有就不換）、換完 C++ 再判一次、不同就退回並說原因；提示說「型別依這一份輸入」
- [x] T008b FR-009（使用者定）：引擎收輸入摘要，換出來的 C++ 第一行加註解「變數的型別是照這組輸入跑一次看到的（輸入：…）；換一組輸入，型別可能不同」；單元測試釘逐字、e2e 與課文護欄斷言（SC-005）
- [x] T009 e2e `e2e/python-to-cpp.spec.ts`；SC-004 計時
- [X] T010 guard、長測試、合併；history、vision
