/** `cpp:literal_string` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:literal_string', (n, f) => f.k('eStr', { n: n.id, s: f.unescapeC(String(n.properties?.value ?? '')) }))
  // 這種原文是字串字面（spec 203：參數預設值、`#define NAME "x"` 的巨集展開）——屬性 value 不帶引號，與 lift 一致
  r.literal('cpp:literal_string', (text) => /^"(?:\\.|[^"\\])*"$/.test(text.trim()), (text) => text.trim().slice(1, -1))
}
