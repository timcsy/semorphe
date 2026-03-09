import type { SemanticNode } from './types'
import type { ExecutionStatus, StepInfo } from '../interpreter/types'
import type { Diagnostic } from './diagnostics'

// ─── Event Type Maps ───

/** Core → View: push events */
export interface SemanticEvents {
  'semantic:update': { tree: SemanticNode }
  'semantic:full-sync': { tree: SemanticNode; language: string; style: Record<string, unknown> }
  'execution:state': { status: ExecutionStatus; step?: StepInfo }
  'execution:output': { text: string; stream: 'stdout' | 'stderr' }
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
