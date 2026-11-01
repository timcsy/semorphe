/** `cpp:comma_expr` 的 **formalize** 路（spec 199：6.0 量到學生的程式 109 支用逗號運算式（`ios::sync_with_stdio(0), cin.tie(0)`））。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // `a, b, c` ＝ `(a, b), c`：左結合折成 eComma（cpp_to_tree.py 同形）；中間那幾層的標籤是 `<id>/<i>`
  r.expr('cpp:comma_expr', (n, f) => {
    const xs = (n.slots?.exprs ?? []).map((c) => f.expr(c))
    if (xs.length === 0) return f.k('eHole', { n: `${n.id}#exprs` })
    return xs.slice(1).reduce((a, b, i) => f.k('eComma', { n: i === xs.length - 2 ? n.id : `${n.id}/${i + 1}`, a, b }), xs[0])
  })
  // 敘述位置：`a, b;` 等於 `a; b;`（逗號運算子有序列點、值丟掉）——每一個運算元當一句敘述翻。
  // 這樣 `ios::sync_with_stdio(0), cin.tie(0);` 的兩個運算元走它們自己的敘述翻法（spec 199：學生的程式 134 支）
  r.stmt('cpp:comma_expr', (n, f) => (n.slots?.exprs ?? []).flatMap((c) => f.asStatement(c)))
}
