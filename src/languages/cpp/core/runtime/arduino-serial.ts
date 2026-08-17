/**
 * **序列埠開過了沒**——一個布林，而它今天只有一個未來的消費者。
 *
 * 🔴 **而那正是「機制有了沒人接上」的溫床**，所以它刻意**不是一個機制**：
 * 一個 `WeakSet`、兩個函式，沒有登錄表、沒有事件、沒有設定。
 *
 * 為什麼記它：真板子上 `Serial.println` 之前沒有 `Serial.begin`，
 * **什麼都不會出現**——而那是初學者最常撞、最難查的一個坑。
 * ⚠️ **本輪不擋也不警告**（模擬器照樣輸出），只是把事實記下來，
 * 讓語義診斷系統之後接得上。
 */
import type { ExecutionContext } from '../../../../interpreter/executor-registry'

const opened = new WeakSet<object>()

export function markSerialOpen(ctx: ExecutionContext): void {
  opened.add(ctx as object)
}

export function isSerialOpen(ctx: ExecutionContext): boolean {
  return opened.has(ctx as object)
}
