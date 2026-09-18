/**
 * `cpp:io_flush` 的 **execute** 路——**一個真正的 no-op，而那不是敷衍**。
 *
 * `ctx.io.write(text)` 是 `push` ＋ 立刻呼叫 callback（`interpreter/io.ts`）
 * ——**這個直譯器的輸出沒有緩衝**。而 C++ 的 `flush` 在一個沒有緩衝的實作上
 * 本來就沒有可觀察的效果。
 *
 * > **一個「什麼都不做」的實作，與一個「還沒做」的實作長得一樣
 * > ——差別只在有沒有人寫下為什麼。**
 *
 * ⚠️ 回傳**空字串**而不是不回傳：輸出那一路對每一項都要求一個值，
 *    而「印出零個字」與「這一項不存在」在那條路上是兩件事。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:io_flush', async () => ({ type: 'string' as const, value: '' }))
}
