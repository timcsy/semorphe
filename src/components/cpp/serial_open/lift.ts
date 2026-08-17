/**
 * `cpp:serial_open` 的 **lift** 路——**一個看得到 `obj` 的分支**。
 *
 * 🔴 **為什麼不是 `registerMethodConcept`**：那張表的鍵是**方法名**，
 * 而 `begin` 已經被 `cpp:container_iter`（`v.begin()`）用著。
 *
 * > **「`begin` 在 `Serial` 上」這件事，一張只放得下方法名的表【表達不出來】。**
 *
 * 🟢 而 `container_iter` 的分支**已經拒絕帶引數的 `begin`**
 * （「迭代器取得不吃引數。判不出來就說不是我」），所以 `Serial.begin(9600)` 落得下來。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/serial_open', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (obj !== 'Serial' || method !== 'begin') return null
    const baud = argChildren[0] ? ctx.lift(argChildren[0]) : null
    return createNode('cpp:serial_open', { obj }, { baud: baud ? [baud] : [] })
  })
}
