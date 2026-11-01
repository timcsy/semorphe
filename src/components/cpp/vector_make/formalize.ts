/** `cpp:vector_make` 的 **formalize** 路（spec 199：6.0 量到學生的程式 5 支寫 vector<T>(n, v)）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 一個臨時物件：型別 ＋ 建構子引數（cpp_to_tree.py 的 eTemp）
  r.expr('cpp:vector_make', (n, f) => {
    const elem = f.type(n.properties?.type ?? 'int', n)
    if (!elem) return f.k('eHole', { n: n.id })
    return f.k('eTemp', { n: n.id, t: f.k('tVector', { t: elem }), args: ['size', 'fill'].filter((sl) => f.one(n, sl)).map((sl) => f.exprOf(n, sl)) })
  })
}
