/** `cpp:range_sum` 的 **formalize** 路（spec 203）——`accumulate(begin, end, init)`，照 generate 送 eCall（空的初值槽 generate 寫 0，這裡同一份）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_sum', (n, f) => {
    const init = f.one(n, 'init') ? f.exprOf(n, 'init') : f.k('eNum', { n: `${n.id}/init`, v: 0 })
    return f.k('eCall', { n: n.id, f: 'accumulate', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end'), init] })
  })
}
