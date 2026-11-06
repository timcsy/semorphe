/**
 * `cpp:destructor_declare` 的 **formalize** 路（第 322 刀）——類別裡的原型 ＋ 類別外的定義 → 一個 `mbDtor`
 *（virtual 取這一行、本體取類別外那一顆；同類別裡定義解構子那顆的形狀）。沒有定義：照實標翻不出。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { DESTRUCTOR_KEY } from '../../../languages/cpp/member-key'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.memberKey('cpp:destructor_declare', () => ({ key: DESTRUCTOR_KEY }))
  r.member('cpp:destructor_declare', (n, f) => {
    const def = f.outsideDefinition(n)
    if (!def) return f.miss(n, `類別裡宣告了解構子，而類別外找不到它的定義（只宣告不定義）——還沒有對應`)
    return f.k('mbDtor', { virt: String(n.properties?.is_virtual ?? 'false') === 'true', n: def.id, body: f.block(def, 'body') })
  })
}
