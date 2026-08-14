import type { SemanticNode } from './types'
import type { ExecutionStatus, StepInfo } from '../interpreter/types'
import type { CodeMapping } from './projection/code-generator'
import type { ScaffoldResult } from './program-scaffold'

// ─── View Configuration ───

export interface ViewConfig {
  language: string
  style?: Record<string, unknown>
}

// ─── View Capabilities ───

export interface ViewCapabilities {
  editable: boolean
  needsLanguageProjection: boolean
  consumedAnnotations: string[]
}

// ─── Events: Core → View ───

/**
 * ⚠️ **這個型別在 2026-08-12 之前只有 `tree` 一個欄位**，而匯流排上的
 * `'semantic:update'` 有六個。同一個事件，兩份宣告。
 *
 * 症狀不是型別錯誤——是**每個面板在自己的方法簽名上手動補回缺的欄位**：
 *
 * ```ts
 * onSemanticUpdate(event: SemanticUpdateEvent & { source?: string; code?: string; … })
 * ```
 *
 * > **一份不完整的契約不會擋住任何人，它只會讓每個實作者各自補一次
 * > ——而他們補的不一樣。**
 *
 * （`monaco-panel` 補了 `source`／`code`／`scaffoldResult`，
 * 沒補 `mappings`，於是它**看不到那個欄位存在**。而 `mappings` 正是它
 * 把「執行到哪個節點」翻成行號所需要的東西。）
 *
 * 現在契約是唯一定義，`semantic-bus` 引用它。
 */
export interface SemanticUpdateEvent {
  tree: SemanticNode
  code?: string
  blockState?: unknown
  source: 'blocks' | 'code' | 'resync'
  mappings?: CodeMapping[]
  scaffoldResult?: ScaffoldResult
}

/**
 * ⚠️ **`reason` 存在的理由：讓「顯示什麼字」留在視圖裡。**
 *
 * 在此之前執行器直接呼叫 `consolePanel.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')`
 * ——**24 處**，而那 24 處只有 8 種狀態。執行器在替視圖決定文案、決定 CSS class、
 * 甚至決定要查哪一個 i18n 鍵。
 *
 * > **一個知道對方要顯示什麼字的發送端，換不掉那個接收端。**
 *
 * 拆法是「真實／為什麼」兩層：`status` 是直譯器**真的處在哪個狀態**
 * （它本來就有這個型別），`reason` 是**為什麼**。8 種 UI 狀態落在 5×reason 上：
 *
 * | 今天顯示 | status | reason |
 * |---|---|---|
 * | Ready | `idle` | — |
 * | Running | `running` | — |
 * | Waiting for input... | `running` | `awaiting-input` |
 * | Paused | `paused` | — |
 * | Paused (breakpoint) | `paused` | `breakpoint` |
 * | Completed | `completed` | — |
 * | Interrupted | `idle` | `aborted` |
 * | Error | `error` | — |
 *
 * ⚠️ **詞彙是封閉的**——三個值。第四個值出現時要先問「它是不是一個新的 `status`」，
 * 而不是順手加進來（`concepts/執行機構.md:263` 的同一條：
 * 「宣告需要門檻……第三個值就是在替『還沒做』找一個體面的名字」）。
 */
export type ExecutionReason = 'awaiting-input' | 'breakpoint' | 'aborted'

export interface ExecutionStateEvent {
  status: ExecutionStatus
  step?: StepInfo
  reason?: ExecutionReason
}

/**
 * **執行走到了某個語義節點。**
 *
 * ⚠️ 這個事件存在的理由，是它取代的那段程式碼：
 *
 * ```ts
 * const mapping = syncController.getMappingForNode(nodeId)   // { blockId, startLine, endLine }
 * if (mapping.blockId)   blocklyPanel.highlightBlock(mapping.blockId, 'execution')
 * if (mapping.startLine) monacoPanel.revealLine(mapping.startLine + 1)
 * ```
 *
 * 執行器同時說了兩遍，**因為它知道有兩個視圖**。而那張中央對映表
 * 回傳的是兩個視圖的座標——加第三個視圖要改它的型別。
 *
 * > **一張「什麼都查得到」的中央對映表，就是視圖清單的另一種寫法。**
 *
 * 唯一真實是「執行到哪個節點」；積木高亮一顆積木、程式碼捲到一行、
 * 2D 接線圖讓一顆元件發光——**那是三個投影，不是三個命令**。
 *
 * - `nodeId: null` ＝ **清除**（執行結束／等待輸入前的清場）。
 * - `follow` ＝ 這一步使用者要不要跟著看。⚠️ 它**不是**「你要捲動」——
 *   對 2D 視圖它可以是「把鏡頭移過去」。開關長在除錯工具列上，
 *   而**開關在哪裡就說明了它屬於誰**：那是對「執行」的指令，不是視圖設定。
 */
export interface ExecutionAtNodeEvent {
  nodeId: string | null
  follow: boolean
}

// ─── ViewHost Interface ───

export interface ViewHost {
  readonly viewId: string
  readonly viewType: string
  readonly capabilities: ViewCapabilities

  initialize(config: ViewConfig): Promise<void>
  dispose(): void

  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionState(event: ExecutionStateEvent): void

  /**
   * 執行走到了某個節點。**可選**——不是每個視圖都在意。
   *
   * ⚠️ 它是可選的而不是「必要但可以空實作」，理由是這個專案的頭號病：
   * **一個空樁與一個「我不接這個事件」的宣告，在程式碼裡長得一樣，
   * 而在意圖上完全相反。** 沒有這個方法 ＝ 明確地不接。
   */
  onExecutionAtNode?(event: ExecutionAtNodeEvent): void

  /**
   * 診斷變了。**可選**——理由與 `onExecutionAtNode` 同一條：
   * 沒有這個方法 ＝ 明確地不接（主控台、變數面板不需要）。
   *
   * ⚠️ 它是**廣播**不是命令：狀態變了，誰想知道誰聽。
   * 所以**不該**是 `monacoPanel.showSquiggle(...)`——那會讓執行端知道
   * 每個視圖該畫什麼，而那正是 `execution:at-node` 那次收攏掉的東西。
   */
  onDiagnostics?(event: DiagnosticsEvent): void
}

/** 一次診斷的結果。空陣列 ＝ 沒有問題（**不是**「沒有跑」）。 */
export interface DiagnosticsEvent {
  diagnostics: readonly { nodeId: string; severity: 'warning' | 'error'; message: string }[]
}
