/** `cpp:var_declare_ref` 的 **formalize** 路（spec 202）——`T& r = x;`：型別是 `tRef(T)`，初值照通用宣告子（同 cella 的 `cpp_to_tree.py`）。沒有初值的參照不合法，由 Cella 判。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:var_declare_ref', (n, f, global) => {
    const t = f.type(n.properties?.type ?? 'int', n)
    if (!t) return []
    return f.declVar(n, f.k('tRef', { t }), global)
  })
}
