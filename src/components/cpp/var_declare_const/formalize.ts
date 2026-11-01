/** `cpp:var_declare_const` 的 **formalize** 路（spec 199：6.0 量到學生的程式 6 支用 const 宣告常數）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:var_declare_const', (n, f, global) => {
    const t = f.type(n.properties?.type ?? 'int', n)
    if (!t) return []
    const init = f.one(n, 'initializer')
    if (!init) return [f.miss(n, 'const 沒有初值')]
    return f.declInit(n, f.k('tConst', { t }), f.initOf(init), global)
  })
  // 編譯期的整數值：初值是整數字面（`const int N = 100;`）——`int a[N]` 的長度問這一條（spec 199）
  r.constInt('cpp:var_declare_const', (n, f) => f.constInt(f.one(n, 'initializer')))
}
