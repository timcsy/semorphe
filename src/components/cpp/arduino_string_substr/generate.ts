/** `cpp:arduino_string_substr` 的 **generate** 路（435）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:arduino_string_substr', (node, ctx) => {
    const obj = genReceiver((node.slots.obj ?? [])[0], ctx)
    // 留空的選擇性引數不寫（`s.substring(3)`）；中間那格空了而後面那格有值時照樣寫出——那是學生自己少填，不替他補
    const slots = ['from', 'to']
    const last = slots.map((sl) => (node.slots[sl] ?? []).length > 0).lastIndexOf(true)
    const args = slots.slice(0, last + 1).map((sl) => { const c = (node.slots[sl] ?? [])[0]; return c ? generateExpression(c, ctx) : '' })
    return `${obj}.substring(${args.join(', ')})`
  })
}
