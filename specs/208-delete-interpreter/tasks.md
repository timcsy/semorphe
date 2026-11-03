# Tasks: 刪掉 JS 直譯器（重構 6c-4）

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)（測試分類表）

## Phase 1：搬（段 1）

- [X] T001 搬 `lang/runtime/{range-lift,device-names,printf}` 到 `src/languages/cpp/range-ends.ts`、`src/languages/cpp/device-names.ts`、`src/languages/cpp/lifters/printf-format.ts`，改 26 個 range_* 與 pin_attach、io 的 import（tsc、175 條相關測試綠；130d81f7）

## Phase 2：先補接手者（刪之前）

- [X] T002 [P] [US3] `tests/integration/cella-oop-semantics.test.ts`（9 條綠 ＋ 2 根釘子；f728e323）。🔴 **補的時候抓到五個被直譯器蓋住的缺陷**：
  - ✅ 修了：計數迴圈的變數沒記進 lift 的查找表 ⟹ 迴圈裡的 `T t(k);` 被當成前置宣告（9b7e7e78）
  - ✅ 修了：成員函式裡的裸名字方法呼叫送成 eCall（被判「呼叫未宣告的函式」）⟹ eMCall { obj: eThis }
  - ✅ 修了：method_virtual／method_override／method_virtual_pure 沒有 formalize（學生寫虛擬函式完全不能跑）
  - 🟡 釘住、交給 **spec 209「OOP 來回一趟」**：`p->m()` 來回一趟變 `p.m()`；`struct B : A` 丟掉繼承；`virtual ~A()` 丟掉 virtual；
    虛擬／覆寫方法丟掉尾端 const——四個都要動元件宣告（屬性、積木形態、產生器），**排在段 3（刪）之前做**
- [X] T003 [P] [US3] `tests/contract/session-contract.test.ts` 加 Ctrl+D（closeInput）當 EOF 的一條；拿掉 js-interpreter 那一格
- [X] T004 [P] [US1] `src/components/cpp/method_def/spec.test.ts`、`tests/probes/our-verdicts.test.ts`、`tests/unit/interpreter/float-format.test.ts`（搬到 `tests/integration/cout-float-format.test.ts`）改成 Cella 背書
- [ ] T005 [P] [US1] `src/components/cpp/pin_constant/spec.test.ts` 的 PIN_CONSTANTS 那條改成 Cella 判；`tests/integration/board-registry.test.ts` 的 `hasPin`／`describePins` 搬進測試本身；兩支 Arduino roundtrip 拿掉時鐘重設

## Phase 3：宣告不再有 execute（段 2）

- [ ] T006 [US2] `src/core/component/{views,judges,paths}.ts`、`src/core/types.ts`：拿掉 execute 格；views 對出現 `execute` 的宣告報錯
- [ ] T007 [US2] 一次性腳本（JSON 讀寫）拿掉 351 份 component.json 的 `paths.execute` 與 `_execute_why`
- [ ] T008 [US2] `tests/integration/audit-completeness.test.ts` 的 execute 路改判 formalize；其餘寫死五路的護欄（以 `grep -rn "'execute'" tests/integration` 為準）改新定義，各保留注入測試

## Phase 4：刪（段 3）

- [ ] T009 [US1] 刪 `src/interpreter/`、`src/components/**/execute.ts`、`src/languages/cpp/lang/{executors,runtime}/`、`src/providers/js-interpreter/`、只給執行用的輔助檔（spec 輸入列的那 14 支）、`src/languages/cpp/generators/index.ts` 的 `registerCoreExecutors`；tsc 為準修到乾淨
- [ ] T010 [US1] 刪 research 表 D 類與 E 類的測試檔、`skip-declaration-gate` L167 與 `audit-no-silent-continue` L174–210 那幾支；`tests/helpers/python-lift.ts` 的 `runPython` 一起刪
- [ ] T011 [US1] G 類：掃描清單拿掉已刪的目錄；`audit-tests-import-reachable` 拿掉兩筆 ALLOWED；`audit-param-spec` 的證據字串；註解
- [ ] T012 [US4] `tests/integration/audit-runtime-message.test.ts` 改掃 Cella 的錯誤鏈（`RUNTIME_ERR_*`／`CELLA_*` 的 kind→文案），入口條件 > 0，加注入測試
- [ ] T013 新護欄（或併入 `audit-cella-only`）：src 與 tests 零個 import 指向已刪路徑，含注入測試
- [ ] T014 基線：`test:guard` 逐支看，每份動到的基線 note 寫「6c-4：execute 那一路退場」

## Phase 5：文件（段 5）

- [ ] T015 [P] 元件 skill（`knowledge/skills/component-*`）與範本的「五路」「execute」改新定義；CLAUDE.md 只改「五路」定義（🪦 段落留給 6c-5）

## Phase 6：驗收

- [ ] T016 全套（記時間，對照 main 的這一輪）、整輪 e2e、vsix（記大小）、課文判決綁定語料與 StudyCpp 判決探針逐支對照
- [ ] T017 合併、推送、看 CI；history 寫轉變；vision 第 6 項狀態行；6c 盤點 draft 標 6c-4 完成；回報 cella（刪掉之後的釘子若有變化）

## 依賴

T001 → T002～T005（可並行）→ **spec 209（OOP 來回一趟）** → T006～T008 → T009～T014 → T015 → T016 → T017

⚠️ spec 209 為什麼擋在刪之前：直譯器裡那幾支手搭樹的 OOP 測試（destructor／class-method／oop-slice3）刪掉之後，指標分派與 struct 繼承只剩兩根釘子在看——先修好，讓它們變成正向的 Cella 測試再刪。
