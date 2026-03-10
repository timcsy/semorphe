import type { SemanticNode } from '../types'
import type { BlockMapping } from './code-generator'
import { PatternRenderer } from './pattern-renderer'
import type { RenderContext } from '../registry/render-strategy-registry'

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

let blockIdCounter = 0

function nextBlockId(): string {
  return `block_${++blockIdCounter}`
}

/** Module-level collection for block mappings during a render pass */
let currentBlockMappings: BlockMapping[] = []

export function renderToBlocklyState(tree: SemanticNode): WorkspaceBlockState & { blockMappings: BlockMapping[] } {
  blockIdCounter = 0
  currentBlockMappings = []

  if (tree.concept !== 'program') {
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
  nextBlockId: () => nextBlockId(),
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
    // Special cases not handled by PatternRenderer (no BlockSpec)
    if (node.concept === 'raw_code') {
      block = {
        type: 'c_raw_code',
        id: nextBlockId(),
        fields: { CODE: node.metadata?.rawCode ?? node.properties.code ?? '' },
        inputs: {},
      }
      propagateMetadata(block, node)
      // 預設降級原因為 unsupported（若無明確標記）
      if (!block.extraState?.degradationCause) {
        block.extraState = { ...block.extraState, degradationCause: node.metadata?.degradationCause ?? 'unsupported' }
      }
    } else if (node.concept === 'unresolved') {
      block = {
        type: 'c_raw_code',
        id: nextBlockId(),
        fields: { CODE: node.metadata?.rawCode ?? '' },
        inputs: {},
        extraState: { unresolved: true, nodeType: node.properties.node_type },
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
  // If it's a raw_code (statement) block in expression context, use c_raw_expression instead
  if (block.type === 'c_raw_code') {
    return { ...block, type: 'c_raw_expression' }
  }
  // Check if a statement-only block has an expression counterpart
  if (globalPatternRenderer?.isStatementOnly(block.type)) {
    const exprType = globalPatternRenderer.getExpressionCounterpart(block.type)
    if (exprType) {
      return { ...block, type: exprType }
    }
    // No expression counterpart — fall back to c_raw_expression
    const rawCodeRaw = node.metadata?.rawCode ?? node.properties.name ?? node.concept
    // Strip trailing semicolons/newlines — expression context doesn't need them
    const rawCode = typeof rawCodeRaw === 'string' ? rawCodeRaw.replace(/;\s*$/, '').trim() : rawCodeRaw
    return {
      type: 'c_raw_expression',
      id: block.id,
      fields: { CODE: rawCode },
      inputs: {},
      extraState: { ...block.extraState, degradationCause: 'statement_in_expression' },
    }
  }
  return block
}
