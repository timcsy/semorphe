# Feature Specification: 執行契約依宣告分層、輸出分 stdout／stderr

**Feature Branch**: `248-contract-layers`
**Created**: 2026-11-04
**Status**: Implemented
**Input**: 三方會議第三輪之後（[history/334](../../knowledge/history/334-三方會議第三輪符號學三面向與操作者介面.md)），cos-mos 準備階段 3（瀏覽器宿主執行學生程式）。使用者定：**驗收改成「通過核心＋自己宣告的部分」**；cos-mos 的 `console.wit` 定案 `enum output { stdout, stderr }`。

## 背景

`tests/contract/session-contract.test.ts` 對每一個提供者跑同一份契約，而**不看宣告**——一個只能一路跑到底的提供者（cos-mos 宿主第一版）只能過 4／16 條，「宣告沒有的能力畫面會照實說」只是產品畫面的行為，契約沒有對應。

## User Scenarios & Testing

### US1 - 只能跑到底的提供者有一份能全過的契約（P1）
核心（一路跑完、執行期錯誤回 failed）每一個提供者都要過；中斷點／單步／停著時操作看 `stepping`、讀輸入／EOF 看 `interactiveInput`、覆蓋看 `steps`、改變數看 `stepping`＋`setVariable`。
**Independent Test**：一筆只宣告最少能力的提供者（同一個 Cella）只跑核心、全過；另一條斷言「每一筆的分層與提供者自己的宣告一致」。

### US2 - 學生選了除錯模式、而提供者不能停下（P1）
主控台照實說「這個執行器不能逐步執行——改成直接跑完」，然後跑完；不得等一個永遠不會來的停下。

### US3 - 輸出分 stdout／stderr（P2）
`onOutput(cb(text, stream?))`，沒給是 stdout；判題只看 stdout（cerr 混進來會把對的程式判錯）。

## Requirements
- **FR-001**: `SessionDetails` MUST 有 `stepping`、`interactiveInput`（必填——不寫不等於沒有）；缺的 MUST 進 `missing`。
- **FR-002**: 契約 MUST 依宣告分層；核心 MUST 每個提供者都跑。
- **FR-003**: 控制器 MUST 在提供者不能單步時照實說並直接跑完。
- **FR-004**: `onOutput` MUST 帶得出 stream；Cella 的判決 `out` 只對應 stdout（cella 2026-11-04）。

## Success Criteria
- **SC-001**: cella（全能力）全過；cella-minimal 只跑核心且全過；跳過的條目數＝宣告缺的能力對應的條目數。
