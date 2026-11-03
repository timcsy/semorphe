# Research: 刪掉 JS 直譯器

## 決定 1：非執行模組搬到哪裡
- **Decision**：放回它們的使用者那一側（`languages/cpp/` 的 lift 輔助、元件自己的資料夾）。
- **Rationale**：它們本來就不是執行的一部分，只是當初寫在 runtime 旁邊；放到使用者旁邊，下一次刪東西時不會再被拉斷。
- **Alternatives**：留在原地只刪其他檔——目錄名叫 runtime 卻只剩 lift 用的東西，會再誤導一次。

## 決定 2：`execute` 這一格直接拿掉，不留 `null`
- **Decision**：component.json 不再出現 `execute`，出現就報錯。
- **Rationale**：留著 `null ＋ _execute_why` 等於 351 份文件都在說「這裡本來該有一個東西」；P8 不做向後相容。
- **Alternatives**：保留欄位但不檢查——殘留的欄位會讓之後的人以為還要寫。

## 決定 3：參照編譯器族（E 類）在這一刀刪
- **Decision**：拿直譯器當一側的對照測試，直譯器刪掉後無法成立，這一刀一起刪；參照編譯器本身（refcc 工具、shim、CLAUDE.md 的段落）留給 6c-5。
- **Rationale**：留著它們只能改成「跳過」，那是 skip 而且會被 `audit-defect-ledger` 的棘輪擋。
- **Alternatives**：先改成對照 Cella——那是 6c-5 要決定的事（要不要留一個「Cella 對外部編譯器」的對照，見 6c 盤點風險 10）。

## 測試檔分類（2026-11-03 逐支閱讀；grep 命中 56 檔）

| 類 | 檔 | 處置 |
|---|---|---|
| **C 改 Cella** | `method_def/spec`（★ execute 那支）、`contract/session-contract`（拿掉 js-interpreter 那一格）、`probes/our-verdicts`（outcome）、`audit-completeness`（execute 路改判 formalize）、`unit/interpreter/float-format`（cout 浮點格式對照表 → expectCellaOut 逐格） | 改寫 |
| **M 改 import／搬** | `pin_constant/spec`（PIN_CONSTANTS 那條改成 Cella 判一支印常數的程式）、`board-registry`（`hasPin`／`describePins` 搬進測試）、`roundtrip-cpp-arduino-{builtins,components}`（拿掉 afterEach 的時鐘重設）、`probes/device-name-recognition`（段 1 已改） | 改 |
| **D 刪（有接手者）** | `js-interpreter-provider`（→ session-contract 的 Cella 格）、`unit/interpreter.test`（→ execution-flow、fuzz-cpp-control-flow…）、`if-else-execute`、`struct-execute`（→ interpreter-value-fidelity）、`near-miss-suggestion`（→ verdict-diagnostics 的 CELLA_UNDECLARED_SUGGEST）、`board-pin-model`（→ analog_read／pin_mode 的 spec） | 刪，紀錄接手者 |
| **D 刪（守的是直譯器自己）** | `step-budget`、`audit-executor-duplicates`、`audit-orphan-implementations`、`executor-inventory`、`noop-classification`、`consumed-by-parent-evidence`、`skip-declaration-takeover`、`executor-registry`、`interpreter-missing-language`、`unit/io`、`unit/scope`；`skip-declaration-gate` 的 L167 那一支；`audit-no-silent-continue` 的 L174–210 三支 | 刪 |
| **D 刪（要先補接手者）** | `class-method-execute`（方法呼叫方法）、`destructor-execute`（解構反序、函式回傳時解構、每個實例各一次）、`lambda-execute`（`[&]`／`[=]` 捕捉）、`oop-slice3`（虛擬分派） | 🔴 先補 Cella 背書的程式碼字串版，再刪 |
| **E 參照編譯器族** | `audit-behavior-error`、`interpreter-matches-compiler`、`probes/scenario-coverage`、`probes/studycpp-behaves`、`probes/cella-corpus-behaves`、`probes/cella-coverage-gap`、`audit-python-coverage` | 退場（研究決定 3） |
| **G 掃描清單／註解** | `audit-neutrality`、`audit-syntax-coupling`、`audit-annotation-adoption`、`audit-declared-children`、`audit-silent-fallback`、`audit-layering`、`audit-tests-import-reachable`（兩筆 ALLOWED）、`audit-param-spec`（證據字串）；`audit-runtime-message`（🔴 風險 5：改讀 Cella 錯誤鏈） | 改清單；只出現在註解的 5 支順手改註解 |

**另外兩個沒有接手者的**：Ctrl+D（`\x04`）當 EOF——補一條工作階段的 `closeInput` 測試；`arduino-pins.ts` 的兩個小函式——搬進 board-registry。
