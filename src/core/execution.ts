/**
 * **執行這件事的共同詞彙**——狀態、速度、一步是什麼、執行期有哪些型別。
 *
 * ## 🔴 它為什麼在 `core/` 而不在 `interpreter/`
 *
 * 這四個名字在 2026-09-13 之前住在 `interpreter/types.ts`，而 `core/` 的四個檔
 * 反過來去 import 它們：
 *
 * ```
 * core/sync/view-host.ts          ← ExecutionStatus, StepInfo
 * core/sync/semantic-bus.ts       ← ExecutionStatus, StepInfo
 * core/sync/step-controller.ts    ← ExecutionSpeed
 * core/language-executors.ts ← RuntimeType
 * ```
 *
 * 於是 `src/core` 與 `src/interpreter` **互相依賴**——兩個平級目錄之間的環。
 * ⚠️ 而分層護欄看不到它：`FORBIDDEN.core` 列的是 `ui／languages／components／vscode`，
 * 沒有 `interpreter`。
 *
 * > **兩個互相依賴的目錄，是一個模組被切成兩半。**
 *
 * ## 🟢 判準：誰在講這些字
 *
 * 講 `ExecutionStatus` 的是**匯流排與視圖**（「現在在跑嗎」是一則廣播），
 * 不是直譯器的私事。直譯器是它的**第一個實作**，而不是它的擁有者。
 *
 * 這一條與 `core/host/` 那十個埠是同一個形狀：**核心宣告角色，實作在外面。**
 * 而它也是「外部執行器」進得來的前提——一個跑在伺服器上或板子上的執行器，
 * 要能說出同一組狀態，而不必 import 內建的直譯器。
 */

/** 執行狀態 */
export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

/** 執行速度 */
export type ExecutionSpeed = 'slow' | 'medium' | 'fast'

/**
 * 執行期型別的詞彙。
 *
 * ⚠️ 它是**跨語言**的（`core/language-executors.ts` 拿它宣告內建函式的簽章），
 * 所以它不屬於任何一個語言套件，也不屬於直譯器。
 */
export type RuntimeType =
  | 'int' | 'float' | 'double' | 'char' | 'string' | 'bool'
  | 'void' | 'array' | 'pointer' | 'object' | 'function'

/** 步進回呼資訊——**一步是什麼**，由廣播那一側定義。 */
export interface StepInfo {
  node: import('./types').SemanticNode
  nodeId: string
  sourceRange: { start: number; end: number } | null
  outputLength: number
  scopeSnapshot: { name: string; type: string; value: string }[]
}
