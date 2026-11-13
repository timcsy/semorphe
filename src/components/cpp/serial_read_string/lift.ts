/**
 * `cpp:serial_read_string` 的 **lift** 路——`Serial.readStringUntil(…)`。判別看 `obj`（與「從序列埠讀一個位元組」那一顆同一條）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/serial_read_string', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (obj !== 'Serial' || method !== 'readStringUntil' || argChildren.length !== 1) return null
    const a = ctx.lift(argChildren[0])
    if (!a) return null
    return createNode('cpp:serial_read_string', { obj }, { until: [a] })
  })
}
