/** `cpp:comment` 的 **formalize** 路（spec 199：6.0 量到學生的程式 107 支有註解，而它沒有 formalize——任何一行註解都讓整支翻不出）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 註解不是程式：不產生任何建構子（敘述位置與頂層都是）
  r.stmt('cpp:comment', () => [])
  r.item('cpp:comment', () => [])
}
