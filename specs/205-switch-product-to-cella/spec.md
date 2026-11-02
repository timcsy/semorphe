# Feature Specification: 產品端只走 Cella（重構 6c-3）

**Feature Branch**: `230-switch-product-to-cella`
**Created**: 2026-11-02
**Status**: Draft
**Input**: knowie-next 2026-11-02 的 6c-3 計劃（6c-2 已合進 main 64b52f3e：127 支測試裡 123 支改由 Cella 背書）。

## 背景

學生按「執行」走能力介面的 `openSession`（`src/core/capabilities.ts`）：照登記順序問提供者，Cella 不接（還沒就緒、翻不出）就由 JS 直譯器接。
6c-3 要讓產品**只走 Cella**——沒有退路之後，每一種「接不了」都要照實說出來（P6）。

**第一步量到的（2026-11-02）**：
- 工作階段邊跑邊送輸出：執行到一半出錯，出錯前印的照樣看得到，停下的原因指回那一顆節點 ⟹ 「部分輸出」不擋。
- 🔴 工作階段印到 6666 字就停（Cella 的 wasm 內部堆疊溢位，訊息是英文的 `Maximum call stack size exceeded`）⟹ **擋住「拿掉 JS 提供者」那一步**，已回報 cella。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 接不了的時候照實說，而且說中文（Priority: P1）

學生按執行時，Cella 還沒準備好、翻不出、判不出來、判定程式有錯——畫面各說一句中文，指到那一行；不偷偷換一個執行器。

**Independent Test**：三種情況各一支 e2e：暖機中按執行 → 顯示「準備中」並在好了之後自動開跑；翻不出的程式 → 指出哪一行還不支援；除以零 → 中文說明並指到那一行，出錯前的輸出還在。

### User Story 2 - 執行相關的測試改由 Cella 背書（Priority: P1）

盤點 C 類 6 支（session 契約、執行覆蓋、遇到沒看過的元件要停、執行流程、第一課的錯誤畫面、第七十六條錄放護欄）與 6c-2 移過來的 4 支（program、var_ref/gap、audit-cin-fail-state 的互動那一半、python-execution），每一支說得出「接手的是誰」。

### 🪦 User Story 3 - Arduino 的即時執行（2026-11-02 拿掉：沒有東西要搬）

規劃時假設學生看得到「LED 照真實時間閃」、而那靠 JS 直譯器的 `useRealTime`。**查證後不成立**：`useRealTime(true)` 在 `src/` 裡
沒有任何呼叫者（只有 `arduino-clock.ts` 自己與 `delay/spec.test.ts` 的註解提到），真實時間那條路從來沒有開過；
板子做了什麼本來就由硬體時間軸面板讀 Cella 判決的 `pins`（5c，history/311）。⟹ 隨 6c-4 刪 runtime 一起退場，不需要接手者。

### User Story 4 - 拿掉 JS 提供者的登記（Priority: P1，⏳ 等 Cella 修好堆疊溢位）

組裝點不再登記 `jsInterpreterProvider`；`openSession` 找不到提供者時的畫面由 US1 接住。

### Edge Cases

- 長輸出（> 6666 字）：修好之前，至少不得是英文的例外字串——US1 給它一句中文（「輸出太長，Cella 目前跑不完」並附 issue）。
- `analogReadResolution(99)`：板子判決照真實行為不出聲；診斷層補一條 warning（推薦，記在 6c 測試盤點 draft）。

## Requirements *(mandatory)*

- **FR-001**: 每一個 `RUNTIME_ERR_*`／problem kind MUST 有中文訊息；沒有對應的 MUST 有中文的退路訊息，MUST NOT 把英文例外原文直接當成訊息。
- **FR-002**: 「還沒準備好」MUST 顯示準備中並在就緒後開跑，MUST NOT 改走另一個執行器（US4 之前可保留 JS 為退路，但畫面要說出用了哪一個——現有的 `declined` 已帶原因）。
- **FR-003**: C 類與移過來的 4 支測試 MUST 改由 Cella 的工作階段或判決背書；刪掉的那幾條 MUST 說明接手者。
- **FR-004**: US4 MUST 等 Cella 的堆疊溢位修好（升級並驗證 8000／50000 字的輸出）才合併。
- **FR-005**: 每一個子步驟改到使用者按得到的東西 MUST 跑 e2e；改執行路徑 MUST 開瀏覽器驗四件事（停在哪、狀態在不在、繼續之後對不對、有沒有留痕）。

## Success Criteria *(mandatory)*

- **SC-001**: 產品裡沒有任何一條執行路徑走到 JS 直譯器（US4 之後；護欄：組裝點不 import `providers/js-interpreter`）。
- **SC-002**: 三種接不了的情況各有一支 e2e。
- **SC-003**: 10 支執行相關測試由 Cella 背書。

## Assumptions

- Cella 下一版修好堆疊溢位（已回報兩次，標為擋切換）。
