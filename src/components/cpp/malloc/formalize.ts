/** `cpp:malloc` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:malloc', (n, f) => {
    const p = n.properties ?? {}
    const t = f.type(p.type ?? 'int*', n)
    if (!t) return f.k('eHole', { n: n.id })
    const size = f.exprOf(n, 'size')
    const bytes = p.sizeof_type
      ? (() => { const st = f.type(p.sizeof_type, n); return st ? f.k('eBin', { n: `${n.id}/bytes`, op: f.k('opMul'), a: size, b: f.k('eSizeof', { n: `${n.id}/sizeof`, t: st }) }) : size })()
      : size
    return f.k('eCast', { n: n.id, t, a: f.k('eCall', { n: `${n.id}/call`, f: 'malloc', args: [bytes] }) })
  })
}
