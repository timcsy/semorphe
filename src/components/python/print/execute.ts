/**
 * `python:print` 的 **execute** 路。
 *
 * ⚠️ **Python 的 `print` 用【空格】分隔引數並在最後換行**——
 * 那與 C++ 的 `cout << a << b`（不分隔、不換行）不同，
 * 而它正是「同一個 ioRole、不同的行為」的一個實例。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:print', async (node, ctx) => {
    const parts: string[] = []
    for (const v of node.children.values ?? []) {
      const r = await ctx.evaluate(v)
      parts.push(fmt(r))
    }
    ctx.io.write(parts.join(' ') + '\n')
  })
}

/**
 * Python 印出來的樣子——⚠️ **與 C++ 的不同，而差別會被使用者一眼看到**。
 *
 * ```
 * True / False    首字母大寫（C++ 印 1 / 0）
 * None            而不是空字串
 * 3.0             小數保留小數點（C++ 的 3.0 印成 3）
 * ```
 */
function fmt(r: { type: string; value: unknown }): string {
  if (r.type === 'bool') return r.value ? 'True' : 'False'
  if (r.type === 'void' || r.value === null) return 'None'
  if (r.type === 'double') {
    const n = Number(r.value)
    // `3.5` → `3.5`；`3.0` → `3.0`（Python 不會把它印成 `3`）
    return Number.isInteger(n) ? `${n}.0` : String(n)
  }
  return String(r.value)
}
