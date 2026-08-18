/**
 * `cpp:serial_count` 的 **lift** 路——**一個看得到 `obj` 的分支**。
 *
 * ⚠️ 走 `registerMethodBranch` 而不是自由函式表：`available` 是 `Serial` 上的**方法**，
 * 而那張只放得下方法名的表表達不出「它在 `Serial` 上」（同 `cpp:serial_open` 的理由）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/serial_count', (obj, method, argChildren): SemanticNode | null => {
    // ⚠️ `available()` 不吃引數——判不出來就說不是我。
    if (obj !== 'Serial' || method !== 'available' || argChildren.length > 0) return null
    return createNode('cpp:serial_count', { obj }, {})
  })
}
