/** `cpp:serial_read` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 序列埠與函式庫物件：方法呼叫（`eMCall`）
  r.expr('cpp:serial_read', (n, f) => f.mcall(n, 'read', []))
}
