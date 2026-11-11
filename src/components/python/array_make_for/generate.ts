/** `python:array_make_for` 的 **generate** 路——`[x * x for x in xs if x > 0]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:array_make_for', (node, ctx) => {
    const one = (k: 'expression' | 'iterable' | 'condition' | 'outer'): string => {
      const n = (node.slots[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : ''
    }
    // 名字以 `targets` 為準（第 411 刀起單一名字也在裡面）；沒有時才退回 `obj`（只剩手組的樹）
    const targets = node.slots.targets ?? []
    const names = targets.length > 0
      ? targets.map((t) => String(t.properties.name ?? '')).join(', ')
      : String(node.properties.obj ?? 'x')
    const cond = one('condition')
    // ⚠️ **外層先寫**：原文的順序是從外到內，而語義樹是從內指向外
    const outer = one('outer')
    const inner = `${one('expression')} ${outer ? `${outer} ` : ''}for ${names} in ${one('iterable')}${cond ? ` if ${cond}` : ''}`
    // ⚠️ 產生器運算式**沒有括號**——加上去就是改了使用者的碼
    const wrap = String(node.properties.wrap ?? '')
    return wrap === 'generator' ? inner : wrap === 'set' ? `{${inner}}` : `[${inner}]`
  })
}
