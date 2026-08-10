import type { SemanticNode } from '../types'
import type { BlockMapping } from './code-generator'
import { PatternRenderer } from './pattern-renderer'
import type { RenderContext } from '../registry/render-strategy-registry'
import { nextBlockId, resetBlockIdCounter } from './common-mappings'

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

  if (tree.conceptId !== 'cpp:program') {
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
    if (node.metadata?.rawCode != null || node.conceptId === 'raw_code' || node.conceptId === 'unresolved') {
      const extra: Record<string, unknown> = {}
      if (node.conceptId === 'unresolved') {
        extra.unresolved = true
        extra.nodeType = node.properties.node_type
      }
      block = {
        type: 'cpp_raw_code',
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
  // If it's a raw_code (statement) block in expression context, use cpp_raw_expression instead
  if (block.type === 'cpp_raw_code') {
    return { ...block, type: 'cpp_raw_expression' }
  }
  // Check if a statement-only block has an expression counterpart
  if (globalPatternRenderer?.isStatementOnly(block.type)) {
    const exprType = globalPatternRenderer.getExpressionCounterpart(block.type)
    if (exprType) {
      return { ...block, type: exprType }
    }
    // No expression counterpart — fall back to cpp_raw_expression
    const rawCodeRaw = node.metadata?.rawCode ?? node.properties.name ?? node.conceptId
    // Strip trailing semicolons/newlines — expression context doesn't need them
    const rawCode = typeof rawCodeRaw === 'string' ? rawCodeRaw.replace(/;\s*$/, '').trim() : rawCodeRaw
    return {
      type: 'cpp_raw_expression',
      id: block.id,
      fields: { CODE: rawCode },
      inputs: {},
      extraState: { ...block.extraState, degradationCause: 'statement_in_expression' },
    }
  }
  return block
}
