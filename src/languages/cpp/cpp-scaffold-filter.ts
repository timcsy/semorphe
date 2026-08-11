import type { SemanticNode } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
// ⚠️ 問**性狀**不問身分——一條 if 一顆元件的話，那幾顆永遠搬不進膠囊。
import { isScaffold } from './core/node-traits'

/**
 * Strip scaffold nodes (include, using_namespace, func_def main wrapper, return)
 * from a semantic tree, leaving only the user's body statements.
 * Used for L0 block rendering — blocks only show the user's logic.
 */
export function cppStripScaffoldNodes(tree: SemanticNode): SemanticNode {
  const body = tree.children.body ?? []
  const userBody: SemanticNode[] = []

  for (const node of body) {
    // 鷹架（include／using namespace…）由元件自己宣告
    if (isScaffold(node.conceptId)) continue
    // Unwrap func_def(main) — extract its body, skip trailing return
    if (node.conceptId === 'cpp:func_def' && node.properties.name === 'main') {
      const funcBody = node.children.body ?? []
      for (const stmt of funcBody) {
        if (stmt.conceptId === 'cpp:return') continue
        userBody.push(stmt)
      }
      continue
    }
    // Keep everything else (user-defined functions, etc.)
    userBody.push(node)
  }

  return createNode('cpp:program', {}, { body: userBody })
}
