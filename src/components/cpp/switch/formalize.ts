/** `cpp:switch` 的 **formalize** 路（spec 199：6.0 量到學生的程式 用 switch）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { componentTraits } from '../../../core/component/traits'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 子句照順序：case 是 caseC、default 是 defaultC，本體是它後面的敘述（照 C 的貫穿；cpp_to_tree.py 同形）
  r.stmt('cpp:switch', (n, f) => {
    const clauses = (n.slots?.cases ?? []).map((c) => {
      // 認子句不認身分（就近性）：宣告了「只在父節點裡成立」的（case／default 的 traits.insideParentOnly），或有本體的，是子句——有值的是 case、沒有值的是 default。
      // 🔴 2026-11-04（spec 213）：原本只認「有 body 這一格」，而**空的 case**（`case 10:` 往下掉）走一趟積木回來 body 這一格不見了
      //    （lift 給 `body: []`、抽取在積木沒有接敘述時不建這一格）⟹ 學生的程式一動積木就翻不出。缺的本體當成空的。
      if (!c.slots || !('body' in c.slots || componentTraits(c.componentId)?.insideParentOnly === true)) return f.miss(c, 'switch 裡不是 case／default 的子句還沒有對應')
      const body = (c.slots.body ?? []).flatMap((s) => f.stmt(s))
      return 'value' in c.slots ? f.k('caseC', { n: c.id, v: f.exprOf(c, 'value'), body }) : f.k('defaultC', { n: c.id, body })
    })
    return [f.k('sSwitch', { n: n.id, c: f.exprOf(n, 'expr'), clauses })]
  })
}
