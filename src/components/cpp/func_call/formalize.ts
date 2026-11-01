/** `cpp:func_call` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:func_call', (n, f) => {
    const args = (n.slots?.args ?? []).map((c) => f.expr(c))
    // 名字指到一個變數（`auto add = [&](int x){…}; add(5)`）：呼叫的是那個值，不是一個叫 add 的函式——eCallE（cpp_to_tree.py 同形；第 206 刀）
    const x = f.declOf(n.id)
    if (x) return f.k('eCallE', { n: n.id, callee: f.k('eVar', { n: `${n.id}/callee`, x }), args })
    return f.k('eCall', { n: n.id, f: f.identMacro(String(n.properties?.name ?? '')), args })
  })
  // 作用域：名字照常解析——指得到變數宣告的就是在呼叫那個值（函式定義不進作用域表，所以呼叫函式不會被誤認）
  r.scope('cpp:func_call', (n, w) => {
    w.resolveIfDeclared(n.id, String(n.properties?.name ?? ''))
    w.walkSlots(n)
  })
  // 當敘述用：運算式敘述
  r.stmt('cpp:func_call', (n, f) => f.exprStmt(n))
}
