import type { SemanticNode, StylePreset, CognitiveLevel } from '../core/types'
import type { ProgramScaffold, ScaffoldResult } from '../core/program-scaffold'
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
import type { CodeMapping, BlockMapping } from '../core/projection/code-generator'
import { renderToBlocklyState } from '../core/projection/block-renderer'
// createNode no longer needed here — stripScaffoldNodes moved to cpp-scaffold-filter.ts
import { Lifter } from '../core/lift/lifter'
import { SemanticBus } from '../core/semantic-bus'

/** Scaffold node filter type — strips scaffold nodes for L0 display */
export type ScaffoldNodeFilter = (tree: SemanticNode) => SemanticNode

/** Default no-op filter (returns tree as-is) */
function identityFilter(tree: SemanticNode): SemanticNode {
  return tree
}

/**
 * @deprecated Use cppStripScaffoldNodes from languages/cpp/cpp-scaffold-filter.ts via setScaffoldNodeFilter.
 * Delegates to the injected scaffold node filter (for backward compatibility).
 */
export { cppStripScaffoldNodes as stripScaffoldNodes } from '../languages/cpp/cpp-scaffold-filter'


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
  private codeMappings: CodeMapping[] = []
  private blockMappings: BlockMapping[] = []
  private onErrorCallback: ((errors: SyncError[]) => void) | null = null
  private onStyleExceptionsCallback: ((exceptions: StyleException[], apply: () => void) => void) | null = null
  private onIoConformanceCallback: ((result: IoConformanceResult) => void) | null = null
  private codingStyle: CodingStyle | null = null
  private programScaffold: ProgramScaffold | null = null
  private cognitiveLevel: CognitiveLevel = 1
  private codePatcherFn: ((code: string, tree: SemanticNode) => string | null) | null = null
  private scaffoldNodeFilter: ScaffoldNodeFilter = identityFilter

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

  setProgramScaffold(scaffold: ProgramScaffold): void {
    this.programScaffold = scaffold
  }

  setCognitiveLevel(level: CognitiveLevel): void {
    this.cognitiveLevel = level
  }

  /** Set the scaffold node filter for L0 display (strip scaffold from blocks) */
  setScaffoldNodeFilter(fn: ScaffoldNodeFilter): void {
    this.scaffoldNodeFilter = fn
  }

  /** Set a language-specific code patcher for auto-fixing missing dependencies after code→blocks */
  setCodePatcher(fn: (code: string, tree: SemanticNode) => string | null): void {
    this.codePatcherFn = fn
  }

  /** Patch code with missing dependencies (e.g. #include). Returns patched code or null if unchanged. */
  patchMissingDependencies(code: string): string | null {
    if (!this.codePatcherFn || !this.currentTree) return null
    return this.codePatcherFn(code, this.currentTree)
  }

  /** Set block mappings from external source (e.g., blockly-panel extraction) */
  setBlockMappings(mappings: BlockMapping[]): void {
    this.blockMappings = mappings
  }


  /** Handle edit:blocks event — sync blocks → semantic tree → code */
  private handleEditBlocks(data: { blocklyState: unknown }): void {
    if (this.syncing) return
    this.syncing = true
    try {
      const blocklyState = data.blocklyState as { tree: SemanticNode; blockMappings?: BlockMapping[] }
      const tree = blocklyState.tree
      this.currentTree = tree
      const { code, mappings } = generateCodeWithMapping(tree, this.language, this.style)
      this.codeMappings = mappings

      // Use blockMappings from extraction if provided
      if (blocklyState.blockMappings) {
        this.blockMappings = blocklyState.blockMappings
      }


      // Compute scaffold result for ghost line decorations
      let scaffoldResult: ScaffoldResult | undefined
      if (this.programScaffold) {
        scaffoldResult = this.programScaffold.resolve(tree, {
          cognitiveLevel: this.cognitiveLevel,
        })
      }

      this.bus.emit('semantic:update', { tree, code, source: 'blocks', mappings, scaffoldResult })
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
            const { mappings: convMappings } = generateCodeWithMapping(converted, this.language, this.style)
            this.codeMappings = convMappings
            const convDisplay = this.cognitiveLevel === 0 ? this.scaffoldNodeFilter(converted) : converted
            const convRender = renderToBlocklyState(convDisplay)
            this.blockMappings = convRender.blockMappings
      
            this.bus.emit('semantic:update', { tree: converted, blockState: convRender, source: 'code' })
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

      // Build codeMappings directly from lifted tree (node.id always available — no blockId dependency)
      const { mappings: codeMappings } = generateCodeWithMapping(tree, this.language, this.style)
      this.codeMappings = codeMappings

      // For L0: strip scaffold nodes so blocks only show user's logic
      const displayTree = this.cognitiveLevel === 0 ? this.scaffoldNodeFilter(tree) : tree
      const renderResult = renderToBlocklyState(displayTree)
      this.blockMappings = renderResult.blockMappings


      this.bus.emit('semantic:update', { tree, blockState: renderResult, source: 'code' })
    } finally {
      this.syncing = false
    }
  }

  /** Convenience: trigger blocks→code sync from external code (e.g., app.ts) */
  syncBlocksToCode(tree?: SemanticNode, blockMappings?: BlockMapping[]): void {
    const t = tree ?? this.currentTree
    if (!t) return
    this.handleEditBlocks({ blocklyState: { tree: t, blockMappings } })
  }

  /**
   * Resync both panels after a cognitive level change.
   * - L0: blocks show body-only (scaffold stripped), code shows full (scaffold-wrapped)
   * - L1/L2: blocks show full tree, code shows full
   * When switching FROM L0 TO L1/L2, re-lifts from code to recover full tree.
   */
  resyncForLevel(extractedTree: SemanticNode, currentCode: string): void {
    if (this.syncing) return
    this.syncing = true
    try {
      let fullTree = extractedTree

      // If switching TO L1/L2 and tree has no main func (body-only from L0),
      // re-lift from the current code to get the full tree
      const hasMainFunc = (extractedTree.children.body ?? []).some(
        n => n.concept === 'func_def' && n.properties.name === 'main'
      )
      if (this.cognitiveLevel > 0 && !hasMainFunc && this.lifter && this.parser) {
        const parseResult = this.parser.parse(currentCode)
        const rootNode = parseResult.rootNode as import('../core/lift/types').AstNode
        if (rootNode) {
          const lifted = this.lifter.lift(rootNode)
          if (lifted) fullTree = lifted
        }
      }

      this.currentTree = fullTree

      // Generate code (scaffold wraps body-only trees; full trees use legacy path)
      const { code, mappings } = generateCodeWithMapping(fullTree, this.language, this.style)
      this.codeMappings = mappings

      // Compute scaffold result for Monaco ghost decorations
      let scaffoldResult: ScaffoldResult | undefined
      if (this.programScaffold) {
        scaffoldResult = this.programScaffold.resolve(fullTree, {
          cognitiveLevel: this.cognitiveLevel,
        })
      }

      // For blocks: strip scaffold if L0
      const displayTree = this.cognitiveLevel === 0 ? this.scaffoldNodeFilter(fullTree) : fullTree
      const renderResult = renderToBlocklyState(displayTree)
      this.blockMappings = renderResult.blockMappings


      // Emit resync event — updates both code and block panels
      this.bus.emit('semantic:update', {
        tree: fullTree, code, blockState: renderResult, source: 'resync', mappings, scaffoldResult,
      })
    } finally {
      this.syncing = false
    }
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

  getCodeMappings(): CodeMapping[] {
    return [...this.codeMappings]
  }

  getBlockMappings(): BlockMapping[] {
    return [...this.blockMappings]
  }

  /** Build blockId→nodeId reverse map for extraction to reuse original nodeIds */
  getBlockIdToNodeIdMap(): Map<string, string> {
    const map = new Map<string, string>()
    for (const bm of this.blockMappings) {
      map.set(bm.blockId, bm.nodeId)
    }
    return map
  }

  /** Block→Code: blockId → BlockMapping → nodeId → CodeMapping → {startLine, endLine} */
  getMappingForBlock(blockId: string): { blockId: string; startLine: number; endLine: number } | null {
    const bm = this.blockMappings.find(m => m.blockId === blockId)
    if (!bm) return null
    const cm = this.codeMappings.find(m => m.nodeId === bm.nodeId)
    if (!cm) return null
    return { blockId, startLine: cm.startLine, endLine: cm.endLine }
  }

  /** Node→Block+Code: nodeId → blockId (if block exists) + startLine/endLine (if code exists) */
  getMappingForNode(nodeId: string): { blockId: string | null; startLine: number | null; endLine: number | null } | null {
    const bm = this.blockMappings.find(m => m.nodeId === nodeId)
    let cm = this.codeMappings.find(m => m.nodeId === nodeId)

    // Fallback: expression nodes don't have codeMappings — walk up the tree to find
    // the nearest ancestor that does (e.g., while_loop containing a scanf expression)
    if (!cm && this.currentTree) {
      const ancestorId = this.findAncestorWithCodeMapping(this.currentTree, nodeId)
      if (ancestorId) cm = this.codeMappings.find(m => m.nodeId === ancestorId)
    }

    if (!bm && !cm) return null
    return {
      blockId: bm?.blockId ?? null,
      startLine: cm?.startLine ?? null,
      endLine: cm?.endLine ?? null,
    }
  }

  /** Walk tree to find the nearest ancestor of targetId that has a codeMapping */
  private findAncestorWithCodeMapping(node: SemanticNode, targetId: string): string | null {
    // Check if targetId is a descendant of this node
    if (!this.containsNodeId(node, targetId)) return null
    // This node contains the target — check children for a tighter match
    for (const children of Object.values(node.children)) {
      for (const child of children) {
        const found = this.findAncestorWithCodeMapping(child, targetId)
        if (found) return found
      }
    }
    // No child ancestor found — this node is the nearest ancestor with a codeMapping (if it has one)
    if (this.codeMappings.some(m => m.nodeId === node.id)) return node.id
    return null
  }

  /** Check if a node or any descendant has the given id */
  private containsNodeId(node: SemanticNode, targetId: string): boolean {
    if (node.id === targetId) return true
    for (const children of Object.values(node.children)) {
      for (const child of children) {
        if (this.containsNodeId(child, targetId)) return true
      }
    }
    return false
  }

  /** Code→Block: line → CodeMapping → nodeId → BlockMapping → {blockId} */
  getMappingForLine(line: number): { blockId: string | null; startLine: number; endLine: number } | null {
    let bestCm: CodeMapping | null = null
    for (const cm of this.codeMappings) {
      if (line >= cm.startLine && line <= cm.endLine) {
        if (!bestCm || (cm.endLine - cm.startLine) < (bestCm.endLine - bestCm.startLine)) {
          bestCm = cm
        }
      }
    }
    if (!bestCm) return null
    const bm = this.blockMappings.find(m => m.nodeId === bestCm!.nodeId)
    return { blockId: bm?.blockId ?? null, startLine: bestCm.startLine, endLine: bestCm.endLine }
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
