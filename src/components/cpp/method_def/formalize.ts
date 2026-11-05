/** `cpp:method_def` 的 **formalize** 路（第 218 刀）——類別成員 mbMethod ＋ fdef（形狀同運算子多載那顆，cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar, FormalizeContext } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'


/**
 * 參數的預設值（`int k = 5`）：與一般函式那一份同一個翻法（`func_def/formalize.ts` 的 defaultOf）——字面量照登記翻，其餘照實標翻不出。
 * 🔴 2026-11-06（元件管線 311 的盲測抓到）：這裡原本送 `dflt: null`——預設值被**靜靜丟掉**，`p.g()` 這種合法呼叫會被判「引數太少」（P6）。
 */
function defaultOf(q: SemanticNode, f: FormalizeContext): unknown {
  const text = String(q.properties?.default ?? '').trim()
  if (text === '') return null
  const lit = f.literalExpr(text, `${q.id}/default`)
  if (lit) return lit
  return f.miss(q, `參數預設值「${text}」不是字面，還沒有對應`)
}
export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:method_def', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const params = (n.slots?.params ?? []).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: defaultOf(q, f) }))
    const fdef = f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') })
    return f.k('mbMethod', { acc: f.k('acPublic'), isConst: String(p.is_const ?? 'false') === 'true', expl: false, virt: f.k('vNone'), f: fdef })
  })
  // 作用域：參數與本體同一層（同頂層函式那顆）
  r.scope('cpp:method_def', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
