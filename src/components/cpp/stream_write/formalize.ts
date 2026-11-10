/** `cpp:stream_write` 的 **formalize** 路：敘述位置對應 Cella 的 `sOut`；運算式位置 Cella 沒有對應，照實回 unknown。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { isNamedCall } from '../../../languages/cpp/lang/node-traits'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:stream_write', (n, f) => {
    // ⚠️ 左端是函式呼叫（`indent(os, 2) << x`）時，今天的 sOut 不會執行那個呼叫——它裡面印的東西安靜地不見（`ind(cout) << 5` 少了 ind 印的字）。問過 cella 之前照實不送
    if (isNamedCall(f.one(n, 'stream')?.componentId ?? '')) return [f.miss(n, '左端是函式呼叫的串流寫入還沒有對應')]
    return [f.k('sOut', { n: n.id, stream: f.exprOf(n, 'stream'), items: (n.slots?.values ?? []).map((c) => f.expr(c)) })]
  })
  r.expr('cpp:stream_write', (n, f) => f.miss(n, '運算式位置的串流寫入還沒有對應'))
}
