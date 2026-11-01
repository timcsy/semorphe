/** `cpp:var_declare_constexpr` 的 **formalize** 路（第 207 刀：`constexpr int N = …;`——對判決而言與 const 一樣是唯讀、初值是編譯期常數）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:var_declare_constexpr', (n, f, global) => {
    const t = f.type(n.properties?.type ?? 'int', n)
    if (!t) return []
    const init = f.one(n, 'initializer')
    if (!init) return [f.miss(n, 'constexpr 沒有初值')]
    return f.declInit(n, f.k('tConst', { t }), f.initOf(init), global)
  })
  r.constInt('cpp:var_declare_constexpr', (n, f) => f.constInt(f.one(n, 'initializer')))
}
