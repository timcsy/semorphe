/** `cpp:io_mode` 的 **formalize** 路（spec 201：學生的程式用 setw／setprecision／setfill；形狀是 cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

const CTOR: Record<string, string> = { width: 'eSetw', precision: 'eSetprecision', fill: 'eSetfill' }

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:io_mode', (n, f) => {
    const k = CTOR[String(n.properties?.setting ?? 'width')]
    return k ? f.k(k, { n: n.id, e: f.exprOf(n, 'value') }) : f.miss(n, `操縱子「${String(n.properties?.setting)}」還沒有對應`)
  })
}
