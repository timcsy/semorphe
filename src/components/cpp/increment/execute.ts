/** `cpp:increment` 的 **execute** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { execIncrement } from '../../../interpreter/executors/mutations'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:increment', execIncrement)
}
