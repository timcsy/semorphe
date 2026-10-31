# Tasks: Cella 判決與型別查詢——第一個看得見的消費者

**Input**: `specs/182-cella-verdict-provider/`（plan、spec、research、data-model、contracts、quickstart）

**Tests**: 憲章 II（TDD）——轉換與過濾先寫測試、先紅。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 量產物：在 scratchpad 的試驗頁用 `import.meta.glob('/node_modules/@cella-lang/*/*.cell', { query: '?url' })` 建置一次，記下 `dist/` 的 `.cell`／wasm 檔數、總大小、gzip 後大小（research R5、quickstart 3）；行不通就改成建置時複製到 `public/`，並把結論寫回 research R5

---

## Phase 2: Foundational（診斷型別與轉換）

- [x] T002 先寫契約測試（紅）於 `tests/unit/core/verdict-diagnostics.test.ts`：contracts 的五條不變式（accept 無雜訊、unsupported 永遠是 info、nodeId 在樹裡或歸到祖先、要讀輸入而無測資時沒有 ub*／fuel、能力缺時 0 則＋「需要 Cella」）
- [x] T003 `src/core/diagnostics.ts`：`DiagnosticSource` 加 `'cella'`、`severity` 加 `'info'`（附 _why：有產出端才加——檔頭那句的兌現）；tsc 指出的每個消費端照改
- [x] T004 `src/core/verdict-diagnostics.ts`：`toDiagnostics()`（data-model 的種類表、節點歸屬、過濾），讓 T002 轉綠；核心只認判決的形狀，不 import 提供者

---

## Phase 3: User Story 1 + 2 - 有錯與判不出來標在那一塊（P1）🎯 MVP

**Goal**: 判決的 problem 以中文標在積木與程式碼上，「有錯」與「判不出來」分得開

**Independent Test**: 越界讀取的程式 → 那一塊高亮、那一行波浪、中文原因；尚未支援的構造 → info 樣子

- [x] T005 [US1] `src/providers/cella/assets.ts`：照 T001 的結論給 `read(pkg, file)`（瀏覽器用 fetch）
- [x] T006 [US1] `src/providers/cella/worker.ts`：在 Worker 裡呼叫 `createCellaVerdict(read)`；訊息協定 `{ id, kind: 'verdict'|'types', program, input }` → `{ id, result | error }`；只保留最新一筆排隊（R10）
- [x] T007 [US1] `src/providers/cella/provider.ts`：宣告 `verdict`、`types`；帶版本號送出、過期即丟；載入狀態 idle／loading／ready／unavailable
- [x] T008 [US1] `src/ui/app.ts`：在 JS 直譯器之前註冊 Cella 提供者；`__appReady` 後閒置時開始載入；`semantic:update` 之後（防抖）送 formalize 出的程式；結果經 `toDiagnostics` 併進既有的 `onDiagnostics`（`app.ts:4381` 那一段）；課文任務的 `check.stdin` 當輸入（R8）
- [x] T009 [P] [US2] `src/ui/panels/monaco-panel.ts`：`'info'` → `MarkerSeverity.Info`（與降級提示同一個樣子）；訊息用中文說明＋原文
- [x] T010 [P] [US2] `src/ui/panels/blockly-panel.ts`：`'info'` 的積木標示與 `'error'` 可區分（顏色／圖示照既有的降級視覺）
- [x] T011 [US1] 狀態列：判斷功能的載入狀態與 notes（需要 Cella、需要輸入）
- [x] T012 [US1] e2e `e2e/cella-verdict.spec.ts`：越界程式 → 兩側都有標示；尚未支援 → info；修好 → 消失

---

## Phase 4: User Story 5 - 載入期間什麼都照常（P1）

- [x] T013 [US5] e2e：載入完成前編輯與執行照常（可在測試裡延遲 worker 的就緒）；載入失敗（模擬 fetch 失敗）→ 狀態「無法使用」＋原因
- [x] T014 [US5] `src/providers/cella/cache.ts`：Cache Storage（套件檔）＋ IndexedDB（編好的模組），鍵＝checkerHash；worker 先查快取
- [x] T015 [US5] 量 SC-004：第一次與第二次「可用 → 第一次出結果」的時間（瀏覽器實測，記進 quickstart）

---

## Phase 5: User Story 3 - 「依 libc++」小標（P2）

- [x] T016 [US3] `toDiagnostics` 對 `assumes` 產生一則 notes／或一則 info 診斷附在 program 根上（不改有錯／沒錯）；中文說明表（`vector.growth`、`library.what`…）
- [x] T017 [US3] 單元測試：帶 assumes 的 accept 不產生 error、有小標

---

## Phase 6: User Story 4 - 型別不合接得上、標得出（P2）

- [x] T018 [US4] worker 加 `types`；`toDiagnostics` 對不合的位置產生 `type_mismatch`（params 帶需要／接上）；有洞時的 hole 不顯示
- [x] T019 [US4] 單元＋e2e：字串接進整數位置 → 接得上、該位置有說明；工具箱積木數不變

---

## Phase 7: Polish

- [x] T020 護欄：分層（核心不 import 提供者）、tests-import-reachable 例外名單拿掉 `verdict.ts`（它進產品路徑了）、相關基線
- [ ] T021 `verify-in-browser`：quickstart 第 4 步全走一遍（含重新整理後變快）
- [ ] T022 全套＋e2e（背景）；合進 main；看 CI；vision 5a 打勾；history 一筆（判決第一次被學生看到）

## Dependencies

Phase 1 → Phase 2 → Phase 3（MVP）→ Phase 4 → Phase 5／6（可並行）→ Phase 7。T009／T010 可並行。
