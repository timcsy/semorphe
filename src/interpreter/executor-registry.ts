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

  register(concept: string, executor: ConceptExecutor): void {
    this.executors.set(concept, executor)
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
