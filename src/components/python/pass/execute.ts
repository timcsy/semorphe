/**
 * `python:pass` 的 **execute** 路——**什麼都不做，而它不是「還沒做」**。
 *
 * ⚠️ 這個空是語義上的空：`pass` 的意思就是「這裡刻意沒有動作」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:pass', async (node, ctx) => { void node; void ctx })
}
