import type { AstNode, LiftContext } from '../lift/types'
import type { SemanticNode } from '../types'

export type LiftStrategyFn = (node: AstNode, ctx: LiftContext) => SemanticNode | null

export class LiftStrategyRegistry {
  private strategies = new Map<string, LiftStrategyFn>()

  register(name: string, fn: LiftStrategyFn): void {
    this.strategies.set(name, fn)
  }

  get(name: string): LiftStrategyFn | null {
    return this.strategies.get(name) ?? null
  }

  has(name: string): boolean {
    return this.strategies.has(name)
  }
}
