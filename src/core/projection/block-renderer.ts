import type { SemanticNode } from '../types'
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

export function renderToBlocklyState(tree: SemanticNode): WorkspaceBlockState {
  blockIdCounter = 0
  if (tree.concept !== 'program') {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  const body = tree.children.body ?? []
  if (body.length === 0) {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  // Chain top-level statements into a single block chain
  const firstBlock = renderStatementChain(body)
  if (!firstBlock) {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  firstBlock.x = 30
  firstBlock.y = 30

  return {
    blocks: {
      languageVersion: 0,
      blocks: [firstBlock],
    },
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
  // Single pipeline: delegate all rendering to PatternRenderer
  if (globalPatternRenderer) {
    const patternResult = globalPatternRenderer.render(node, renderCtx)
    if (patternResult) return patternResult
  }

  // Special cases not handled by PatternRenderer (no BlockSpec)
  if (node.concept === 'raw_code') {
    return {
      type: 'c_raw_code',
      id: nextBlockId(),
      fields: { CODE: node.metadata?.rawCode ?? node.properties.code ?? '' },
      inputs: {},
    }
  }
  if (node.concept === 'unresolved') {
    return {
      type: 'c_raw_code',
      id: nextBlockId(),
      fields: { CODE: node.metadata?.rawCode ?? '' },
      inputs: {},
      extraState: { unresolved: true, nodeType: node.properties.node_type },
    }
  }

  return null
}

function renderExpression(node: SemanticNode): BlockState | null {
  const block = renderBlock(node)
  // If it's a raw_code (statement) block in expression context, use c_raw_expression instead
  if (block && block.type === 'c_raw_code') {
    return { ...block, type: 'c_raw_expression' }
  }
  return block
}
