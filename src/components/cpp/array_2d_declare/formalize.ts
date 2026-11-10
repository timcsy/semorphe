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
    // 🟢 外層沒寫長度（`int qs[][2] = {{0, 2}, {1, 6}};`）：送 `tArrU`，長度由初值的項數定——與一維那顆同一個形狀（tArrU）。
    //    第 402 刀之前這裡把「沒有的長度」當成運算式送 tArrE，Cella 照實說「帶初值的 VLA」→ unknown（盲測 fuzz-cpp-student-mixed 的兩支）
    const inner = dim('cols', elem, cols)
    const t = f.one(n, 'rows') === undefined ? f.k('tArrU', { t: inner }) : dim('rows', inner, rows)
    const init = hasInit ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
