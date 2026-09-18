/** `cpp:deque_declare` 的 **generate** 路——形狀與同族的列表宣告共用（見 `runtime/sequence-declare`）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateSequenceDeclare } from '../../../languages/cpp/lang/runtime/sequence-declare'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:deque_declare', generateSequenceDeclare('deque', 'dq'))
}
