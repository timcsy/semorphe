/** `cpp:var_declare_auto` 的 **formalize** 路（spec 199：6.0 量到學生的程式 7 支用 auto 宣告）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:var_declare_auto', (n, f, global) => f.declVar(n, f.k('tAuto'), global))
}
