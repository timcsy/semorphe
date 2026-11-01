/** `cpp:literal_char` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:literal_char', (n, f) => {
    // 巨集展開來的（`#define z '0'`，第 213 刀）只有原文 `value`（帶引號）——literal 探測造的節點都放在 `value`
    const c = f.unescapeC(String(n.properties?.char ?? String(n.properties?.value ?? '').slice(1, -1)))
    return c.length === 1 ? f.k('eChar', { n: n.id, c: c.charCodeAt(0) }) : f.miss(n, '字元字面不是單一字元')
  })
  r.literal('cpp:literal_char', (text) => /^'(?:\\.|[^'\\])+'$/.test(text.trim()))
}
