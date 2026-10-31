/** `cpp:input_formatted` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { isAddressable } from '../../../languages/cpp/lang/node-traits'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 🔴 引數的 `&` 與產生器**同一個判準**（`isAddressable`，見 generate.ts）：積木上寫 `n`，程式碼是 `&n`。
  //    在此之前這裡原樣送出，而 cella 比對 C18 時抓到 program 少了 `&`（第 390 刀）。
  r.stmt('cpp:input_formatted', (n, f) =>
    [f.k('sScanf', {
      n: n.id,
      fmt: f.unescapeC(String(n.properties?.format ?? '')),
      args: (n.slots?.args ?? []).map((c) => isAddressable(c.componentId) ? f.k('eAddr', { n: `${c.id}/addr`, a: f.expr(c) }) : f.expr(c)),
    })])
}
