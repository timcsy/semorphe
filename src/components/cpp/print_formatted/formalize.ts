/** `cpp:print_formatted` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:print_formatted', (n, f) =>
    [f.k('sPrintf', { n: n.id, fmt: f.unescapeC(String(n.properties?.format ?? '')), args: (n.slots?.args ?? []).map((c) => f.expr(c)) })])
}
