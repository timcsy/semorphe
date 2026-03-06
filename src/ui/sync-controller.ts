import type { SemanticNode, StylePreset } from '../core/types'
import { generateCode } from '../core/projection/code-generator'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { MonacoPanel } from './panels/monaco-panel'

export class SyncController {
  private blocklyPanel: BlocklyPanel
  private monacoPanel: MonacoPanel
  private language: string
  private style: StylePreset
  private currentTree: SemanticNode | null = null

  constructor(
    blocklyPanel: BlocklyPanel,
    monacoPanel: MonacoPanel,
    language: string,
    style: StylePreset,
  ) {
    this.blocklyPanel = blocklyPanel
    this.monacoPanel = monacoPanel
    this.language = language
    this.style = style
  }

  /** Sync blocks → semantic tree → code (US1 direction) */
  syncBlocksToCode(): void {
    const tree = this.blocklyPanel.extractSemanticTree()
    this.currentTree = tree
    const code = generateCode(tree, this.language, this.style)
    this.monacoPanel.setCode(code)
  }

  getCurrentTree(): SemanticNode | null {
    return this.currentTree
  }

  setStyle(style: StylePreset): void {
    this.style = style
  }

  setLanguage(language: string): void {
    this.language = language
  }
}
