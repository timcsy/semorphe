/** `cpp:loop_do_while` 的 **formalize** 路（第 207 刀：`do { … } while (…);`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_do_while', (n, f) => [f.k('sDo', { n: n.id, body: f.block(n, 'body'), c: f.exprOf(n, 'cond') })])
}
