import type { SemanticNode } from '../types'

export interface BlockExtractContext {
  extractBlock(block: unknown): SemanticNode | null
  extractStatementInput(block: unknown, inputName: string): SemanticNode[]
  extractFuncArgs(block: unknown): SemanticNode[]
}

export type BlockExtractorFn = (block: unknown, ctx: BlockExtractContext) => SemanticNode | null

export class BlockExtractorRegistry {
  private extractors = new Map<string, BlockExtractorFn>()

  register(blockType: string, fn: BlockExtractorFn): void {
    this.extractors.set(blockType, fn)
  }

  get(blockType: string): BlockExtractorFn | null {
    return this.extractors.get(blockType) ?? null
  }

  has(blockType: string): boolean {
    return this.extractors.has(blockType)
  }

  get size(): number {
    return this.extractors.size
  }

  types(): string[] {
    return [...this.extractors.keys()]
  }
}
