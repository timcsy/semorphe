/**
 * `cpp:time` 的 **execute** 路——現在的時間（從 1970 年算起的秒數）。
 *
 * ⚠️ 每次執行不同，與真的程式一致：課文用它當亂數種子，正是要「每一次跑都不一樣」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:time', async () => ({ type: 'int', value: Math.floor(Date.now() / 1000) }))
}
