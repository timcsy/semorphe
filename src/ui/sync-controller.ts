import type { SemanticNode, StylePreset } from '../core/types'
import type { CodingStyle } from '../languages/style'
import {
  detectStyleExceptions, applyStyleConversions,
  analyzeIoConformance,
  type StyleException, type IoConformanceResult,
} from '../languages/cpp/style-exceptions'
import { generateCodeWithMapping } from '../core/projection/code-generator'

/** Convert StylePreset (core/types) → CodingStyle (languages/style) for style exception detection */
function toCodingStyle(preset: StylePreset): CodingStyle {
  return {
    id: preset.id,
    nameKey: preset.id,
    ioPreference: preset.io_style === 'printf' ? 'cstdio' : 'iostream',
    namingConvention: preset.naming_convention,
    braceStyle: preset.brace_style,
    indent: preset.indent_size,
    useNamespaceStd: preset.namespace_style === 'using',
    headerStyle: preset.header_style === 'bits' ? 'bits' : 'iostream',
  }
}
import type { SourceMapping } from '../core/projection/code-generator'
import { renderToBlocklyState } from '../core/projection/block-renderer'
import { Lifter } from '../core/lift/lifter'
import { SemanticBus } from '../core/semantic-bus'

export interface CodeParser {
  parse(code: string): { rootNode: unknown }
}

export class SyncController {
  private bus: SemanticBus
  private language: string
  private style: StylePreset
  private currentTree: SemanticNode | null = null
  private lifter: Lifter | null = null
  private parser: CodeParser | null = null
  private syncing = false
  private sourceMappings: SourceMapping[] = []
  private onErrorCallback: ((errors: SyncError[]) => void) | null = null
  private onStyleExceptionsCallback: ((exceptions: StyleException[], apply: () => void) => void) | null = null
  private onIoConformanceCallback: ((result: IoConformanceResult) => void) | null = null
  private codingStyle: CodingStyle | null = null

  constructor(
    bus: SemanticBus,
    language: string,
    style: StylePreset,
  ) {
    this.bus = bus
    this.language = language
    this.style = style

    // Subscribe to view requests
    bus.on('edit:blocks', (data) => this.handleEditBlocks(data))
    bus.on('edit:code', (data) => this.handleEditCode(data))
  }

  /** Set lifter and parser for code→blocks direction (US2) */
  setCodeToBlocksPipeline(lifter: Lifter, parser: CodeParser): void {
    this.lifter = lifter
    this.parser = parser
  }

  onError(callback: (errors: SyncError[]) => void): void {
    this.onErrorCallback = callback
  }

  onStyleExceptions(callback: (exceptions: StyleException[], apply: () => void) => void): void {
    this.onStyleExceptionsCallback = callback
  }

  /** Called when code→blocks detects I/O style non-conformance (借音 or 轉調) */
  onIoConformance(callback: (result: IoConformanceResult) => void): void {
    this.onIoConformanceCallback = callback
  }

  setCodingStyle(preset: StylePreset): void {
    this.codingStyle = toCodingStyle(preset)
  }

  /** Handle edit:blocks event — sync blocks → semantic tree → code */
  private handleEditBlocks(data: { blocklyState: unknown }): void {
    if (this.syncing) return
    this.syncing = true
    try {
      const blocklyState = data.blocklyState as { tree: SemanticNode }
      const tree = blocklyState.tree
      this.currentTree = tree
      const { code, mappings } = generateCodeWithMapping(tree, this.language, this.style)
      this.sourceMappings = mappings
      this.bus.emit('semantic:update', { tree, code, source: 'blocks', mappings })
    } finally {
      this.syncing = false
    }
  }

  /** Handle edit:code event — sync code → semantic tree → blocks */
  private handleEditCode(data: { code: string }): void {
    if (this.syncing || !this.lifter || !this.parser) return
    this.syncing = true
    try {
      const code = data.code
      const parseResult = this.parser.parse(code)
      const rootNode = parseResult.rootNode as import('../core/lift/types').AstNode

      // Check for parse errors
      const errors = this.findErrors(rootNode)
      if (errors.length > 0) {
        this.onErrorCallback?.(errors)
      }

      // Code-level I/O conformance check (before lift — 借音/轉調 detection)
      let ioResult: IoConformanceResult | null = null
      if (this.codingStyle) {
        const result = analyzeIoConformance(code, this.codingStyle.ioPreference)
        if (result.verdict !== 'conforming') {
          ioResult = result
        }
      }

      let tree = this.lifter.lift(rootNode)
      if (!tree) return

      // Semantic-level style exception check (after lift — toolbox block mismatches)
      let semanticExceptions: StyleException[] = []
      let applySemanticConversions: (() => void) | null = null
      if (this.codingStyle) {
        const exceptions = detectStyleExceptions(tree, this.codingStyle)
        if (exceptions.length > 0) {
          semanticExceptions = exceptions
          const currentTree = tree
          applySemanticConversions = () => {
            const converted = applyStyleConversions(currentTree, exceptions)
            this.currentTree = converted
            const blockState = renderToBlocklyState(converted)
            this.bus.emit('semantic:update', { tree: converted, blockState, source: 'code' })
            this.sourceMappings = this.buildMappingsFromTree(converted, blockState)
          }
        }
      }

      // Fire callbacks — prioritize bulk deviation (轉調) over semantic exceptions over minor exception (借音)
      if (ioResult?.verdict === 'bulk_deviation' && this.onIoConformanceCallback) {
        this.onIoConformanceCallback(ioResult)
      } else if (semanticExceptions.length > 0 && this.onStyleExceptionsCallback && applySemanticConversions) {
        this.onStyleExceptionsCallback(semanticExceptions, applySemanticConversions)
      } else if (ioResult?.verdict === 'minor_exception' && this.onIoConformanceCallback) {
        this.onIoConformanceCallback(ioResult)
      }

      this.currentTree = tree
      const blockState = renderToBlocklyState(tree)
      this.bus.emit('semantic:update', { tree, blockState, source: 'code' })

      // Build source mappings from semantic tree sourceRange + rendered block IDs
      this.sourceMappings = this.buildMappingsFromTree(tree, blockState)
    } finally {
      this.syncing = false
    }
  }

