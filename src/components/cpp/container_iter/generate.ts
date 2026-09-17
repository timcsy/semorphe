/** `cpp:container_iter` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_iter', (node, ctx) => {
    // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    const which = node.properties.which ?? 'begin'
    return `${obj}.${which}()`
  })
}
