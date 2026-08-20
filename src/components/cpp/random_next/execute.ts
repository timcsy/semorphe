/** `cpp:random_next` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:random_next', async () => ({ type: 'int' as const, value: Math.floor(Math.random() * 32768) }))
}
