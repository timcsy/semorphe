/** `cpp:string_make` 的 **formalize** 路（第 331 刀：盲測三支用 `to_string` 組字串，原本這顆沒有 formalize、整支翻不出）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // `to_string(x)`：Cella 的 C++ 標準函式庫裡就是一般的函式呼叫
  r.expr('cpp:string_make', (n, f) => f.call(n, 'to_string', ['value']))
}
