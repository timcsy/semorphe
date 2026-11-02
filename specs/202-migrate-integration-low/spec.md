# Feature Specification: 整合測試換判準——第一批（重構 6c-2d）

**Feature Branch**: `227-migrate-integration-low`
**Created**: 2026-11-02
**Status**: Draft
**Input**: 6c 測試盤點 B-2 難度「低」的整合測試與探針（40 支，扣掉 6c-1 已遷的 execution-cpp-containers、vector-initializer-list），執行判準從 JS 直譯器換成 Cella。

## 背景

B-1（元件膠囊的自證測）已遷 59／61（spec 198～201）。B-2 是 66 支整合測試與探針；盤點把 42 支標為低（斷言只看 stdout、Cella 判得過、換一個 run 即可），其中 2 支已在 6c-1 遷過。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 40 支整合測試的執行斷言改由 Cella 判（Priority: P1）

**Independent Test**: 40 支各自單獨跑全綠；執行那幾條不再經過 JS 直譯器。

**Acceptance Scenarios**:

1. **Given** 斷言輸出的測試，**When** 換成 `expectCellaOut`／`runCella`，**Then** 同一個期望值成立。
2. **Given** 期望值是 JS 直譯器自己的取捨而 C++ 不是這樣，**Then** 改成 C++ 的答案（標準或 g++ 實測），依據寫在註解。
3. **Given** 反向測試（「要出聲」），**Then** 斷言具體的判決種類或原因；注意因為翻不出／未支援而來的假綠。
4. **Given** Cella 判錯、未支援或我們缺 formalize，**Then** 用 `knownCellaGap` 釘住（零 skip）；能補的 formalize 補上。

## Requirements *(mandatory)*

- **FR-001**: 執行斷言 MUST 改用 `tests/helpers/cella-run.ts`。
- **FR-002**: 改完的檔 MUST NOT 為了執行而引用 JS 直譯器（`SemanticInterpreter`、`src/interpreter/*`、`runtime/*`）。
- **FR-003**: 不是執行的斷言（lift、generate、round-trip、身分）MUST 不動。
- **FR-004**: 期望值改動 MUST 逐條附依據；MUST NOT 整批以 Cella 的輸出覆蓋。
- **FR-005**: 基線檔（例如 declaration-change-parity 錄好的執行輸出）若要重錄，MUST 逐筆比對差異並說明，不得整批重產。

## Success Criteria *(mandatory)*

- **SC-001**: 40 支全綠、零 skip。
- **SC-002**: 40 支對 JS 直譯器的執行引用歸零。

## Assumptions

- 從 226 分出；Cella 0.1.202611020258。
