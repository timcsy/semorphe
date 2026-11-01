/** `cpp:loop_count` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_count', (n, f) => {
    // 計數迴圈是比語法高一層的元件：展開成 for，迴圈變數以這顆節點為宣告（作用域走訪也是這樣認的）
    const name = String(n.properties?.var_name ?? 'i')
    const v = (role: string): CellaJson => f.k('eVar', { n: `${n.id}/${role}`, x: n.id })
    // `for (int i{}; …)`：起始值 lift 成大括號串列（eBraced）——迴圈變數是 int（純量），`{}` 是零、`{x}` 就是 x
    //（第 217 刀，StudyCpp 4 支：原本送空的 eBraced，Cella 判「a braced list where the type it initializes is not known」）
    let from = f.exprOf(n, 'from')
    const xs = from.k === 'eBraced' ? ((from.init as CellaJson | undefined)?.xs as CellaJson[] | undefined) : undefined
    if (xs && xs.length === 0) from = f.k('eNum', { n: `${n.id}/from`, v: 0 })
    else if (xs && xs.length === 1 && xs[0].k === 'iE') from = xs[0].e as CellaJson
    return [f.k('sFor', {
      n: n.id,
      init: f.k('sDecl', { n: `${n.id}/init`, x: n.id, name, t: f.k('tInt'), init: f.k('iE', { e: from }) }),
      c: f.k('eBin', { n: `${n.id}/cond`, op: f.k(n.properties?.inclusive === 'TRUE' ? 'opLe' : 'opLt'), a: v('cond-var'), b: f.exprOf(n, 'to') }),
      step: f.k('eIncDec', { n: `${n.id}/step`, lhs: v('step-var'), inc: true, post: true }),
      body: f.block(n, 'body'),
    })]
  })
  // 作用域：`from` 在外層求值；迴圈變數以這顆節點為宣告，住在迴圈那一層
  r.scope('cpp:loop_count', (n, w) => {
    w.walkSlot(n, 'from')
    w.inScope(() => {
      w.declare(String(n.properties?.var_name ?? ''), n.id)
      w.walkSlots(n, new Set(['from']))
    })
  })
}
