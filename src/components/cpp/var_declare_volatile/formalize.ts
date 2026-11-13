/**
 * `cpp:var_declare_volatile` 的 **formalize** 路（438）。契約見 `core/formalize-contract.ts`。
 *
 * 🔴 **送出時去掉 `volatile`，照一般變數送**——2026-11-13 與 cella 談定：Cella 的機器是單執行緒、
 * 中斷只在等待點（`delay`／`loop` 之間）觸發，`volatile` 不改變任何一個判決。
 * 日後 Cella 有 `tVolatile`（像 `tConst` 一樣包住型別）時改送那個；語義樹一直記得它（來回一字不差）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:var_declare_volatile', (n, f, global) => {
    const t = f.type(n.properties?.type ?? 'bool', n)
    if (!t) return []
    return f.declVar(n, t, global)
  })
}
