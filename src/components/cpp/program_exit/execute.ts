/** `cpp:program_exit` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:program_exit', async () => { throw new RuntimeError(RUNTIME_ERRORS.ABORTED) })
}
