import type { SemanticNode } from '../core/types'
import type { RuntimeValue, FunctionDef } from './types'
import type { Scope } from './scope'
import type { IOSystem } from './io'

/**
 * ExecutionContext — passed to each executor, wraps interpreter internal state.
 */
export interface ExecutionContext {
  scope: Scope
  io: IOSystem
  functions: Map<string, FunctionDef>
  pointerTargets: Map<string, Scope>
  scanfTokenBuffer: string[]
  executeNode(node: SemanticNode): Promise<RuntimeValue | void>
  executeBody(nodes: SemanticNode[]): Promise<void>
  evaluate(node: SemanticNode): Promise<RuntimeValue>
  countStep(): Promise<void>
  toBool(val: RuntimeValue): boolean
  toNumber(val: RuntimeValue): number
  coerceType(val: RuntimeValue, targetType: string): RuntimeValue
  /** Await input from provider with abort support. Returns null on EOF. */
  awaitInput(): Promise<string | null>
  /** Read a cin token (whitespace-delimited) from buffer or IO */
  readCinToken(): string | null
  /** Read a scanf token from buffer or IO */
  readScanfToken(): string | null
}

/**
 * Unified executor signature.
 */
export type ConceptExecutor = (node: SemanticNode, ctx: ExecutionContext) => Promise<RuntimeValue | void>

/**
 * Registry for concept executors.
 */
export class ConceptExecutorRegistry {
  private executors = new Map<string, ConceptExecutor>()
  /** 同一概念被註冊幾次。>1 代表勝負由載入順序決定，而那個順序不是任何人設計的 */
  private registrationCount = new Map<string, number>()

  register(concept: string, executor: ConceptExecutor): void {
    this.registrationCount.set(concept, (this.registrationCount.get(concept) ?? 0) + 1)
    this.executors.set(concept, executor)
  }

  /**
   * 被註冊超過一次的概念。
   *
   * **不在註冊時報錯**——那會讓既有的載入順序相依一次炸開。這裡只讓它可見，
   * 逐一消除排在後面。見 knowledge/history/017（加嚴之前先回答「被拒絕的
   * 東西去哪了」，而這裡的答案目前是「不知道」）。
   */
  duplicates(): { concept: string; count: number }[] {
    return [...this.registrationCount.entries()]
      .filter(([, n]) => n > 1)
      .map(([concept, count]) => ({ concept, count }))
      .sort((a, b) => b.count - a.count || a.concept.localeCompare(b.concept))
  }

  registerAll(map: Record<string, ConceptExecutor>): void {
    for (const [concept, executor] of Object.entries(map)) {
      this.executors.set(concept, executor)
    }
  }

  get(concept: string): ConceptExecutor | undefined {
    return this.executors.get(concept)
  }

  has(concept: string): boolean {
    return this.executors.has(concept)
  }
}
