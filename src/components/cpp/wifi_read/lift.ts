/**
 * `cpp:wifi_read` 的 **lift** 路——**「連線狀態」與「本機位址」是同一顆的兩個參數**。
 *
 * 🔴 兩者都是「讀無線網路的某個屬性」，零引數、形狀相同。
 * 與溫濕度那顆、與零件那一批同一條：**讀什麼不是身分，是參數。**
 *
 * ⚠️ 而綁 `obj === 'WiFi'`：`status` 是一個非常普通的方法名。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

const QUANTITY: Record<string, string> = { status: 'status', localIP: 'address' }

export function registerLift(): void {
  registerMethodBranch('cpp/wifi_read', (obj, method, argChildren): SemanticNode | null => {
    const quantity = QUANTITY[method]
    if (!quantity || obj !== 'WiFi') return null
    if (argChildren.length > 0) return null
    return createNode('cpp:wifi_read', { obj, quantity }, {})
  })
}
