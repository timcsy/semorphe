/** `cpp:array_2d_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_2d_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const rows = f.constInt(f.one(n, 'rows')), cols = f.constInt(f.one(n, 'cols'))
    const hasInit = (n.slots?.values ?? []).length > 0
    // 🟢 長度不是我們算得出的整數字面時，內外層各自把運算式原樣交給 Cella（`tArrE`，cella 0.1.202611060800；同一維那顆）：
    //    常數就照定長、不是常數照 VLA 的規則；內層的 VLA Cella 照實判 unknown。原本這裡自己判「標翻不出」或送 sDeclV
    const dim = (slot: 'rows' | 'cols', inner: unknown, len: number | null) =>
      len !== null ? f.k('tArr', { t: inner, n: len }) : f.k('tArrE', { t: inner, len: f.exprOf(n, slot) })
    void global
    const t = dim('rows', dim('cols', elem, cols), rows)
    const init = hasInit ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
