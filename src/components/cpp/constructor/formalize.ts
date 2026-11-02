/**
 * `cpp:constructor` 的 **formalize** 路（spec 203）——類別成員 `mbCtor acc n expl noexc params inits body`。
 * 成員初始化列（`: v(x), w(y)`）在語義樹裡是一串賦值（目標是欄位名、值是運算式）→ `minit n field [值]`。
 * 形狀照 Cella 的 `cfamily.syntax` 與 `tools/cfamily/cpp_to_tree.py` 的 `member`。存取權由類別那顆蓋上。契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:constructor', (n, f) => {
    const params = (n.slots?.params ?? []).map((q) => {
      if (String(q.properties?.default ?? '').trim() !== '') f.miss(q, '建構子參數的預設值還沒有對應')
      return f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: null })
    })
    const inits = (n.slots?.inits ?? []).map((a) => {
      const field = String(f.one(a, 'target')?.properties?.name ?? '')
      return f.k('minit', { n: a.id, field, args: [f.exprOf(a, 'value')] })
    })
    return f.k('mbCtor', { acc: f.k('acPublic'), n: n.id, expl: false, noexc: false, params, inits, body: f.block(n, 'body') })
  })
  // 作用域：參數、初始化列、本體同一層（初始化列的值看得到參數：`: x(x)` 的右邊是參數）
  r.scope('cpp:constructor', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'inits')
    w.walkSlot(n, 'body')
  }))
}
