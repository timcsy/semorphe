/** `cpp:var_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 通用的宣告子形狀（型別 名字 = 初值；多個宣告子逐一遞迴）在引擎——它也是別顆宣告子沒註冊時的形狀
  r.stmt('cpp:var_declare', (n, f) => f.decl(n, false))
  r.item('cpp:var_declare', (n, f) => f.decl(n, true))
}
