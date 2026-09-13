import { registerUnimplementedExecutors } from './unimplemented'
import type { ComponentExecutor } from '../../../../interpreter/executor-registry'

/**
 * C++ 語言核心的執行路。
 *
 * 這裡放**不屬於任何標準函式庫標頭**的概念——指標、跨容器的泛用操作之類。
 * 與 `core/generators/`、`core/lifters/` 對稱。
 */
export function registerCoreExecutors(
  register: (component: string, executor: ComponentExecutor) => void,
): void {
  registerUnimplementedExecutors(register)
}
