# Feature Specification: 暫停時的板子狀態與改感測器輸入

**Feature Branch**: `185-live-board` | **Created**: 2026-11-01 | **Status**: Done
**Input**: 5c（spec 184）留下的範圍外項：「暫停時的即時板子狀態與改感測器輸入（DAP 的 `env`／`setInput`）」——
Cella 的除錯工作階段本來就有 `readEnv`／`setInput`（`@cella-lang/arduino` README〈Entries〉），不必等任何人。

## User Scenarios

### US1 暫停時看得到板子（P1）
板子上的程式停在中斷點：「硬體」分頁顯示「暫停中（模擬時間）」與當下每支腳的模式／值、伺服、LCD。繼續或停止後回到判決給的那一份。

### US2 改感測器輸入（P1）
停著的時候在硬體分頁改一個輸入（`analog:A0`＝900），繼續之後程式下一次讀取就讀到新的值；這次執行記為「有人插手過」。
只有提供者做得到（Cella）時才畫那一列——JS 直譯器的板子狀態不是同一個形狀，不假裝（P6）。

## Requirements
- FR-001 工作階段停下時給出板子當下的狀態；給不出來（不是板子、提供者沒有）就是 null
- FR-002 只有宣告了 `setInput` 的提供者能改輸入；改輸入是一次插手，進插手紀錄
- FR-003 中斷點設在任何一種敘述上都要停、停點回報語義樹的 id（本段量到並修了 5b 的缺陷）

## Success Criteria
- SC-001 e2e：讀 A0 決定 13 號腳的程式，停下時 13 號腳 LOW；改 A0＝900、繼續，下一次停下 13 號腳 HIGH
- SC-002 契約（兩個提供者）：中斷點設在函式呼叫、迴圈裡的指定敘述上都會停、變數在
