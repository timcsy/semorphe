/** `cpp:var_declare` 的 **execute** 路——從共用檔原封剪過來（probe）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:var_declare', execVarDeclare)
}
