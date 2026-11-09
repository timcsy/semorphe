# Tasks: 操作者介面第一刀——「提議中」的變更

**Input**: `specs/220-operator-proposals/`（plan、research、data-model、contracts、quickstart）
**Tests**: 憲章 II 要求 TDD——每一段先寫測試。

## Phase 1: Setup

- [x] T001 建立 `src/core/proposals/`，在 `src/core/README.md` 的子目錄表加一列「proposals：結構操作與提議中的變更」

## Phase 2: Foundational（所有故事都要）

- [x] T002 [P] 寫 `tests/unit/core/proposals/line-diff.test.ts`（相同、插入一行、刪除一行、改一行、空字串）
- [x] T003 [P] 實作 `src/core/proposals/line-diff.ts` 的 `lineDiff(before, after): DiffLine[]`，重用 `src/core/projection/patch-shift.ts` 的 `alignLines`

## Phase 3: US2 結構操作（P1）——US1 依賴它

**Goal**: 四種操作作用在語義樹副本上，全有或全無，非法照實拒。
**Independent Test**: `npx vitest run tests/unit/core/proposals/tree-ops.test.ts`

- [x] T004 [US2] 寫 `tests/unit/core/proposals/tree-ops.test.ts`：用真的 C++ 元件宣告（lift 一支小程式取得樹；schema 由 `allCppComponents()` 組）測插入／刪除／移動／改屬性各一、一串操作、輸入不被改動、新節點拿到系統發的 id
- [x] T005 [US3] 同檔加拒絕原因各一支：empty、node-missing、unknown-component（含 NodeSpec 子孫）、unknown-slot、slot-mismatch、slot-full、unknown-property、bad-value、index-out-of-range、root（刪／移根）、cycle（移到自己的子孫）；中途失敗整串不生效
- [x] T006 [US2] 實作 `src/core/proposals/tree-ops.ts`：`TreeOp`、`NodeSpec`、`OpSchema {known, slots, props, isRoot}`、`applyOps(tree, ops, schema)`、`refsOf(tree, ops)`；屬性值型別依 ParamSpec 的 kind 檢查（不認得的 kind 只檢查是 PropertyValue）

## Phase 4: US1／US3／US4 佇列（P1／P2）

**Goal**: 提議送出、排隊、重新檢查（過期）、接受／退回的狀態機（無 DOM）。
**Independent Test**: `npx vitest run tests/unit/core/proposals/proposal-queue.test.ts`

- [x] T007 [US1] 寫 `tests/unit/core/proposals/proposal-queue.test.ts`：submit 合法 → pending、不改目前樹；submit 非法 → refused 不入佇列；accept 回傳提議後的樹並移出；reject 移出；作者空 → 未具名；get 查得到最後狀態
- [x] T008 [US3] 同檔加過期：revalidate(新樹) 時引用不在 → stale、元件變了 → stale、無關的改動仍 pending、回到可套用 → pending；stale 不能 accept
- [x] T009 [US4] 同檔加佇列：三個依序、接受第一個使第二個過期
- [x] T010 實作 `src/core/proposals/proposal-queue.ts`（依 data-model 的狀態轉移；`onChange` 回呼給介面；歷史保留最近 50 筆）

## Phase 5: US1 介面與入口（P1）

**Goal**: 使用者看得到提議、差異，按接受／退回；外部用 `__app.proposals` 送。
**Independent Test**: `npx playwright test e2e/proposals.spec.ts`

- [x] T011 [US1] 寫 `e2e/proposals.spec.ts`：送出 → 程式碼不變、列出現、差異有 `+`；接受 → 程式碼變、復原回原樣；退回 → 不變；改程式碼 → 過期、接受停用；連送三個 → 「還有 3 個」；量 submit 到列可見 < 1 秒（SC-001）；非法提議 submit 回 refused 且畫面無列
- [x] T012 [US1] 實作 `src/ui/proposal-bar.ts`：非阻斷列（作者、理由、差異 `<pre>` 著色、狀態、還有幾個、接受／退回；過期時接受停用並顯示原因）；文案走 `msg(key, fallback)`，加 i18n 鍵（zh-TW、en）
- [x] T013 [US1] 接進 `src/ui/app.ts`：組 `OpSchema`（登錄表＋語言套件 declarations）、`proposals` 門面（submit／list／get）、訂閱 `semantic:update` → revalidate、接受 → `bus.emit('edit:tree', {viewId: 'proposal', tree})` 並設 `lastEditor = 'proposal'`、`doUndo`／`doRedo` 對 'proposal' 走樹的歷史；同步中接受則提示稍後再試
- [x] T014 [US1] 差異：改前／改後都用 `generateCode` ＋ `syncController.patchMissingDependencies`，與程式碼面板一致

## Phase 6: Polish

- [x] T015 [P] 寫 `tests/integration/proposals-roundtrip.test.ts`（SC-005）：C、C++、Python、Arduino 各一支課文程式，套四種操作後產碼再 lift，樹形狀一致
- [x] T016 `npx tsc --noEmit`、`npm run test:unit`、`npm run test:guard`（layering、portable-core、tests-import-reachable、four-independences、neutrality、no-native-dialog）；基線上升時手改並附 note
- [x] T017 瀏覽器實測（skill verify-in-browser）：主控台送提議 → 列、差異、接受、復原、退回、過期
  - 2026-11-09：**使用者實測**（照白話說明在網站主控台試）：「測了一下，感覺不錯」，沒有回報問題。
  - 2026-11-09：Chrome 擴充回「Debugger 沒接上」（同 union 那次），改用 Playwright 開同一份建置截圖、用眼睛看：送出前後、接受後程式碼與積木一起更新。抓到兩處小問題並修：卡片下緣壓到狀態列、「還有 1 個在等」把畫面上那個也算進去（改「共 N 個待處理」）
- [ ] T018 `npm run build:vscode`（改了 `app.ts`）；長測試 `tools/long-test.sh`（全套＋建置＋e2e）

## Dependencies

- T002→T003；T004/T005→T006；T006→T007..T010；T010→T011..T014；T014→T015..T018
- US2 是 US1／US3／US4 的前提；US3、US4 的核心測試在 Phase 4，介面的過期與佇列在 T011 一起驗

## Implementation Strategy

MVP = Phase 1–5（可送、可看、可接受／退回、會過期）；Phase 6 收尾後合併。
