/** `cpp:io_tie` 的 **formalize** 路（spec 199：6.0 量到學生的程式 135 支有 `cin.tie(0)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // `cin.tie(0)` 只改「讀之前要不要先把 cout 沖出去」——什麼時候沖，不改印出來的內容：不產生建構子
  r.stmt('cpp:io_tie', () => [])
}
