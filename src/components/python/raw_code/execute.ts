/**
 * `python:raw_code` 的 **execute** 路——**出聲，不要靜默略過**。
 *
 * 這顆裝的是辨識不出來的原始程式碼。執行一段沒有語義的文字做不到，
 * 所以它丟一個 `unknownComponentHandler` 接得住的錯誤：
 * **使用者可以選擇跳過或中止，但不會不知道。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:raw_code', async (node) => {
    // 退路是 `''`，與宣告的 `default` 一致（第二十三條護欄，硬性零）。
    const code = String(node.properties?.code ?? '').slice(0, 60)
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': code || '(空的)' })
  })
}
