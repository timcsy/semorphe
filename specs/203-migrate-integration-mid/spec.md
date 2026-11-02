# Feature Specification: 整合測試換判準——第二批（重構 6c-2e）

**Feature Branch**: `228-migrate-integration-mid`
**Created**: 2026-11-02
**Status**: Draft
**Input**: 6c 測試盤點 B-2 難度「中」「高」的整合測試與探針（22 支），執行判準從 JS 直譯器換成 Cella。

## 背景

B-2 難度低的 42 支已遷（spec 198、202）。剩下的有三種形狀：
- **參照編譯器即時比對**（10 支）：測試當場編一份 C++ 交給參照編譯器，跟 JS 直譯器的輸出比。換成 Cella 之後，比對的另一邊從 JS 直譯器換成 Cella——**參照編譯器那一邊這一刀不動**（它整族的退場是 6c-5 的事），所以這 10 支會變成「Cella 對參照編譯器」的交叉檢查。
- **基線與內部模組**（7 支）：錄好的五路基線含執行輸出、引用 `runtime/aggregate` 等內部模組、未定義行為的期望值、`rand` 的序列（實作定義，Cella 照 glibc 並寫在 `assumes`）。
- **大型或跨語言**（5 支）：3149 行的競賽程式、Arduino 的套件與硬體盲測、結構化繫結、課文參考解答（含 Python）。

範圍外（屬 6c-3）：`audit-cin-fail-state`（互動輸入的那一半）、`python-execution`（提示先印、沒輸入時的訊息——是 session 與訊息行為，不在 `out`）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 22 支整合測試的執行斷言改由 Cella 判（Priority: P1）

**Independent Test**: 22 支各自單獨跑全綠；執行那一邊不再經過 JS 直譯器。

**Acceptance Scenarios**:

1. **Given** 參照編譯器即時比對的測試，**When** JS 那一邊換成 Cella，**Then** 兩邊一致；不一致時逐條判斷誰對（參照編譯器是 clang，標準沒定死的地方看 `assumes`）。
2. **Given** 錄好的基線含執行輸出，**When** 改由 Cella 判，**Then** 逐筆比對差異並說明，不得整批重產。
3. **Given** 期望值是 JS 直譯器自己的取捨（UB 照跑、`rand` 用某個序列），**Then** 改成 C++ 的答案或斷言 `assumes`，依據寫在註解。
4. **Given** Cella 判錯、未支援或我們缺 formalize，**Then** 用 `knownCellaGap` 釘住（零 skip）；能補的 formalize 補上。

## Requirements *(mandatory)*

- **FR-001**: 執行斷言 MUST 改用 `tests/helpers/cella-run.ts`；Python 的參考解答需要時擴充同一個入口（家族 `python`），不另開一條路。
- **FR-002**: 改完的檔 MUST NOT 為了執行而引用 JS 直譯器（`SemanticInterpreter`、`src/interpreter/*`、`runtime/*`）。
- **FR-003**: 參照編譯器那一邊 MUST 不動（6c-5 才退場）。
- **FR-004**: 期望值與基線改動 MUST 逐條附依據。
- **FR-005**: Cella 那側的問題 MUST 列出並回報。

## Success Criteria *(mandatory)*

- **SC-001**: 22 支全綠、零 skip。
- **SC-002**: 22 支對 JS 直譯器的執行引用歸零。

## Assumptions

- 從 227 分出；Cella 0.1.202611020258。參照編譯器即時比對的測試本機要 `SEMORPHE_REFCC_INCLUDE=<worktree>/tests/fixtures/refcc-shim`。
