/**
 * `cpp:range_remap` 的 **generate** 路。
 *
 * ⚠️ 產出的函式名是 `map`——**身分叫 `range_remap` 是為了不與 `std::map` 撞名**，
 * 而**語法還是 `map(`**。名字是給人看的，不是給 parser 看的。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

const SLOTS = ['value', 'from_low', 'from_high', 'to_low', 'to_high'] as const

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_remap', (node, ctx) => {
    const args = SLOTS.map((s) => generateExpression((node.children[s] ?? [])[0], ctx))
    return `map(${args.join(', ')})`
  })
}
