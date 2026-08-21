/**
 * `python:print` 的 **execute** 路。
 *
 * ⚠️ 「一個值印出來長什麼樣」住在 `languages/python/value-display.ts`
 * ——`str(x)` 與格式化文字的每一格用的是**同一份**。
 *
 * ⚠️ **Python 的 `print` 用【空格】分隔引數並在最後換行**——
 * 那與 C++ 的 `cout << a << b`（不分隔、不換行）不同，
 * 而它正是「同一個 ioRole、不同的行為」的一個實例。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
// 🔴 **印出來的樣子只有一份**——見那個模組的檔頭：它一度有兩份，
//    於是 `print([1, 2])` 印出 `[object Object]`。
import { pythonDisplay } from '../../../languages/python/value-display'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:print', async (node, ctx) => {
    const parts: string[] = []
    for (const v of node.children.values ?? []) {
      const r = await ctx.evaluate(v)
      parts.push(pythonDisplay(r))
    }
    ctx.io.write(parts.join(' ') + '\n')
  })
}
