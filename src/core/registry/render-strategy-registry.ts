import type { SemanticNode } from '../types'

export interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  /**
   * **積木上的註解泡泡**——Blockly 自己的欄位（`icons.comment`）。
   *
   * 🔴 使用者寫的行末註解住在這裡，**不住在 `extraState`**：
   * 沒有 mutation 的積木**根本沒有 `extraState` 這條路**（Blockly 只在積木
   * 自己實作 `save/loadExtraState` 時才理它），於是那些註解會在
   * 「積木→程式碼」之後安靜消失。
   *
   * 🟢 而註解泡泡是 Blockly 原生會存檔的東西，**而且使用者看得到、改得動**。
   */
  icons?: { comment?: { text: string; pinned?: boolean; height?: number; width?: number } }
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
