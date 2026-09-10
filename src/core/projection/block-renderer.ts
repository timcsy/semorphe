import { degradationBlocks } from '../degradation-blocks'
import type { SemanticNode } from '../types'
import type { BlockMapping } from './code-generator'
import { PatternRenderer } from './pattern-renderer'
import type { RenderContext } from '../registry/render-strategy-registry'
import { nextBlockId, resetBlockIdCounter } from './common-mappings'
import { isProgramRoot } from '../component/traits'

interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  /**
   * **積木上的註解泡泡**——Blockly 自己的欄位（`icons.comment`）。
   *
   * 🔴 使用者寫的行末註解住在這裡，**不住在 `extraState`**：
   * 沒有 mutation 的積木**根本沒有 `extraState` 這條路**（Blockly 只在積木
   * 自己實作 `save/loadExtraState` 時才理它），於是那些註解會在
   * 「積木→程式碼」之後安靜消失。
   *
   * 🟢 而註解泡泡是 Blockly 原生會存檔的東西，**而且使用者看得到、改得動**。
   */
  icons?: { comment?: { text: string; pinned?: boolean; height?: number; width?: number } }
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
  currentOrphans = []

  // 🔴 **問這顆自己是不是根**，不跟全域單值比——見 `traits.ts` 的 `isProgramRoot`。
  // 比對單值的話，第二個語言的根會靜默渲染成空白畫布（spec 160 實測）。
  if (!isProgramRoot(tree.componentId)) {
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

  // ⚠️ 接不上語句鏈的那幾顆放在旁邊——**沒有丟掉，也沒有硬接**（見 `renderStatementChain`）
  const orphans = currentOrphans
  currentOrphans = []
  orphans.forEach((b, i) => { b.x = 30; b.y = 30 + (i + 1) * 4000 })

  const blockMappings = currentBlockMappings
  currentBlockMappings = []

  return {
    blocks: {
      languageVersion: 0,
      blocks: [firstBlock, ...orphans],
    },
    blockMappings,
  }
}

/**
 * 一串語句接成一條積木鏈。
 *
 * ## 🔴 **接不上的不得硬接，也不得丟掉**（2026-09-10）
 *
 * C++ 允許**運算式語句**，而其中有些運算式沒有敘述形態：
 *
 * ```cpp
 * cc[A[i]];      ← 離散化的慣用寫法（順手把那一格建出來）
 * return c;
 * // 保底         ← `return` 在此之前沒有下接點
 * ```
 *
 * 硬接的後果不是「那一行怪怪的」，是 Blockly 拒絕**整個**工作區：
 * `missing a(n) previous connection`——**使用者看到一片空白**。
 *
 * ⚠️ 而**丟掉也不行**：那一行從積木上消失，學生一動積木它就從程式碼裡沒了。
 *
 * 🟢 所以接不上的**放成另一顆頂層積木**（Blockly 的浮動積木是合法的）。
 * 它在畫布上是分開的一塊——而那**正是它在程式裡的樣子**：一個接不進
 * 語句流的東西。誠實，而且什麼都沒少。
 *
 * > **「硬接」與「丟掉」都是在替使用者決定；把它放在旁邊是把決定留給他。**
 */
/** 這一趟渲染裡接不上語句鏈的積木——由 `renderToBlocklyState` 收成頂層積木。 */
let currentOrphans: BlockState[] = []

function renderStatementChain(nodes: SemanticNode[]): BlockState | null {
  if (nodes.length === 0) return null

  const canFollow = (b: BlockState): boolean =>
    !(globalPatternRenderer?.isExpressionOnly(b.type) ?? false)

  let first: BlockState | null = null
  let current: BlockState | null = null
  for (const node of nodes) {
    const block = renderBlock(node)
    if (!block) continue
    if (!first) {
      first = block
      current = canFollow(block) ? tailOf(block) : null
      continue
    }
    if (current === null || !canFollow(block) || !acceptsNext(current)) {
      currentOrphans.push(block)
      continue
    }
    current.next = { block }
    // ⚠️ **一顆節點可以畫成【一串】積木**（`int a[10], b[20];` 攤成兩顆）。
    //    接下一句時要接在那一串的**尾巴**上，不然它自己的 `next` 會被蓋掉
    //    ——症狀是第二顆之後整批消失。
    current = tailOf(block)
  }

  return first
}

/** 一串積木的最後一顆。 */
function tailOf(b: BlockState): BlockState {
  let t = b
  while (t.next?.block) t = t.next.block
  return t
}

/**
 * 這顆積木接得住下一句嗎。
 *
 * ⚠️ **問宣告，不看型別名**——`cpp_return` 與 `cpp_break` 在 2026-09-10
 * 之前沒有下接點，而那是宣告裡的一格，不是這裡該記得的清單。
 */
function acceptsNext(b: BlockState): boolean {
  return globalPatternRenderer?.acceptsNextStatement(b.type) ?? true
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
    // Fallback for meta-components with rawCode (raw_code, unresolved, etc.)
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

  // 🔴 **使用者從右鍵選單加的註解走泡泡**——而**行末註解不走這裡**：
  //    它在抬升那一路就變成一顆自己的註解積木了（見 `lift/lifter.ts`）。
  const plain = (annotations ?? []).filter((a) => a.type === 'comment').map((a) => a.text)
  if (plain.length > 0) {
    block.icons = { ...(block.icons ?? {}), comment: { text: plain.join('; '), pinned: false } }
  }
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
