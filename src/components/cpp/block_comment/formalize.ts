/** `cpp:block_comment` 的 **formalize** 路（spec 199：6.0 量到學生的程式 有區塊註解）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 註解不是程式：不產生任何建構子（敘述位置與頂層都是）
  r.stmt('cpp:block_comment', () => [])
  r.item('cpp:block_comment', () => [])
}
