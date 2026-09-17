/** `cpp:string_empty` 的 **generate** 路——從 `std/string/generators.ts` 原封搬過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_empty', (node, ctx) => {
    // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    return `${obj}.empty()`
  })
}
