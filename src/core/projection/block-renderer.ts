import { degradationBlocks } from '../degradation-blocks'
import type { SemanticNode } from '../types'
import type { BlockMapping } from './code-generator'
import { PatternRenderer } from './pattern-renderer'
import type { RenderContext } from '../registry/render-strategy-registry'
import { nextBlockId, resetBlockIdCounter } from './common-mappings'
import { programRootConcept } from '../component/traits'

interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  extraState?: Record<string, unknown>
  x?: number
  y?: number
}

interface WorkspaceBlockState {
  blocks: {
    languageVersion: number
    blocks: BlockState[]
  }
}

let globalPatternRenderer: PatternRenderer | null = null

/** Set the JSON-driven pattern renderer engine */
export function setPatternRenderer(pr: PatternRenderer): void {
  globalPatternRenderer = pr
}

/** Module-level collection for block mappings during a render pass */
let currentBlockMappings: BlockMapping[] = []

export function renderToBlocklyState(tree: SemanticNode): WorkspaceBlockState & { blockMappings: BlockMapping[] } {
  resetBlockIdCounter()
  currentBlockMappings = []

  if (tree.componentId !== programRootConcept()) {
    return { blocks: { languageVersion: 0, blocks: [] }, blockMappings: [] }
  }

  const body = tree.children.body ?? []
  if (body.length === 0) {
    return { blocks: { languageVersion: 0, blocks: [] }, blockMappings: [] }
  }

  // Chain top-level statements into a single block chain
  const firstBlock = renderStatementChain(body)
  if (!firstBlock) {
    return { blocks: { languageVersion: 0, blocks: [] }, blockMappings: [] }
  }

  firstBlock.x = 30
  firstBlock.y = 30

  const blockMappings = currentBlockMappings
  currentBlockMappings = []

  return {
    blocks: {
      languageVersion: 0,
      blocks: [firstBlock],
    },
    blockMappings,
  }
}

function renderStatementChain(nodes: SemanticNode[]): BlockState | null {
  if (nodes.length === 0) return null

  const first = renderBlock(nodes[0])
  if (!first) return null

  let current = first
  for (let i = 1; i < nodes.length; i++) {
    const next = renderBlock(nodes[i])
    if (next) {
      current.next = { block: next }
      current = next
    }
  }

  return first
}

const renderCtx: RenderContext = {
  renderBlock: (n) => renderBlock(n),
  renderExpression: (n) => renderExpression(n),
  renderStatementChain: (ns) => renderStatementChain(ns),
  nextBlockId: () => nextBlockId('block_'),
}

function renderBlock(node: SemanticNode): BlockState | null {
  let block: BlockState | null = null

  // Single pipeline: delegate all rendering to PatternRenderer
  if (globalPatternRenderer) {
    const patternResult = globalPatternRenderer.render(node, renderCtx)
    if (patternResult) {
      propagateMetadata(patternResult, node)
      block = patternResult
    }
  }

  if (!block) {
    // Fallback for meta-concepts with rawCode (raw_code, unresolved, etc.)
    if (node.metadata?.rawCode != null || node.componentId === 'raw_code' || node.componentId === 'unresolved') {
      const extra: Record<string, unknown> = {}
      if (node.componentId === 'unresolved') {
        extra.unresolved = true
        extra.nodeType = node.properties.node_type
      }
      // 🔴 **型別由語言套件宣告**（spec 154）——核心不認得任何語言的積木型別。
      //    ⚠️ 沒有宣告時用一個**看得出是降級**的記號，不猜一個語言的名字。
      block = {
        type: degradationBlocks()?.statement ?? 'raw_code',
        id: nextBlockId('block_'),
        fields: { CODE: node.metadata?.rawCode ?? node.properties.code ?? '' },
        inputs: {},
        extraState: Object.keys(extra).length > 0 ? extra : undefined,
      }
      propagateMetadata(block, node)
      if (!block.extraState?.degradationCause) {
        block.extraState = { ...block.extraState, degradationCause: node.metadata?.degradationCause ?? 'unsupported' }
      }
    }
  }

  // Record nodeId→blockId mapping
  if (block && node.id) {
    currentBlockMappings.push({ nodeId: node.id, blockId: block.id })
  }

  return block
}

/** 將 SemanticNode 的 metadata 和 annotations 傳遞到 BlockState.extraState */
function propagateMetadata(block: BlockState, node: SemanticNode): void {
  const meta = node.metadata
  const annotations = node.annotations

  if (!meta?.degradationCause && !meta?.confidence && !annotations?.length) return

  const extra: Record<string, unknown> = { ...block.extraState }
  if (meta?.degradationCause) extra.degradationCause = meta.degradationCause
  if (meta?.confidence && meta.confidence !== 'high') extra.confidence = meta.confidence
  if (annotations?.length) extra.annotations = annotations
  block.extraState = extra
}

function renderExpression(node: SemanticNode): BlockState | null {
  const block = renderBlock(node)
  if (!block) return null
  // 語句位置的降級積木出現在運算式位置時，換成運算式版（型別由語言套件宣告）
  const deg = degradationBlocks()
  if (deg && block.type === deg.statement) {
    return { ...block, type: deg.expression }
  }
  // Check if a statement-only block has an expression counterpart
  if (globalPatternRenderer?.isStatementOnly(block.type)) {
    const exprType = globalPatternRenderer.getExpressionCounterpart(block.type)
    if (exprType) {
      return { ...block, type: exprType }
    }
    // 沒有運算式版的對應積木 → 降級（型別由語言套件宣告，spec 154）
    const rawCodeRaw = node.metadata?.rawCode ?? node.properties.name ?? node.componentId
    // Strip trailing semicolons/newlines — expression context doesn't need them
    const rawCode = typeof rawCodeRaw === 'string' ? rawCodeRaw.replace(/;\s*$/, '').trim() : rawCodeRaw
    return {
      type: degradationBlocks()?.expression ?? 'raw_expression',
      id: block.id,
      fields: { CODE: rawCode },
      inputs: {},
      extraState: { ...block.extraState, degradationCause: 'statement_in_expression' },
    }
  }
  return block
}
