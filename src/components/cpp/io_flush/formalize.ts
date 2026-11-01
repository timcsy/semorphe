/** `cpp:io_flush` 的 **formalize** 路（學生的程式 5 支在 cout 裡寫 flush；形狀是 cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:io_flush', (n, f) => f.k('eManip', { n: n.id, m: f.k('mFlush') }))
}
