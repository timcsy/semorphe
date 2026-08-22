/**
 * `python:splat` 的 **execute** 路——**回裡面那個值，不攤開**。
 *
 * 🔴 攤開是**吃它的人**做的事（引數列、字典字面），而那是一個
 * 「有幾格」的決定——一個運算式回不了「三個值」。
 * 少了這一條的症狀是 `total(*nums)` 收到一個串列當第一個引數。
 *
 * ⚠️ 所以直接求值到這裡＝**它出現在一個不該出現的地方**（`x = *xs`），
 * 而那要出聲：靜默回串列的話，使用者會看到一個型別莫名其妙的值。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:splat', async (node, ctx) => {
    void ctx
    const star = node.properties.kind === 'dict' ? '**' : '*'
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
      '%1': `${star} 只能用在呼叫的引數或字典字面裡`,
    })
  })
}
