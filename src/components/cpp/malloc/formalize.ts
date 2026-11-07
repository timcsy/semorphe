/** `cpp:malloc` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:malloc', (n, f) => {
    const p = n.properties ?? {}
    // 沒有轉型（`void*`／舊的 `void`）：不包 eCast——`void*` 隱含轉成 `int*` 在 C 合法、在 C++ 不合法，由 Cella 照語言判
    const uncast = p.type === 'void*' || p.type === 'void'
    const t = uncast ? null : f.type(p.type ?? 'int*', n)
    if (!uncast && !t) return f.k('eHole', { n: n.id })
    const size = f.exprOf(n, 'size')
    const bytes = p.sizeof_type
      ? (() => { const st = f.type(p.sizeof_type, n); return st ? f.k('eBin', { n: `${n.id}/bytes`, op: f.k('opMul'), a: size, b: f.k('eSizeof', { n: `${n.id}/sizeof`, t: st }) }) : size })()
      : size
    if (uncast) return f.k('eCall', { n: n.id, f: 'malloc', args: [bytes] })
    return f.k('eCast', { n: n.id, t, a: f.k('eCall', { n: `${n.id}/call`, f: 'malloc', args: [bytes] }) })
  })
}
