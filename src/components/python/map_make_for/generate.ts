/** `python:map_make_for` 的 **generate** 路——`{k: v for k, v in d if c}`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { targetPatternText } from '../tuple_make/target-pattern'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:map_make_for', (node, ctx) => {
    const one = (k: 'key' | 'value' | 'iterable' | 'condition'): string => {
      const n = (node.slots[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : ''
    }
    // 目標是樣式時（第 422 刀）住在 `pattern`，最外層的元組不帶括號
    const pattern = (node.slots.pattern ?? [])[0]
    const names = pattern ? targetPatternText(pattern, ctx)
      : (node.slots.targets ?? []).map((t) => String(t.properties.name ?? '')).join(', ')
    const cond = one('condition')
    return `{${one('key')}: ${one('value')} for ${names} in ${one('iterable')}${cond ? ` if ${cond}` : ''}}`
  })
}
