/** `cpp:time` 的 **formalize** 路——`time(0)` 是一般的函式呼叫（引數是空指標常數 0）。Cella 沒有模型時判 unknown／unsupported。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:time', (n, f) => f.k('eCall', { n: n.id, f: 'time', args: [f.k('eNum', { n: `${n.id}/arg`, v: 0 })] }))
}
