import type { SemanticNode } from './types'
import type { BlockMapping } from './projection/code-generator'
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
   * 這一次執行**到過哪些節點**（跑完才發一次）。
   *
   * ⚠️ 發的是「到過的」不是「沒到過的」：誰算「應該要到」是視圖的知識
   * （它要排掉骨架、排掉還沒同步進樹的積木），執行器不該認得那些。
   */
  /**
   * 這一次執行**到過誰、各幾次**。
   *
   * 🔴 **兩者是同一件事的兩個精度，所以是一個事件不是兩個**：
   * `visited` ＝ `counts` 的鍵。分成兩個事件的話，收的人要自己保證
   * 它們來自**同一次執行**——而那是一個遲早會漏的義務。
   *
   * ⚠️ 廣播的是**到過的**，不是「沒到過的」：誰算「應該要到」是視圖的知識。
   */
  'execution:coverage': { visited: readonly string[]; counts: Readonly<Record<string, number>> }
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
  /**
   * **某個視圖把【樹】改了**（2026-08-26 由 `edit:blocks` 改名）。
   *
   * 🔴 改名的理由：這個事件收的**一直都是一棵樹**（`{ tree, blockMappings }`），
   * 只有名字是視圖專屬的。而流程面板要成為第二個樹形的真相來源時，
   * 照舊命名就會長出 `edit:flow`——**每多一個視圖多一個事件名**。
   *
   * > **一個以視圖命名的事件，會逼下一個視圖也要一個自己的名字。**
   *
   * ⚠️ `viewId` 是**誰改的**，不是「要同步到哪」——收件端用它避免回打自己。
   * `blockMappings` 是那個視圖自己的對映（有就給，沒有就沒有）。
   */
  'edit:tree': { viewId: string; tree: SemanticNode; blockMappings?: BlockMapping[] }
  'execution:run': { command: 'run' | 'step' | 'stop' | 'reset' }
  'execution:input': { text: string }
  /**
   * **把一個執行期變數改成別的值**（2026-08-26）。
   *
   * 🔴 它走匯流排而不是「面板呼叫控制器」，理由與 `execution:input` 同一條：
   * 改狀態的人是**視圖**（變數面板），而執行的人是**執行器**，
   * 兩者之間 P9 只准走這裡（`principles.md:177`「跨層通訊只走 Bus」）。
   *
   * ⚠️ 只在**暫停中**有意義——跑到一半改變數會讓同一支程式跑兩次結果不同，
   * 而那正是 `concepts/模擬的誠實.md:23` 在擋的事。
   */
  'execution:set-variable': { name: string; value: string }
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
