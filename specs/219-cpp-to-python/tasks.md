# Tasks: 跨語言互轉第二對——C++ → Python（第一版）

**Input**: `specs/219-cpp-to-python/`（plan、spec、research、data-model、contracts、quickstart）
**Tests**: 要（憲章 II 測試驅動；判準是 Cella 判決相同）

## Phase 1: Setup

- [X] T001 量 Python 這側入門子集需要的建構子是否都有 build 函式（print／input／var_assign／if／loop_while／loop_for＋range_make／func_def／return／func_call／arithmetic／compare／logic／literal_*／var_ref／container_append／container_at／container_size），缺的列進 T010 in `specs/219-cpp-to-python/research.md`（附錄）

## Phase 2: Foundational

- [X] T002 `LanguagePack` 多一個可選的 `convertToLanguage(tree, toLanguage, types)`（形狀照 contracts/convert-to-language.md）in `src/core/language-packs.ts`
- [X] T003 護欄骨架（先紅）：讀 cpp-beginner 66 支解答與課文 `check.stdin`，C++ 那側 Cella 判一次、換寫法、Python 那側 Cella 判、比判決／輸出／assumes；保留的要有原因；「兩份加起來 = 66」與「至少一半換得過去」兩條入口條件 in `tests/integration/cpp-to-python-verdict.test.ts`

## Phase 3: User Story 1 — 入門程式換成同樣意思的 Python（P1）🎯 MVP

**Goal**: 只用入門子集的 C++ 程式換成道地 Python，兩邊判決相同。
**Independent Test**: T003 的護欄裡「換過去」那一份全部判決相同。

- [ ] T004 [US1] 單元測試（先紅）：最小程式逐類——印字串與整數（含 endl／無 endl）、宣告與指定、四則（含整數除法 → `int(a / b)`）、if／else、while、計數 for → `for i in range(…)`、函式定義與呼叫、讀整數（一句 cin → 一行拆開）、vector／陣列 → list in `src/languages/cpp/cpp-to-python.test.ts`
- [X] T005 [US1] 改寫的骨架：走樹、每顆 C++ 節點查表換成 Python 節點、遇到表外的身分記 `outside-subset`；整支換或不換（契約 C1）in `src/languages/cpp/cpp-to-python.ts`
- [X] T006 [US1] 結構：program／func_def(main) 的本體攤平成頂層、`return 0` 拿掉、include／using 拿掉；其他函式 → def in `src/languages/cpp/cpp-to-python.ts`
- [X] T007 [US1] 輸出：cout 鏈 → print（endl 結尾 ⟹ 預設換行；否則 `end=""`；多個值之間 `sep=""`）；double 值 → `f"{x:g}"`（需要型別，拿不到記 `needs-types`）in `src/languages/cpp/cpp-to-python.ts`
- [X] T008 [US1] 輸入：一句 `cin >> a >> b` → `a, b = map(T, input().split())`（T 依宣告型別：int／float／str）；讀進陣列的計數迴圈 → 整行拆成 list in `src/languages/cpp/cpp-to-python.ts`
- [X] T009 [US1] 運算與控制：arithmetic（整數 `/` → `int(a / b)`）、compare、logic、var_assign、var_assign_compound、if、loop_while、loop_count → for range、break、continue、func_call、return in `src/languages/cpp/cpp-to-python.ts`
- [ ] T010 [P] [US1] 缺的 Python 建構子（T001 列出的）補在各自膠囊的 `lift.ts`（身分只寫在膠囊裡，契約 C2）in `src/components/python/*/lift.ts`
- [X] T011 [US1] 容器與字串：vector／陣列宣告 → list、`v.push_back(x)` → `v.append(x)`、`v.size()` → `len(v)`、`a[i]`、string 宣告與 `s[i]`、`s.size()` in `src/languages/cpp/cpp-to-python.ts`
- [X] T012 [US1] 掛上：cpp 套件 `convertToLanguage: (tree, 'python', types) → convertCppToPython` in `src/languages/cpp/pack.ts`
- [ ] T013 [US1] app：換目標時語言變了 ⟹ 問**來源語言**的套件（型別照第一對：沿用切換前的判決、對不上才另外問）；換成 ⟹ 寫進編輯器、以程式碼為準重畫積木、提示「換成 Python：N 行」；等待中使用者改了程式或又換目標 ⟹ 作廢 in `src/ui/app.ts`
- [X] T014 [US1] 讓 T003 的護欄裡「換過去」那一份全綠（逐支修，每支的差異先查我們送了什麼）in `tests/integration/cpp-to-python-verdict.test.ts`

