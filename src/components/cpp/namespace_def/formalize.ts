/**
 * `cpp:namespace_def` 的 **formalize** 路（spec 200）——`namespace Math { … }` → `iNamespace { name, inl: false, items }`。
 * 形狀是 cella 2026-11-02 給的（0258 實測）：限定名呼叫直接把 `eCall` 的 f 寫成 `"Math::square"`；沒有 using 時裸名照標準判未宣告。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:namespace_def', (n, f) => [f.k('iNamespace', {
    n: n.id,
    name: String(n.properties?.name ?? ''),
    inl: false,
    items: (n.slots?.body ?? []).flatMap((c) => f.item(c)),
  })])
}
