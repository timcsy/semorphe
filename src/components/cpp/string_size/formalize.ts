/** `cpp:string_size` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 🔴 方法名與產生器相同（`.length()`）：這顆只從 `length` lift 上來（`.size()` 是容器那顆）。
  //    在此之前送 `size`，於是 cella 拿 text 與 generate(program) 比對時兩棵樹不同（第 390 刀）。
  r.expr('cpp:string_size', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'length', args: [] }))
}
