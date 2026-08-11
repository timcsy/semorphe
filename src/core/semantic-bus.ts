import type { SemanticNode } from './types'
import type { ExecutionStatus, StepInfo } from '../interpreter/types'
import type { ExecutionReason, ExecutionAtNodeEvent, SemanticUpdateEvent } from './view-host'
import type { Diagnostic } from './diagnostics'

// ─── Event Type Maps ───

/** Core → View: push events */
export interface SemanticEvents {
  // ⚠️ 引用契約，不再自己宣告一份——見 `view-host.ts` 的 `SemanticUpdateEvent`。
  'semantic:update': SemanticUpdateEvent
  'semantic:full-sync': { tree: SemanticNode; language: string; style: Record<string, unknown> }
  'execution:state': { status: ExecutionStatus; step?: StepInfo; reason?: ExecutionReason }
  'execution:output': { text: string; stream: 'stdout' | 'stderr' }
  'execution:at-node': ExecutionAtNodeEvent
  /**
   * ⚠️ **這條線的方向是刻意反過來的。**
   *
   * 斷點原本是這樣判的：
   *
   * ```ts
   * const breakpoints = monacoPanel.getBreakpoints()          // 行號
   * const hit = breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
   * ```
   *
   * 執行器跟程式碼視圖要**行號**，然後自己做區間比對——於是
   * **執行器知道有「行」這個東西**，而那是文字投影才有的概念。
   *
   * 改成視圖**推**一份 nodeId 集合：斷點落在哪幾個節點上，由懂行號的那一方算。
   * 執行器只問「現在這個節點在不在集合裡」。
   *
   * > **翻譯要發生在懂那個語彙的一端。**
   *
   * 而這讓 2D 接線圖也能推它自己的斷點（「這顆元件被觸發時停」），
   * 不必先有「行」。
   */
  'execution:breakpoints': { nodeIds: string[] }
  'diagnostics:update': { items: Diagnostic[] }
}

/** View → Core: request events */
export interface ViewRequests {
  'edit:code': { code: string }
  'edit:blocks': { blocklyState: unknown }
  'execution:run': { command: 'run' | 'step' | 'stop' | 'reset' }
  'execution:input': { text: string }
  'config:change': { key: string; value: unknown }
}

/** All bus events = SemanticEvents + ViewRequests */
type BusEvents = SemanticEvents & ViewRequests

type Handler<T> = (data: T) => void

// ─── SemanticBus ───

export class SemanticBus {
  private handlers = new Map<string, Set<Handler<unknown>>>()

  /** Subscribe to an event */
  on<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<unknown>)
  }

  /** Unsubscribe from an event */
  off<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): void {
    const set = this.handlers.get(event)
    if (set) {
      set.delete(handler as Handler<unknown>)
    }
  }

  /** Emit an event to all subscribers (error-isolated) */
  emit<K extends keyof BusEvents>(event: K, data: BusEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        handler(data)
      } catch (err) {
        console.error(`[SemanticBus] Error in handler for '${event}':`, err)
      }
    }
  }
}
