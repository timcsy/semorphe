/**
 * `cpp:string_append_char` 的 **formalize** 路（spec 202）——`s.push_back(c)`，照 generate 送 eMCall。契約見 `core/formalize-contract.ts`。
 * ⚠️ 字元的接點有兩個名字（`char`／`value`，見 generate.ts 的說明），兩個都讀；都空時是洞（不補預設值）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_append_char', (n, f) => f.k('eMCall', {
    n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'push_back',
    args: [f.exprOf(n, f.one(n, 'char') ? 'char' : 'value')],
  }))
  // 當敘述用：運算式敘述
  r.stmt('cpp:string_append_char', (n, f) => f.exprStmt(n))
}
