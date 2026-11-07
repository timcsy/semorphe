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
    // `get<1>(t)`（tuple／pair 取第 N 個；可以當左值寫入）：樣板引數是一個整數——送 eCallT（cella 0.1.202611060800 給的形狀：
    //    f 是 get、targs 是 [tVal N]）。名字是 `get<N>` 的一般呼叫照 eCall 送的話，Cella 找不到一個叫 `get<1>` 的函式
    const getN = /^(?:std::)?get\s*<\s*(\d+)\s*>$/.exec(name)
    if (getN) return f.k('eCallT', { n: n.id, f: 'get', targs: [f.k('tVal', { v: Number(getN[1]) })], args })
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
    // 🔴 名字帶樣板引數、上面每一種形狀都不是（`numeric_limits<int>::min()`）：照 eCall 送等於呼叫一個叫
    //    `numeric_limits<int>::min` 的函式，Cella 判「未宣告的名字」reject——**一支合法的程式被說成錯的**（P6）。
    //    2026-11-07 升 Cella 1526 時露出來（盲測 iterators fuzz_08：之前被 std::copy 的 unsupported 蓋住）。照實標翻不出。
    if (/>\s*::/.test(name)) return f.miss(n, `「${name}(…)」是樣板類別的靜態成員；還沒有對應`)
    // 🔴 名字是一個**型別**（`string("ab")`、`ostream_iterator<int>(cout, "")`）：是建一個暫時物件（[expr.type.conv]），同上面的 FUNCTOR
    //    與程式自己的 struct——不是呼叫一個叫 `string` 的函式。照 eCall 送，Cella 判「未宣告」reject（主樹上就有：`string("ab").size()`；
    //    ranges fuzz_7 在 1526 補上 std::copy 之後露出 `ostream_iterator<int>`）。`isTypeText` 不記 unknown，所以先問再翻
    if (!f.isFunctionName(name) && f.isTypeText(name)) {
      const t = f.type(name, n)
      if (t) return f.k('eTemp', { n: n.id, t, args })
    }
    // 其餘帶樣板引數的（`max<long long>(a, b)` 明確指定樣板引數的函式樣板呼叫）：照 eCall 送等於呼叫一個叫 `max<long long>` 的函式
    //    ——主樹上判「未宣告」reject（假的錯）。照實標翻不出
    if (name.includes('<')) return f.miss(n, `「${name}(…)」是帶樣板引數的呼叫（明確指定樣板引數的函式樣板，或還不認得的樣板型別）；還沒有對應`)
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
