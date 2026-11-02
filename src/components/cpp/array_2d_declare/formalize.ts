/** `cpp:array_2d_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_2d_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const rows = f.constInt(f.one(n, 'rows')), cols = f.constInt(f.one(n, 'cols'))
    const hasInit = (n.slots?.values ?? []).length > 0
    // 外層可變、內層固定的 VLA（`int g[n][5]`）：sDeclV 的 elem 是內層的 tArr（第 217 刀，見 array_declare）
    if (rows === null && cols !== null && !global && !hasInit) {
      return [f.k('sDeclV', { n: n.id, x: n.id, name: String(n.properties?.name ?? ''), elem: f.k('tArr', { t: elem, n: cols }), len: f.exprOf(n, 'rows') })]
    }
    if (rows === null || cols === null) { f.miss(n, cols === null ? '二維陣列的內層長度不是整數字面（Cella 的 VLA 只有外層可變）' : '二維陣列的長度不是整數字面（全域或帶初值時長度要是常數）'); return [] }
    const t = f.k('tArr', { t: f.k('tArr', { t: elem, n: cols }), n: rows })
    const init = hasInit ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
