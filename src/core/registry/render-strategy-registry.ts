import type { SemanticNode } from '../types'

export interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  extraState?: Record<string, unknown>
}

export interface RenderContext {
  renderBlock: (node: SemanticNode) => BlockState | null
  renderExpression: (node: SemanticNode) => BlockState | null
  renderStatementChain: (nodes: SemanticNode[]) => BlockState | null
  nextBlockId: () => string
}

export type RenderStrategyFn = (node: SemanticNode, ctx: RenderContext) => BlockState | null

export class RenderStrategyRegistry {
  private strategies = new Map<string, RenderStrategyFn>()

  register(name: string, fn: RenderStrategyFn): void {
    this.strategies.set(name, fn)
  }

  get(name: string): RenderStrategyFn | null {
    return this.strategies.get(name) ?? null
  }

  has(name: string): boolean {
    return this.strategies.has(name)
  }
}
