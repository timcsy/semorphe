/**
 * `cpp:math_unary` 的 **generate** 路——從 `std/cmath/generators.ts` 原封搬過來。
 *
 * ⚠️ `?? 'abs'` 這個退路是原本就有的。它與 lift 那一路的名單**不一致**
 * （`abs` 不在登錄名單裡），也就是說：`func` 缺席時會產出一個
 * lift 回不來的函式名。搬移不重寫，所以照原樣搬——記在這裡。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_unary', (node, ctx) => {
    const func = (node.properties.func as string) ?? 'abs'
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    return `${func}(${value})`
  })
}
