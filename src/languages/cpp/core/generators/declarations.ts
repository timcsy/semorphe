import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateBody } from '../../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {














  // ⚠️ `cpp:initializer_list` 的產生器**已搬進膠囊**（2026-08-14 升格成元件）。

































  g.set('_multi_field', (node, ctx) => {
    const fields = node.children.fields ?? []
    return generateBody(fields, ctx)
  })
}
