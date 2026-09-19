/** `cpp:pointer_step` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pointer_step', (node, ctx) => {
    /**
     * 🔴 **產出使用者寫的那個方向**，而且**不得換一種寫法**：
     * `prev(s.end())` 不可以變成 `s.end() - 1`——`set` 沒有隨機存取，
     * 那樣**編不過**。（同族的取端點那顆記過一模一樣的一條：
     * 原生陣列沒有成員 `begin`，`begin(a)` 不可以產成 `a.begin()`。）
     */
    const direction = String(node.properties.direction ?? 'prev')
    const pos = generateExpression((node.slots.pos ?? [])[0], ctx)
    /**
     * 🔴 **「幾格」留空時就不產第二個引數**——`prev(it)` 不可以變成 `prev(it, 1)`。
     * 它們算的是同一件事，而**那不是使用者寫的那一行**（同族的「加到尾端」那顆
     * 記過同一條：產出使用者寫的那個方法名，不要換成本名）。
     */
    const countNode = (node.slots.count ?? [])[0]
    if (!countNode) return `${direction}(${pos})`
    return `${direction}(${pos}, ${generateExpression(countNode, ctx)})`
  })
}
