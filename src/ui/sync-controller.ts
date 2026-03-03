import type { SourceMapping } from '../core/types'

export interface SyncControllerOptions {
  blocksToCode: (workspace: unknown) => string
  codeToBlocks: (code: string) => Promise<unknown>
  codeToBlocksWithMappings?: (code: string) => Promise<{ workspace: unknown; mappings: SourceMapping[] }>
  setCode: (code: string) => void
  setBlocks: (workspace: unknown) => void
  highlightCodeLines?: (startLine: number, endLine: number) => void
  clearCodeHighlight?: () => void
  highlightBlock?: (blockId: string) => void
  clearBlockHighlight?: () => void
}

export class SyncController {
  private options: SyncControllerOptions
  private syncing = false
  private sourceMappings: SourceMapping[] = []

  constructor(options: SyncControllerOptions) {
    this.options = options
  }

  isSyncing(): boolean {
    return this.syncing
  }

  getSourceMappings(): SourceMapping[] {
    return this.sourceMappings
  }

  syncBlocksToCode(workspace: unknown): void {
    if (this.syncing) return
    this.syncing = true
    try {
      const code = this.options.blocksToCode(workspace)
      this.options.setCode(code)
    } finally {
      this.syncing = false
    }
  }

  async syncCodeToBlocks(code: string): Promise<void> {
    if (this.syncing) return
    this.syncing = true
    try {
      if (this.options.codeToBlocksWithMappings) {
        const { workspace, mappings } = await this.options.codeToBlocksWithMappings(code)
        this.sourceMappings = mappings
        this.options.setBlocks(workspace)
      } else {
        const workspace = await this.options.codeToBlocks(code)
        this.options.setBlocks(workspace)
      }
    } finally {
      this.syncing = false
    }
  }

  /** 積木被選取時，高亮對應的程式碼行 */
  onBlockSelected(blockId: string): void {
    const mapping = this.sourceMappings.find(m => m.blockId === blockId)
    if (mapping && this.options.highlightCodeLines) {
      this.options.highlightCodeLines(mapping.startLine, mapping.endLine)
    }
  }

  /** 積木取消選取時，清除高亮 */
  onBlockDeselected(): void {
    this.options.clearCodeHighlight?.()
  }

  /** 程式碼游標變更時，高亮對應的積木 */
  onCodeCursorChange(line: number): void {
    const mapping = this.sourceMappings.find(
      m => line >= m.startLine && line <= m.endLine
    )
    if (mapping && this.options.highlightBlock) {
      this.options.highlightBlock(mapping.blockId)
    } else {
      this.options.clearBlockHighlight?.()
    }
  }

  destroy(): void {
    // No timers to clean up in manual mode
  }
}
