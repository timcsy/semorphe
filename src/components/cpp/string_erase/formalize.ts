/** `cpp:string_erase` 的 **formalize** 路（spec 203）——`s.erase(pos, len)` → `eMCall "erase"`；只送使用者寫了的引數（`s.erase(pos)` 是刪到結尾）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_erase', (n, f) => f.k('eMCall', {
    n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'erase',
    args: (['pos', 'len'] as const).filter((s) => f.one(n, s)).map((s) => f.exprOf(n, s)),
  }))
  r.stmt('cpp:string_erase', (n, f) => f.exprStmt(n))
}
