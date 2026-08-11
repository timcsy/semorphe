import { registerLambdaExecutors } from './lambda'
import { registerUnimplementedExecutors } from './unimplemented'
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { registerFunctionsCoreExecutors } from './functions'
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
  registerFunctionsCoreExecutors(register)
  registerLambdaExecutors(register)
  registerUnimplementedExecutors(register)
  registerArraysCoreExecutors(register)
}
