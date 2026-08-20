/** `cpp:var_declare` 的 **execute** 路——從共用檔原封剪過來（probe）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:var_declare', execVarDeclare)
}
