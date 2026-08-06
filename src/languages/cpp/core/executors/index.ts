import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { registerPointerExecutors } from './pointers'
import { registerContainerCoreExecutors } from './containers'
import { registerPreprocessorExecutors } from './preprocessor'
import { registerVariablesCoreExecutors } from './variables'
import { registerOperatorsCoreExecutors } from './operators'
import { registerMutationsCoreExecutors } from './mutations'
import { registerLiteralsCoreExecutors } from './literals'
import { registerFunctionsCoreExecutors } from './functions'
import { registerControlFlowCoreExecutors } from './control-flow'
import { registerArraysCoreExecutors } from './arrays'

/**
 * C++ 語言核心的執行路。
 *
 * 這裡放**不屬於任何標準函式庫標頭**的概念——指標、跨容器的泛用操作之類。
 * 與 `core/generators/`、`core/lifters/` 對稱。
 */
export function registerCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  registerPointerExecutors(register)
  registerContainerCoreExecutors(register)
  registerPreprocessorExecutors(register)
  registerVariablesCoreExecutors(register)
  registerOperatorsCoreExecutors(register)
  registerMutationsCoreExecutors(register)
  registerLiteralsCoreExecutors(register)
  registerFunctionsCoreExecutors(register)
  registerControlFlowCoreExecutors(register)
  registerArraysCoreExecutors(register)
}
