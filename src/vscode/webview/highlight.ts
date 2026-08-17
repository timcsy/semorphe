/**
 * 行 ↔ 節點的雙向反查 —— **兩個視圖是同一個東西，這是唯一看得見的證據**。
 *
 * ## 地基是量過的（2026-08-17，20 段語料 / 1516 個節點）
 *
 * ```
 * metadata.sourceRange   1493 / 1516 = 98.5%
 * node.id                1516 / 1516 = 100%
 * ```
 *
 * 🟢 兩個方向的資料**lift 當下就帶著**，不是要另外算的。
 * 🟢 而「游標行 → 哪個節點」是一趟 76～131 個節點的樹走訪
 * ——⚠️ 我原本擔心「游標事件很吵會卡」，那個擔心是多餘的。
 *
 * > **一個「會不會太慢」的擔心，在量之前不值得拿來設計。**
 *
 * ## 🔴 而剩下的 1.5% 是一個真的缺口
 *
 * 23 個節點沒有 `sourceRange`（多半是合成出來的）。
 * **高亮在那些節點上會安靜地沒有反應** —— 那是「不會報錯的壞」那一族。
 *
 * **處置：往上找最近的有範圍的祖先。**
 * ⚠️ 而**找不到時要說得出來**（回傳 `null` 而呼叫端顯示），
 * 不是靜默地什麼都不做（FR-007）。
 */
import type { SemanticNode } from '../../core/types'

export interface LineRange {
  startLine: number
  endLine: number
}

interface RangedNode {
  node: SemanticNode
  range: LineRange
}

function rangeOf(node: SemanticNode): LineRange | null {
  const md = (node as { metadata?: { sourceRange?: LineRange } }).metadata
  const r = md?.sourceRange
  if (!r || typeof r.startLine !== 'number' || typeof r.endLine !== 'number') return null
  return { startLine: r.startLine, endLine: r.endLine }
}

/** 樹上所有帶範圍的節點，深度優先。⚠️ 順序就是「愈後面愈深」。 */
function collect(root: SemanticNode, out: RangedNode[] = [], depth = 0): RangedNode[] {
  const r = rangeOf(root)
  if (r) out.push({ node: root, range: r })
  void depth
  for (const ks of Object.values(root.children ?? {})) for (const k of ks) collect(k, out)
  return out
}

/**
 * 游標在第 `line` 行 → 哪個節點。
 *
 * 🔴 **挑「涵蓋這一行而且最小」的那個** ——
 * ⚠️ 不挑最小的話永遠會挑到 `program`（它涵蓋全部），
 * 而那讓高亮**看起來有反應但沒有意義**。
 */
export function nodeIdAtLine(root: SemanticNode, line: number): string | null {
  let best: RangedNode | null = null
  for (const c of collect(root)) {
    if (line < c.range.startLine || line > c.range.endLine) continue
    if (best === null) { best = c; continue }
    const span = c.range.endLine - c.range.startLine
    const bestSpan = best.range.endLine - best.range.startLine
    if (span < bestSpan) best = c
  }
  return best?.node.id ?? null
}

/**
 * 節點 → 它在程式碼裡的行範圍。
 *
 * ⚠️ 節點自己沒有範圍時（實測 1.5%）**往上找最近的有範圍的祖先**
 * ——🔴 而找不到時回 `null`，讓呼叫端說得出「這一顆指不到程式碼」。
 */
export function rangeOfNodeId(root: SemanticNode, nodeId: string): LineRange | null {
  const path: SemanticNode[] = []
  const find = (n: SemanticNode): boolean => {
    path.push(n)
    if (n.id === nodeId) return true
    for (const ks of Object.values(n.children ?? {})) {
      for (const k of ks) if (find(k)) return true
    }
    path.pop()
    return false
  }
  if (!find(root)) return null
  // 由內往外找第一個有範圍的
  for (let i = path.length - 1; i >= 0; i--) {
    const r = rangeOf(path[i])
    if (r) return r
  }
  return null
}
