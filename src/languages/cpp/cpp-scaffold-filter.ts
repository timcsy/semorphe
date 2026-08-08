import type { SemanticNode } from '../../core/types'
import { createNode } from '../../core/semantic-tree'

/**
 * Strip scaffold nodes (include, using_namespace, func_def main wrapper, return)
 * from a semantic tree, leaving only the user's body statements.
 * Used for L0 block rendering — blocks only show the user's logic.
 */
export function cppStripScaffoldNodes(tree: SemanticNode): SemanticNode {
  const body = tree.children.body ?? []
  const userBody: SemanticNode[] = []

  for (const node of body) {
    // Skip include directives
    if (node.conceptId === 'cpp:include' || node.conceptId === 'cpp:include_local') continue
    // Skip using namespace
    if (node.conceptId === 'cpp:using_namespace') continue
    // Unwrap func_def(main) — extract its body, skip trailing return
    if (node.conceptId === 'lang:func_def' && node.properties.name === 'main') {
      const funcBody = node.children.body ?? []
      for (const stmt of funcBody) {
        if (stmt.conceptId === 'lang:return') continue
        userBody.push(stmt)
      }
      continue
    }
    // Keep everything else (user-defined functions, etc.)
    userBody.push(node)
  }

  return createNode('lang:program', {}, { body: userBody })
}
