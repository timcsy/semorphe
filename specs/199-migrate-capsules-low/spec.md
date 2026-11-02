# Feature Specification: 膠囊自證測換判準——第一批（重構 6c-2a）

**Feature Branch**: `224-migrate-capsules-low`
**Created**: 2026-11-02
**Status**: Draft
**Input**: 6c 測試盤點 B-1 難度「低」的膠囊自證測，執行那幾條的判準從 JS 直譯器換成 Cella（用 spec 198 的共用入口）。

## 背景

6c 要拆掉 JS 直譯器；B-1 是 61 個膠囊的自證測，每個都有幾條「lift 一段程式、交給直譯器跑、斷言輸出」。
盤點把其中 38 個標為難度低（斷言只看 stdout、Cella 已判得過）；`range_max` 已在 spec 198 遷過，這一批是其餘 37 個。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 37 個膠囊的執行斷言改由 Cella 判（Priority: P1）

維護者跑任一個膠囊的自證測，執行那幾條是 Cella 的判決在背書；檔內不再引用 JS 直譯器。

**Independent Test**: 37 個檔各自單獨跑全綠；`grep SemanticInterpreter` 37 個檔無結果。

**Acceptance Scenarios**:

1. **Given** 一條「lift 一段程式、斷言輸出」的測試，**When** 換成共用入口，**Then** 同一個期望值在 Cella 底下成立。
2. **Given** 一條手搭語義樹交給直譯器的測試，**When** 改寫，**Then** 改成一段程式碼字串（同一個語義），交給共用入口。
3. **Given** 一條斷言在 Cella 底下不成立，**When** 判斷，**Then** 依據寫在測試註解：期望值是 JS 直譯器自己的行為而 C++ 不是這樣（例如 `find_first_not_of` 回 `-1`、真的 C++ 印 `npos`）→ 改成 C++ 的答案；Cella 判錯 → 記下回報 cella，該條暫不改並註明。

### Edge Cases

- 測的是「直譯器的執行器本身」（直接對一顆身分執行、沒有程式碼）：改寫成會產生那顆身分的最小程式。
- 測的是 JS 直譯器才有的行為（空容器回預設值等未定義行為）：C++ 裡是未定義行為 → 改成斷言 Cella 判 reject（附種類），不是保留舊值。

## Requirements *(mandatory)*

- **FR-001**: 37 個膠囊（盤點 B-1 難度低，扣掉 range_max）的執行斷言 MUST 改用 `tests/helpers/cella-run.ts`（`expectCellaOut`／`runCella`）。
- **FR-002**: 改完的檔 MUST NOT 引用 JS 直譯器（`SemanticInterpreter`、`src/interpreter/*`）。
- **FR-003**: lift／generate／round-trip 那幾條 MUST 不動。
- **FR-004**: 期望值改動 MUST 逐條附依據（C++ 標準或參照編譯器的實際輸出），MUST NOT 整批以 Cella 的新輸出覆蓋。
- **FR-005**: 遷移中發現 Cella 判錯的，MUST 列出並回報 cella。

## Success Criteria *(mandatory)*

- **SC-001**: 37 個檔全綠，且無任何新增的 skip。
- **SC-002**: 37 個檔對 JS 直譯器的引用歸零。
- **SC-003**: 每一個改了期望值的地方都有一行依據。

## Assumptions

- spec 198 的共用入口已在這條分支（224 從 223＋222 合併後分出）。
- Cella 為 main 目前的版本（0.1.202611020258）；迭代器箭頭與巢狀大括號兩個誤判在下一版修——碰到就依 FR-005。
