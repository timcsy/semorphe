/**
 * `cpp:method_declare` 的 **formalize** 路（第 322 刀）——類別裡的原型 ＋ 類別外的定義 → 一個 `mbMethod`。
 *
 * Cella 的參照翻譯（`cella/tools/cfamily/cpp_to_tree.py` 的 `member`）：「a member defined outside the class: its definition
 * (the body, the member initializers, its parameters' names)」——本體與參數名取類別外那一顆；預設引數與 const 寫在類別裡這一行。
 * 類別外那一顆在頂層不送（它自己的 formalize 回 `[]`）。
 * 沒有定義（只宣告）：Cella 的 `fdef` 要有本體，參照翻譯也是 `has no body` 失敗——照實標翻不出，不補一個空本體。
 */
import type { FormalizeRegistrar, FormalizeContext } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'
import { memberKeyOf } from '../../../languages/cpp/member-key'

/** 參數預設值：同類別裡定義方法那顆（字面量照登記翻，其餘照實標翻不出） */
function defaultOf(q: SemanticNode | undefined, f: FormalizeContext): unknown {
  const text = String(q?.properties?.default ?? '').trim()
  if (!q || text === '') return null
  return f.literalExpr(text, `${q.id}/default`) ?? f.miss(q, `參數預設值「${text}」不是字面，還沒有對應`)
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.memberKey('cpp:method_declare', (n) => ({ key: memberKeyOf(n), isStatic: String(n.properties?.virt ?? 'none') === 'static' }))
  r.member('cpp:method_declare', (n, f) => {
    const def = f.outsideDefinition(n)
    if (!def) return f.miss(n, `類別裡宣告了方法 ${String(n.properties?.name ?? '')}，而類別外找不到它的定義（只宣告不定義）——還沒有對應`)
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const protoParams = n.slots?.params ?? []
    const params = (def.slots?.params ?? []).map((q, i) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: defaultOf(protoParams[i], f) }))
    const fdef = f.k('fdef', { n: def.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(def, 'body') })
    // `static int count();`（383）：[class.static.mfct] 沒有 this，Cella 的 mbStaticMethod 只收存取權與函式（參照翻譯 cpp_to_tree.py 的 member 同形）
    if (String(p.virt ?? 'none') === 'static') {
      // 🔴 Cella 0954 的誤判：靜態成員函式的本體讀靜態資料成員判 undeclared（與參照翻譯完全同形的 eVar 也一樣，383 實測）——
      //    一支合法的程式被說成錯的（P6）比翻不出嚴重，修好之前照實標翻不出（已附最小重現回報 cella）
      const cls = String(def.properties?.class_name ?? '')
      const readsStaticData = (x: SemanticNode): boolean => {
        const name = String(x.properties?.name ?? '')
        const leaf = Object.keys(x.slots ?? {}).length === 0
        if (leaf && name && (f.isClassMember(name) || f.isClassMember(`${cls}::${name}`))) return true
        return Object.values(x.slots ?? {}).some((kids) => kids.some(readsStaticData))
      }
      if ((def.slots?.body ?? []).some(readsStaticData)) return f.miss(n, `靜態成員函式 ${String(p.name ?? '')} 的本體讀了類別的成員：Cella 目前判 undeclared（已回報）——還沒有對應`)
      return f.k('mbStaticMethod', { acc: f.k('acPublic'), f: fdef })
    }
    return f.k('mbMethod', { acc: f.k('acPublic'), isConst: String(p.is_const ?? 'false') === 'true', expl: false, virt: f.k(({ virtual: 'vVirtual', override: 'vOverride' } as Record<string, string>)[String(p.virt ?? 'none')] ?? 'vNone'), f: fdef })
  })
}
