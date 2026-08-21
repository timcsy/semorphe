/** `python:ternary` 的 **generate** 路——`真 if 條件 else 假`（與 C++ 的順序不同）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:ternary', (node, ctx) => {
    const one = (k: 'condition' | 'then_value' | 'else_value'): string => {
      const n = (node.children[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : 'None'
    }
    return `${one('then_value')} if ${one('condition')} else ${one('else_value')}`
  })
}
