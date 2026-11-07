/** `cpp:delete` 的 **formalize** 路。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // `delete[] p` → arr: true（第 331 刀：原本一律 false，釋放 `new T[n]` 的陣列被 Cella 照實判成 ubFree）
  r.stmt('cpp:delete', (n, f) => [f.k('sDelete', { n: n.id, arr: String(n.properties?.is_array ?? 'false') === 'true', e: f.exprOf(n, 'ptr') })])
}
