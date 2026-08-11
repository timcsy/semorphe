import type { SemanticNode } from './types'
import type { ExecutionStatus, StepInfo } from '../interpreter/types'

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

export interface SemanticUpdateEvent {
  tree: SemanticNode
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

// ─── ViewHost Interface ───

export interface ViewHost {
  readonly viewId: string
  readonly viewType: string
  readonly capabilities: ViewCapabilities

  initialize(config: ViewConfig): Promise<void>
  dispose(): void

  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionState(event: ExecutionStateEvent): void
}
