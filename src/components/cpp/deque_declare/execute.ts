/** `cpp:deque_declare` 的 **execute** 路——行為與同族的列表宣告共用（見 `runtime/sequence-declare`）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { registerContainerDefault } from '../../../languages/cpp/lang/runtime/container-defaults'
import { declareSequence } from '../../../languages/cpp/lang/runtime/sequence-declare'

export function registerExecute(
  register: (component: string, executor: ComponentExecutor) => void,
): void {
  /** 同族：`vector<deque<int>> bins(4);` 的每一格要是一個真的雙端佇列。 */
  registerContainerDefault('deque', (inner) => ({
    type: 'array', value: [], ...(inner ? { elemType: inner } : {}),
  }))
  register('cpp:deque_declare', async (node, ctx) => { await declareSequence(node, ctx) })
}
