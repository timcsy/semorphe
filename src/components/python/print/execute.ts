/**
 * `python:print` 的 **execute** 路。
 *
 * ⚠️ 「一個值印出來長什麼樣」住在 `languages/python/value-display.ts`
 * ——`str(x)` 與格式化文字的每一格用的是**同一份**。
 *
 * ⚠️ **Python 的 `print` 用【空格】分隔引數並在最後換行**——
 * 那與 C++ 的 `cout << a << b`（不分隔、不換行）不同，
 * 而它正是「同一個 ioRole、不同的行為」的一個實例。
 *
 * 🔴 **而那兩個是可以改的**：`end=` 與 `sep=`。少了它們的症狀不是少換一行
 * ——關鍵字包裹會被當成**一個要印出來的值**，於是
 * `print(1, end=" ")` 印出 `1 ['__kw__end', ' ']`（2026-08-22 語料抓到）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
// 🔴 **印出來的樣子只有一份**——見那個模組的檔頭：它一度有兩份，
//    於是 `print([1, 2])` 印出 `[object Object]`。
import { pythonDisplay } from '../../../languages/python/value-display'
// 🔴 **關鍵字引數的包裝只有一份**——`print(x, end=" ")` 的 `end=` 與
//    `sorted(xs, key=f)` 的 `key=` 是同一個機制，拆包也該是同一份。
import { kwArg, positional } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:print', async (node, ctx) => {
    const all = []
    for (const v of node.children.values ?? []) all.push(await ctx.evaluate(v))
    // ⚠️ `end` 與 `sep` 的**預設值是 Python 的規則**，不是這裡的巧合
    const end = kwArg(all, 'end')
    const sep = kwArg(all, 'sep')
    const parts = positional(all).map((r) => pythonDisplay(r))
    ctx.io.write(parts.join(sep ? String(sep.value) : ' ') + (end ? String(end.value) : '\n'))
  })
}
