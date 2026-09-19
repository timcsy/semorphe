/** `cpp:bits_fill` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:bits_fill', (node, ctx) => {
    // 🔴 接收者是接點——`d[i].reset()` 的 `d[i]` 是一棵樹，不是一串文字
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    /**
     * 🔴 **產回使用者寫的那個方法名**——那一格裝的**就是**他寫的字
     *（共用的方法路由填的，見 `component.json` 的 `_properties_why`）。
     * 同族「加到尾端」那顆記過同一條：`v.pb(3)` 不得產成 `v.push_back(3)`。
     */
    const method = String(node.properties.method ?? 'reset')
    /** 🔴 「第幾格」留空時**不產第二個引數**——`bs.reset()` 不可以變成 `bs.reset(0)`。 */
    const posNode = (node.slots.pos ?? [])[0]
    const arg = posNode ? generateExpression(posNode, ctx) : ''
    return `${indent(ctx)}${obj}.${method}(${arg});\n`
  })
}
