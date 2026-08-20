/** `cpp:var_declare_constexpr` 的 **execute** 路——從共用檔原封剪過來（批次第二十二批：修飾詞 → 身分的登錄）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:var_declare_constexpr', execVarDeclare)
}
