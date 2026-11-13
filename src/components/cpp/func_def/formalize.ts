/** `cpp:func_def` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { memberKeyOf } from '../../../languages/cpp/member-key'

/** 學生寫在回傳型別前面的修飾字（lift 留在 `return_type`，產碼要一字不少）。 */
const LEAD = /^(?:(?:static|inline|extern|constexpr)\s+)+/

/**
 * 參數的預設值（`int b = 10`）：lift 把它留成**原文**（`param_decl.properties.default`），不是一棵子樹。
 * 字面（數字、字元、字串）就借那幾顆字面元件自己的 formalize 翻；其餘的運算式誠實 unknown（spec 203：
 * 在此之前一律送 `dflt: null`，於是 `add(1)` 被 Cella 判「no matching function」——那是我們少送了，不是 Cella 錯）。
 */

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:func_def', (n, f) => {
    const p = n.properties ?? {}
    // 438：`IRAM_ATTR` 只決定函式放進哪段記憶體（ESP32／ESP8266 的中斷函式要在 IRAM），不改變執行結果——在板子上送出時去掉（cella 11-13 談定）。
    //    不在板子上它不是標準 C++ 的東西（未宣告的巨集），照實翻不出
    if (p.attribute && !f.options.board) return [f.miss(n, `「${String(p.attribute)}」是板子核心的巨集，不是標準 C++`)]
    // 回傳型別保留了學生寫的 `static`／`inline`／`extern`／`constexpr`（spec 204：產碼要一字不少）——它們是連結性與求值時機的事，
    // 在單一翻譯單元裡不改變執行結果，送給 Cella 的型別剝掉
    const retText = String(p.return_type ?? '').replace(LEAD, '')
    const ret = retText === 'void' ? null : f.type(retText, n)
    // `f(void)`＝沒有參數（C11 6.7.6.3p10）——不是一個型別是 void 的參數（spec 197：`int main(void)` 整支卡在「型別 void 還沒有對應」）
    const raw = n.slots?.params ?? []
    const onlyVoid = raw.length === 1 && String(raw[0].properties?.type ?? '').trim() === 'void' && String(raw[0].properties?.name ?? '').trim() === ''
    const params = (onlyVoid ? [] : raw).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: f.defaultArgument(q) }))
    return [f.k('iFun', { f: f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') }) })]
  })
  // 類別裡帶本體、回傳型別前有修飾字的成員函式（396，lifter 的 plainShape 不收它們，於是走這一顆）。
  // `static` 是 [class.static.mfct]：沒有 this（同類別外定義的 method_declare 那條，mbStaticMethod）；`inline`／`constexpr` 不改變執行結果，就是一般成員函式。
  r.memberKey('cpp:func_def', (n) => ({ key: memberKeyOf(n), isStatic: /^(?:(?:inline|constexpr)\s+)*static\s/.test(String(n.properties?.return_type ?? '')) }))
  r.member('cpp:func_def', (n, f) => {
    const p = n.properties ?? {}
    const lead = LEAD.exec(String(p.return_type ?? ''))?.[0] ?? ''
    if (lead === '' || /\bextern\b/.test(lead)) return f.miss(n, `類別裡這個成員函式的形狀（${String(p.name ?? '')}）還沒有對應`)
    const retText = String(p.return_type).slice(lead.length)
    const ret = retText === 'void' ? null : f.type(retText, n)
    const params = (n.slots?.params ?? []).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: f.defaultArgument(q) }))
    const fdef = f.k('fdef', { n: n.id, noexc: false, name: String(p.name ?? ''), ret, params, body: f.block(n, 'body') })
    return /\bstatic\b/.test(lead)
      ? f.k('mbStaticMethod', { acc: f.k('acPublic'), f: fdef })
      : f.k('mbMethod', { acc: f.k('acPublic'), isConst: false, expl: false, virt: f.k('vNone'), f: fdef })
  })
  // 作用域：參數與本體同一層
  r.scope('cpp:func_def', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.walkSlot(n, 'body')
  }))
}
