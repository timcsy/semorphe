/** 這顆元件寫成 Python（455）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

const bare = (t: string | undefined): string => (t ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '').trim()
const INT = /^(int|long|long long|short|unsigned( int| long| long long)?|size_t)$/
const FLOAT = /^(double|float|long double)$/

export function registerToPython(r: ToPythonRegistrar): void {
  r.conditional()
  // `c ? a : b` → `(a if c else b)`：Python 的條件運算式優先級最低，一律加括號
  // ⚠️ C++ 兩個分支會先轉成共同型別（`c ? 1 : 2.5` 的 1 是 1.0），Python 不會——
  //    整數分支放進浮點的結果補 float()；其餘型別不同的照實保留
  r.expr((n, py) => {
    const cond = n.slots.condition?.[0]
    const a = n.slots.true_expr?.[0]
    const b = n.slots.false_expr?.[0]
    const t = bare(py.typeOf(n))
    const branch = (x: typeof a): string => {
      const tx = bare(py.typeOf(x))
      if (tx === t || t === '' || tx === '') return py.expr(x)
      if (FLOAT.test(t) && (INT.test(tx) || FLOAT.test(tx))) return INT.test(tx) ? `float(${py.expr(x)})` : py.expr(x)
      if (INT.test(t) && INT.test(tx)) return py.expr(x)
      // 字串字面量（`char[5]`）退化成 `char *`：兩邊在 Python 都是 str
      if (/^char \*$/.test(t) && /^char\[\d+\]$/.test(tx)) return py.expr(x)
      return py.keep(n, 'outside-subset', `條件運算式的分支型別（${tx}）與結果型別（${t}）不同，C++ 會先轉型`)
    }
    if (t === '') return py.keep(n, 'needs-types', '條件運算式的型別判斷不出來（C++ 會把兩個分支轉成共同型別）')
    return `(${branch(a)} if ${py.expr(cond)} else ${branch(b)})`
  })
}
