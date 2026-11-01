/** `cpp:bits_declare` 的 **formalize** 路（第 213 刀）——`bitset<N> b;` → `tTemplate "bitset" [{"k":"tVal","v":N}]`（cella 2026-11-01 給的形狀），預設建構是全 0。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:bits_declare', (n, f, global) => {
    const size = f.constInt(f.one(n, 'size'))
    if (size === null) { f.miss(n, 'bitset 的大小不是整數字面'); return [] }
    const t = f.k('tTemplate', { name: 'bitset', args: [f.k('tVal', { v: size })] })
    // `bitset<N> b = x` 是拿 x 建構（unsigned long long 的建構子）
    return f.declCtor(n, t, f.one(n, 'source') ? [f.exprOf(n, 'source')] : [], global)
  })
}
