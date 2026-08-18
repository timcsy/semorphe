/**
 * `cpp:serial_read` 的 **lift** 路——**一個看得到 `obj` 的分支**。
 *
 * ⚠️ `read` 這個方法名在別的物件上也有，所以**判別必須看 `obj`**
 * ——一張只放得下方法名的表在這裡會搶錯東西。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/serial_read', (obj, method, argChildren): SemanticNode | null => {
    // ⚠️ `read()` 不吃引數（吃引數的是 `readBytes`）——判不出來就說不是我。
    if (obj !== 'Serial' || method !== 'read' || argChildren.length > 0) return null
    return createNode('cpp:serial_read', { obj }, {})
  })
}
