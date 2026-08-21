/** `python:array_make_for` 的 **generate** 路——`[x * x for x in xs if x > 0]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:array_make_for', (node, ctx) => {
    const one = (k: 'expression' | 'iterable' | 'condition'): string => {
      const n = (node.children[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : ''
    }
    const cond = one('condition')
    return `[${one('expression')} for ${node.properties.obj ?? 'x'} in ${one('iterable')}${cond ? ` if ${cond}` : ''}]`
  })
}
