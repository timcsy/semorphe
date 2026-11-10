/** `cpp:return` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { isStreamWrite, isVariableRef } from '../../../languages/cpp/lang/node-traits'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:return', (n, f) => {
    const v = f.one(n, 'value')
    // `return os << a << b;`（自訂 operator<< 的教科書寫法）：Cella 的串流寫入只有敘述形狀（sOut），而寫入的結果就是那個串流本身，
    // 所以等於先寫、再回傳串流。⚠️ 只收左端是單純變數的（再求值一次沒有副作用）
    if (v && isStreamWrite(v.componentId) && isVariableRef(f.one(v, 'stream')?.componentId ?? '')) {
      return [...f.stmt(v), f.k('sReturn', { n: n.id, e: f.exprOf(v, 'stream') })]
    }
    return [f.k('sReturn', { n: n.id, e: v ? f.expr(v) : null })]
  })
}
