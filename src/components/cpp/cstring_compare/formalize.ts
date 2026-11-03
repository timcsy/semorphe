/** `cpp:cstring_compare` 的 **formalize** 路（spec 205 T008：c-bridge/02 的「完成的樣子」用 strcmp，JS 直譯器拿掉之後在 C 目標下翻不出就跑不起來）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 同 cstring_size：函式庫的函式由 Cella 依名字解析；回傳值只保證正負號（[c.str.cmp]），比對時別比大小
  r.expr('cpp:cstring_compare', (n, f) => f.k('eCall', { n: n.id, f: 'strcmp', args: [f.exprOf(n, 's1'), f.exprOf(n, 's2')] }))
}
