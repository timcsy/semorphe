/** `cpp:range_fill` 的 **formalize** 路（第 213 刀：`fill(a, a + n, v)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 值留空時產碼補 0（`generate.ts`），這裡跟著補——兩路要說同一件事
  r.expr('cpp:range_fill', (n, f) => f.k('eCall', { n: n.id, f: 'fill', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end'), f.one(n, 'value') ? f.exprOf(n, 'value') : f.k('eNum', { n: `${n.id}#value`, v: 0 })] }))
  r.stmt('cpp:range_fill', (n, f) => f.exprStmt(n))
}