## Phase 4: User Story 2 — 意思會變的地方照實保留、說出原因（P1）

**Goal**: 反例全部保留、原因類別正確，不換成意思不同的 Python。
**Independent Test**: 反例 6 種各自保留、`reasons[].kind` 正確。

- [ ] T015 [US2] 反例測試（先紅）：負數整數除法（換成 `int(a/b)` 而判決相同，**不是** `//`）、`a % b` 一般用法（保留 `modulo`）、`n % 2 == 0`（換）、溢位（C++ 判 reject／assumes ⟹ 保留 `overflow`）、`c - 'a'`（保留 `char`）、指標（`pointer`）、類別（`class`）in `tests/integration/cpp-to-python-verdict.test.ts`
- [ ] T016 [US2] 實作保留判斷：取餘數只在與 0 比較時換；char 參與運算、指標、類別、樣板、表外身分 ⟹ 記原因 in `src/languages/cpp/cpp-to-python.ts`
- [ ] T017 [US2] 溢位：C++ 那側判決帶溢位類的問題或 assumes ⟹ 整支保留 `overflow`（換法拿得到判決時才判；拿不到記 `needs-types`）in `src/languages/cpp/cpp-to-python.ts`
- [ ] T018 [US2] app：整支不換 ⟹ 程式不動、目標退回 C++、提示列出原因（哪幾行、哪一類）in `src/ui/app.ts`
- [ ] T019 [P] [US2] 提示文字（換了幾行、保留原因的各類說法）zh-TW／en in `src/i18n/zh-TW/` 與 `src/i18n/en/`

## Phase 5: User Story 3 — 課文解答的常駐檢查（P2）

**Goal**: 66 支分成兩份、加起來 66、至少一半換得過去。
**Independent Test**: `npx vitest run tests/integration/cpp-to-python-verdict.test.ts`

- [ ] T020 [US3] 護欄的報表：印出「換過去 N 支／保留 M 支（原因分佈）」；兩條入口條件與 SC-001 的門檻 in `tests/integration/cpp-to-python-verdict.test.ts`
- [ ] T021 [US3] 換好的程式再 lift 一趟（Python）、產碼回來形狀不變（SC-005）in `tests/integration/cpp-to-python-verdict.test.ts`

## Phase 6: Polish

- [ ] T022 e2e：C++ 目標寫兩數相加 → 換到 Python → 編輯器裡是 Python、提示換了幾行；寫一支用指標的 → 換 → 程式不變、目標回 C++ in `e2e/cpp-to-python.spec.ts`
- [ ] T023 test:guard（新檔、新匯出、語料會動的基線照實手調並寫 note）
- [ ] T024 長測試（全套＋建置＋e2e）在合併後的狀態；合併；history ＋ vision 互轉那一行（第二對第一版）

## Dependencies

- Phase 1 → Phase 2 → US1 → US2（保留判斷建在改寫骨架上）→ US3（報表與 SC-005）→ Polish
- US1 內：T004（紅）→ T005 → T006～T011 → T012 → T013 → T014

## Parallel

- T010 與 T006～T009 可並行（不同檔）；T019 與 T016～T018 可並行。

## Implementation Strategy

MVP = Phase 1～3（US1）：護欄裡至少一半換得過去且判決相同、app 換目標時接得上。US2 緊接著做（同為 P1，保證「換錯 = 0」）。
