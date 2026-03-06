import type { SourceMapping } from '../core/types'
import type { SemanticModel } from '../core/semantic-model'

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
  // Semantic model sync hooks (T015)
  codeToSemanticModel?: (code: string) => Promise<SemanticModel>
  semanticModelToCode?: (model: SemanticModel) => string
  semanticModelToBlocks?: (model: SemanticModel) => unknown
  blocksToSemanticModel?: (workspace: unknown) => SemanticModel | null
  onSemanticModelUpdated?: (model: SemanticModel) => void
}

export class SyncController {
  private options: SyncControllerOptions
  private syncing = false
  private sourceMappings: SourceMapping[] = []
  private currentModel: SemanticModel | null = null

  constructor(options: SyncControllerOptions) {
    this.options = options
  }

  isSyncing(): boolean {
    return this.syncing
  }

  getSourceMappings(): SourceMapping[] {
    return this.sourceMappings
  }

  setSourceMappings(mappings: SourceMapping[]): void {
    this.sourceMappings = mappings
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

  /** Semantic model accessor (T015) */
  getCurrentModel(): SemanticModel | null {
    return this.currentModel
  }

  /** Set cached semantic model (for style switching) */
  setCurrentModel(model: SemanticModel): void {
    this.currentModel = model
  }

  /** Code → SemanticModel → Blocks sync (T015) */
  async syncCodeToBlocksViaModel(code: string): Promise<void> {
    if (this.syncing) return
    if (!this.options.codeToSemanticModel || !this.options.semanticModelToBlocks) {
      return this.syncCodeToBlocks(code)
    }
    this.syncing = true
    try {
      const model = await this.options.codeToSemanticModel(code)
      this.currentModel = model
      this.options.onSemanticModelUpdated?.(model)
      const workspace = this.options.semanticModelToBlocks(model)
      this.options.setBlocks(workspace)
    } finally {
      this.syncing = false
    }
  }

  /** Blocks → SemanticModel → Code sync (T015) */
  syncBlocksToCodeViaModel(workspace: unknown): void {
    if (this.syncing) return
    if (!this.options.blocksToSemanticModel || !this.options.semanticModelToCode) {
      return this.syncBlocksToCode(workspace)
    }
    this.syncing = true
    try {
      const model = this.options.blocksToSemanticModel(workspace)
      if (model) {
        this.currentModel = model
        this.options.onSemanticModelUpdated?.(model)
        const code = this.options.semanticModelToCode(model)
        this.options.setCode(code)
      }
    } finally {
      this.syncing = false
    }
  }

  destroy(): void {
    // No timers to clean up in manual mode
  }
}
