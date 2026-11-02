/** `cpp:func_def` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar, FormalizeContext } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

/**
 * 參數的預設值（`int b = 10`）：lift 把它留成**原文**（`param_decl.properties.default`），不是一棵子樹。
 * 字面（數字、字元、字串）就借那幾顆字面元件自己的 formalize 翻；其餘的運算式誠實 unknown（spec 203：
 * 在此之前一律送 `dflt: null`，於是 `add(1)` 被 Cella 判「no matching function」——那是我們少送了，不是 Cella 錯）。
 */
function defaultOf(q: SemanticNode, f: FormalizeContext): unknown {
  const text = String(q.properties?.default ?? '').trim()
  if (text === '') return null
  // 字面量照登記翻（哪一顆認得這段原文由元件自己登記——不點名身分；spec 203 的就近性護欄）
  const lit = f.literalExpr(text, `${q.id}/default`)
  if (lit) return lit
  return f.miss(q, `參數預設值「${text}」不是字面，還沒有對應`)
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:func_def', (n, f) => {
    const p = n.properties ?? {}
    // 回傳型別保留了學生寫的 `static`／`inline`／`extern`／`constexpr`（spec 204：產碼要一字不少）——它們是連結性與求值時機的事，
    // 在單一翻譯單元裡不改變執行結果，送給 Cella 的型別剝掉
    const retText = String(p.return_type ?? '').replace(/^(?:(?:static|inline|extern|constexpr)\s+)+/, '')
    const ret = retText === 'void' ? null : f.type(retText, n)
    // `f(void)`＝沒有參數（C11 6.7.6.3p10）——不是一個型別是 void 的參數（spec 197：`int main(void)` 整支卡在「型別 void 還沒有對應」）
    const raw = n.slots?.params ?? []
    const onlyVoid = raw.length === 1 && String(raw[0].properties?.type ?? '').trim() === 'void' && String(raw[0].properties?.name ?? '').trim() === ''
    const params = (onlyVoid ? [] : raw).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: defaultOf(q, f) }))
    return [f.k('iFun', { f: f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') }) })]
  })
  // 作用域：參數與本體同一層
  r.scope('cpp:func_def', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
