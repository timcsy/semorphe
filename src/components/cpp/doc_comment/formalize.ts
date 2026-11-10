/** `cpp:doc_comment` 的 **formalize** 路（399）——文件註解不產生程式（同 cpp:comment）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:doc_comment', () => [])
  r.item('cpp:doc_comment', () => [])
}
