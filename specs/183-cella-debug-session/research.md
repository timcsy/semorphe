# Research: Cella 的除錯工作階段（spec 183）

## R1. 控制器的模型：保留「每步回呼」，還是改成「宿主下指令」

量測（`tests/probes/cella-dap-cost.test.ts`，`CELLA_DAP_PROBE=1`，Node，cella 0.1.202610310706，50 圈迴圈）：

| | 時間 |
|---|---|
| DAP 模組編譯 | 18–28 秒，4.9 MB |
| `stepIn` | 每步 3.5 ms（206 步 0.73 秒） |
| `launch` 跑到底 | 28 ms |
| 停點的 node 對回語義樹 | 8／8 |

- **Decision**：介面改成 DAP 的形狀（宿主下指令）——`ExecutionSession` 換成 `launch`／`continue`／`stepIn`／`pause`／`terminate`、
  `setBreakpoints`、`variables`、`supplyInput`、停下事件帶 `{ reason, nodeId, detail }`。
  JS 直譯器的提供者照這個形狀包（它今天的回呼模型在提供者裡面轉換）。
  「執行」＝`continue`＋中斷點；「單步」＝`stepIn`；「逐步重播」（今天的 `runWithSteps` 先錄再播）改成邊走邊播（`stepIn` 每步 3.5 ms，夠快）。
- **Rationale**：保留回呼模型 ⟹ Cella 那側每一步都要 `stepIn`，執行慢 25 倍；而 DAP 是 Cella 承諾的介面，也是 VSCode 的語彙。
  P8 不做向後相容：介面換一次，兩個提供者都照新形狀。
- **Alternatives**：① 保留回呼、Cella 提供者內部 `stepIn` 迴圈——執行慢 25 倍，否決。
  ② 兩種模型並存——控制器要認得兩套，否決。

## R2. 覆蓋標記（「這塊沒跑到」、每塊幾次）

- 今天由 JS 直譯器的 `visitCounts()` 給。DAP 的 `continue` 拿不到；用 `stepIn` 數會慢 25 倍。
- **Decision（暫定）**：已向 cella 提需求（`run` 順便給每個節點標籤的進入次數，2026-10-31）。
  回覆之前：Cella 跑的那次**不標覆蓋**，結果的 `missing` 帶 `steps`，畫面說「這次沒有覆蓋資料」（P6：缺了要看得見）。

## R3. 退回 JS 直譯器的時機與出處

- **Decision**：控制器向登錄表要 `session`；Cella 提供者對「翻不出來／未就緒／無法使用」回一個說得出原因的「不接」，
  登錄表往下找下一個宣告 `session` 的提供者（JS 直譯器）。結果帶 `provenance` 與退回原因，狀態列顯示。
- **Rationale**：設計 draft 五之一「退回……並在結果上標出處」；`experience`〈組裝漏一步的症狀是降級，不是錯誤〉——安靜的退回沒有人會發現。

## R4. 編譯與快取

- DAP 模組與判決模組分開編（匯出不同），同一個 worker、同一個 IndexedDB store，鍵各自帶「套件版本＋模組原始碼」。
- 判決模組已在 5a 的 worker 裡；DAP 模組第一次按「執行」時才編（不在暖機時一起編——多 20 秒，而多數學生先寫再跑）。
  ⚠️ 第一次按執行的那 20 秒由 JS 直譯器跑（R3 的「未就緒」），同時在背景編好，下一次就是 Cella。
