/** `python:map_make_for` 的 **generate** 路——`{k: v for k, v in d if c}`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:map_make_for', (node, ctx) => {
    const one = (k: 'key' | 'value' | 'iterable' | 'condition'): string => {
      const n = (node.children[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : ''
    }
    const names = (node.children.targets ?? []).map((t) => String(t.properties.name ?? '')).join(', ')
    const cond = one('condition')
    return `{${one('key')}: ${one('value')} for ${names} in ${one('iterable')}${cond ? ` if ${cond}` : ''}}`
  })
}
