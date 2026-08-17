/**
 * `cpp:millis` 的 **execute** 路——讀**同一個**時鐘。
 *
 * ⚠️ 它與 `cpp:delay` 共用 `arduino-clock`，而那不是巧合：
 * 兩顆各記一份的話，「`delay` 推進了時間而 `millis` 讀得到」**就不成立**。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { nowMillis } from '../../../languages/cpp/core/runtime/arduino-clock'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:millis', async () => ({ type: 'int', value: nowMillis() }))
}
