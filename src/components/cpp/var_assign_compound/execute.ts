/** `cpp:var_assign_compound` 的 **execute** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { execCompoundAssign } from '../../../interpreter/executors/mutations'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:var_assign_compound', execCompoundAssign)
}
