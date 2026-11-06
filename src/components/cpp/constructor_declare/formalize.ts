/**
 * `cpp:constructor_declare` 的 **formalize** 路（第 322 刀）——類別裡的原型 ＋ 類別外的定義 → 一個 `mbCtor`
 *（形狀同類別裡定義建構子那顆）。初始化列、本體、參數名取類別外那一顆；預設引數取這一行（Cella 參照翻譯的 `member`）。
 * 沒有定義：照實標翻不出（不補空本體）。
 */
import type { FormalizeRegistrar, FormalizeContext } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'
import { constructorKeyOf } from '../../../languages/cpp/member-key'

function defaultOf(q: SemanticNode | undefined, f: FormalizeContext): unknown {
  const text = String(q?.properties?.default ?? '').trim()
  if (!q || text === '') return null
  return f.literalExpr(text, `${q.id}/default`) ?? f.miss(q, `參數預設值「${text}」不是字面，還沒有對應`)
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.memberKey('cpp:constructor_declare', (n) => ({ key: constructorKeyOf(n) }))
  r.member('cpp:constructor_declare', (n, f) => {
    const def = f.outsideDefinition(n)
    if (!def) return f.miss(n, `類別裡宣告了建構子，而類別外找不到它的定義（只宣告不定義）——還沒有對應`)
    const proto = n.slots?.params ?? []
    const params = (def.slots?.params ?? []).map((q, i) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: defaultOf(proto[i], f) }))
    const inits = (def.slots?.inits ?? []).map((a) =>
      f.k('minit', { n: a.id, field: String(f.one(a, 'target')?.properties?.name ?? ''), args: [f.exprOf(a, 'value')] }))
    return f.k('mbCtor', { acc: f.k('acPublic'), n: def.id, expl: false, noexc: false, params, inits, body: f.block(def, 'body') })
  })
}
