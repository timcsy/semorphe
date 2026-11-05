/** `cpp:func_call` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

/** `<functional>` 的函式物件類別（帶範本引數）：`greater<int>`、`std::less<>`… */
const FUNCTOR = /^(?:std::)?(?:greater|less|greater_equal|less_equal|equal_to|not_equal_to|plus|minus|multiplies|divides|modulus|negate|logical_and|logical_or|logical_not|bit_and|bit_or|bit_xor|hash)\s*<.*>$/

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:func_call', (n, f) => {
    const name = String(n.properties?.name ?? '')
    // spec 200：函式形巨集在運算式位置沒有被展開——照送會被判「呼叫未宣告的函式」（假的 reject），照實標翻不出
    if (f.functionMacro(name)) return f.miss(n, `「${name}(…)」是函式形巨集；運算式位置的展開還沒有對應`)
    // `greater<int>()` 是建一個暫時的函式物件（函式風格轉型，[expr.type.conv]），不是呼叫一個叫 greater<int> 的函式
    // ——照 eCall 送會被判「呼叫未宣告的函式」（假的 reject；Cella 0.1.202611021533 露出來的）。形狀是 eTemp，名字寫完整的 `std::greater`（cella 2026-11-03 給的）
    if (FUNCTOR.test(name)) {
      const t = f.type(name, n) as { k: string; name?: string } | null
      if (!t) return f.miss(n, `「${name}()」是建一個暫時的函式物件；這個型別還沒有對應`)
      const full = t.k === 'tTemplate' && t.name && !t.name.startsWith('std::') ? { ...t, name: `std::${t.name}` } : t
      return f.k('eTemp', { n: n.id, t: full, args: (n.slots?.args ?? []).map((c) => f.expr(c)) })
    }
    const args = (n.slots?.args ?? []).map((c) => f.expr(c))
    // 成員函式裡用裸名字呼叫同一個類別的方法：隱含的 this（spec 208；原本送 eCall，被判「呼叫未宣告的函式」）
    //   ⚠️ 名字指到區域變數（lambda）的情況在下面先由 declOf 接住——那個比類別的方法更近
    if (!f.declOf(n.id) && f.isOwnMethod(n.id, name)) return f.k('eMCall', { n: n.id, obj: f.k('eThis', { n: `${n.id}/this` }), arrow: true, f: name, args })
    // `Rect("A", 3, 4)`：名字是程式裡定義的類別／struct ⟹ 建一個暫時物件（[expr.type.conv]），不是呼叫一個叫 Rect 的函式。
    //   照 eCall 送會被判「呼叫未宣告的函式」——一支合法的程式被說成錯的（P6；2026-11-06 元件管線 311 的盲測抓到）。形狀照 cpp_to_tree.py：eTemp
    //   ⚠️ 要在「名字指到一個變數」之前：作用域走訪會把類別名解析到它自己的宣告（`P q = P(3)` 實測），那時會被誤送成呼叫一個值
    if (f.isStructName(name)) {
      const t = f.type(name, n)
      if (!t) return f.miss(n, `「${name}(…)」是建一個暫時物件；這個型別還沒有對應`)
      return f.k('eTemp', { n: n.id, t, args })
    }
    // 名字指到一個變數（`auto add = [&](int x){…}; add(5)`）：呼叫的是那個值，不是一個叫 add 的函式——eCallE（cpp_to_tree.py 同形；第 206 刀）
    const x = f.declOf(n.id)
    if (x) return f.k('eCallE', { n: n.id, callee: f.k('eName', { n: `${n.id}/callee`, name }), args })
    return f.k('eCall', { n: n.id, f: f.identMacro(name), args })
  })
  // 作用域：名字照常解析——指得到變數宣告的就是在呼叫那個值（函式定義不進作用域表，所以呼叫函式不會被誤認）
  r.scope('cpp:func_call', (n, w) => {
    w.resolveIfDeclared(n.id, String(n.properties?.name ?? ''))
    w.walkSlots(n)
  })
  // 當敘述用：運算式敘述
  r.stmt('cpp:func_call', (n, f) => f.exprStmt(n))
}
