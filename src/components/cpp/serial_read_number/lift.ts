/**
 * `cpp:serial_read_number` 的 **lift** 路——`Serial.parseInt(…)`。判別看 `obj`（與「從序列埠讀一個位元組」那一顆同一條）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/serial_read_number', (obj, method, argChildren): SemanticNode | null => {
    if (obj !== 'Serial' || method !== 'parseInt' || argChildren.length !== 0) return null
    return createNode('cpp:serial_read_number', { obj }, {})
  })
}
