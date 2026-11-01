/** `cpp:switch` 的 **formalize** 路（spec 199：6.0 量到學生的程式 用 switch）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 子句照順序：case 是 caseC、default 是 defaultC，本體是它後面的敘述（照 C 的貫穿；cpp_to_tree.py 同形）
  r.stmt('cpp:switch', (n, f) => {
    const clauses = (n.slots?.cases ?? []).map((c) => {
      const body = (c.slots?.body ?? []).flatMap((s) => f.stmt(s))
      if (c.componentId === 'cpp:default') return f.k('defaultC', { n: c.id, body })
      if (c.componentId === 'cpp:case') return f.k('caseC', { n: c.id, v: f.exprOf(c, 'value'), body })
      return f.miss(c, 'switch 裡不是 case／default 的子句還沒有對應')
    })
    return [f.k('sSwitch', { n: n.id, c: f.exprOf(n, 'expr'), clauses })]
  })
}
