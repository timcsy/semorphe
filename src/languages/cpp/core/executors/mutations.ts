/**
 * mutations 的語言專屬執行路——4 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { execIncrement, execCompoundAssign } from '../../../../interpreter/executors/mutations'


export function registerMutationsCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:increment', execIncrement)



  register('cpp:var_assign_compound', execCompoundAssign)

}

