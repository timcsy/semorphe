/** `cpp:deque_declare` 的 **formalize** 路（spec 199：6.0 量到學生的程式 21 支用 deque）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { splitTypeArgs } from '../../../providers/cella/formalize'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:deque_declare', (n, f, global) => {
    const args = splitTypeArgs(String(n.properties?.type ?? 'int')).map((x) => f.type(x, n))
    if (!args.every(Boolean)) return []
    const t = f.k('tTemplate', { name: 'deque', args })
    if (f.one(n, 'source')) return [f.miss(n, '從另一個容器建 deque 還沒有對應')]
    const values = n.slots?.values ?? []
    if (values.length > 0) return f.declInit(n, t, f.braceList(n, 'values'), global)
    // `deque<int> d(n)`、`deque<int> d(n, v)`：大小與填值是建構子的引數
    return f.declCtor(n, t, ['size', 'fill'].filter((sl) => f.one(n, sl)).map((sl) => f.exprOf(n, sl)), global)
  })
}