  /** Convenience: trigger blocks→code sync from external code (e.g., app.ts) */
  syncBlocksToCode(tree?: SemanticNode): void {
    const t = tree ?? this.currentTree
    if (!t) return
    this.handleEditBlocks({ blocklyState: { tree: t } })
  }

  /** Convenience: trigger code→blocks sync from external code (e.g., app.ts) */
  syncCodeToBlocks(code?: string): boolean {
    if (!this.lifter || !this.parser) return false
    if (code !== undefined) {
      this.handleEditCode({ code })
      return true
    }
    return false
  }

  getCurrentTree(): SemanticNode | null {
    return this.currentTree
  }

  getBus(): SemanticBus {
    return this.bus
  }

  setStyle(style: StylePreset): void {
    this.style = style
  }

  setLanguage(language: string): void {
    this.language = language
  }

  isSyncing(): boolean {
    return this.syncing
  }

  /** Rebuild source mappings — requires bus to request current blocks state */
  rebuildSourceMappings(tree?: SemanticNode): void {
    try {
      const t = tree ?? this.currentTree
      if (!t) return
      const { mappings } = generateCodeWithMapping(t, this.language, this.style)
      this.sourceMappings = mappings
    } catch {
      // silently ignore — mappings may be stale but that's acceptable
    }
  }

  getSourceMappings(): SourceMapping[] {
    return [...this.sourceMappings]
  }

  getMappingForBlock(blockId: string): SourceMapping | null {
    return this.sourceMappings.find(m => m.blockId === blockId) ?? null
  }

  getMappingForLine(line: number): SourceMapping | null {
    let best: SourceMapping | null = null
    for (const m of this.sourceMappings) {
      if (line >= m.startLine && line <= m.endLine) {
        if (!best || (m.endLine - m.startLine) < (best.endLine - best.startLine)) {
          best = m
        }
      }
    }
    return best
  }

  /** Walk semantic tree and block state in parallel to build blockId→sourceRange mappings */
  private buildMappingsFromTree(
    tree: SemanticNode,
    blockState: { blocks: { blocks: unknown[] } },
  ): SourceMapping[] {
    const mappings: SourceMapping[] = []
    const body = tree.children.body ?? []
    if (body.length === 0 || blockState.blocks.blocks.length === 0) return mappings

    interface BlockNode { id: string; inputs?: Record<string, { block?: BlockNode }>; next?: { block?: BlockNode } }

    // Semantic child key → possible block input names
    const childToInput: Record<string, string[]> = {
      body: ['BODY', 'DO'],
      then_body: ['THEN', 'BODY'],
      else_body: ['ELSE'],
      condition: ['COND', 'CONDITION'],
      from: ['FROM'],
      to: ['TO'],
      value: ['VALUE', 'EXPR'],
      args: ['ARG0', 'ARG1', 'ARG2'],
      left: ['A'],
      right: ['B'],
    }

    const findBlockInput = (block: BlockNode, semKey: string): BlockNode | undefined => {
      if (!block.inputs) return undefined
      const candidates = childToInput[semKey] ?? [semKey.toUpperCase()]
      for (const name of candidates) {
        if (block.inputs[name]?.block) return block.inputs[name].block
      }
      return undefined
    }

    const walkChain = (nodes: SemanticNode[], firstBlock: BlockNode | undefined): void => {
      let currentBlock = firstBlock
      for (const node of nodes) {
        if (!currentBlock) break
        walkPair(node, currentBlock)
        currentBlock = currentBlock.next?.block
      }
    }

    const walkPair = (node: SemanticNode, block: BlockNode): void => {
      const sr = node.metadata?.sourceRange as { startLine: number; endLine: number } | undefined
      if (sr) {
        mappings.push({ blockId: block.id, startLine: sr.startLine, endLine: sr.endLine })
      }
      // Recurse into all children
      for (const [key, children] of Object.entries(node.children)) {
        if (!children || children.length === 0) continue
        const inputBlock = findBlockInput(block, key)
        if (!inputBlock) continue
        // Statement chains: children with multiple nodes linked by .next
        if (children.length > 1 || key.includes('body')) {
          walkChain(children, inputBlock)
        } else {
          // Single expression child
          walkPair(children[0], inputBlock)
        }
      }
    }

    walkChain(body, blockState.blocks.blocks[0] as BlockNode | undefined)
    return mappings
  }

  private findErrors(node: import('../core/lift/types').AstNode): SyncError[] {
    const errors: SyncError[] = []
    this.walkForErrors(node, errors)
    return errors
  }

  private walkForErrors(node: import('../core/lift/types').AstNode, errors: SyncError[]): void {
    if (node.type === 'ERROR') {
      errors.push({
        message: `Syntax error at line ${node.startPosition.row + 1}`,
        line: node.startPosition.row,
        column: node.startPosition.column,
        text: node.text,
      })
    }
    for (const child of node.children) {
      this.walkForErrors(child, errors)
    }
  }
}

export interface SyncError {
  message: string
  line: number
  column: number
  text: string
}
