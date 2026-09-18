/**
 * `cpp:vector_declare` 的 **execute** 路
 *
 * ⚠️ **建構的行為與 `deque` 逐字相同**（初始化列／複製自／`(n)`／`(n, x)`），
 * 所以它住在 `runtime/sequence-declare`；這裡留的是**身分**與
 * 「我這一族的空容器長什麼樣」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { registerContainerDefault } from '../../../languages/cpp/lang/runtime/container-defaults'
import { declareSequence } from '../../../languages/cpp/lang/runtime/sequence-declare'

export function registerExecute(
  register: (component: string, executor: ComponentExecutor) => void,
): void {
  /** 🔴 同族：`vector<vector<int>> g(2)` 的每一格也是一個真的列表（見 `container-defaults`）。 */
  registerContainerDefault('vector', (inner) => ({
    type: 'array', value: [], ...(inner ? { elemType: inner } : {}),
  }))
  register('cpp:vector_declare', async (node, ctx) => { await declareSequence(node, ctx) })
}
