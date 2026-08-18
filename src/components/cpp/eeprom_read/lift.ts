/**
 * `cpp:eeprom_read` 的 **lift** 路——**一個看得到 `obj` 的分支**。
 *
 * 🔴 **綁 `obj` 不只是保險。** `read`／`write`／`begin`／`status` 全都是**非常普通的方法名**，而一張只放得下方法名的表會讓**任何物件**的 `.read()` 都變成這一顆。
 * 
 * > **一個靠方法名認人的樣式，會把別人的方法搶走。**
 * 
 * ⚠️ 這與序列埠那顆用同一個做法（它綁 `obj === 'Serial'`），而理由完全相同。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/eeprom_read', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (obj !== 'EEPROM' || method !== 'read') return null
    if (argChildren.length !== 1) return null
    const addressNode = argChildren[0] ? ctx.lift(argChildren[0]) : null
    return createNode('cpp:eeprom_read', { obj }, {
      address: addressNode ? [addressNode] : [],
    })
  })
}
