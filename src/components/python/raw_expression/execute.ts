/**
 * `python:raw_expression` 的 **execute** 路——**出聲，不要靜默回 0**。
 *
 * ⚠️ 回一個預設值（`0`／`''`）會讓「這段我看不懂」與「這段算出來是 0」
 * **長得一模一樣**——那是第三十三條護欄在看的靜默降級。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:raw_expression', async (node) => {
    const code = String(node.properties?.code ?? '').slice(0, 60)
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': code || '(空的)' })
  })
}
