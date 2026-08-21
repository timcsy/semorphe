/**
 * `python:literal_number` 的 **execute** 路。
 *
 * ⚠️ **整數與小數要分開回**——Python 的 `3` 與 `3.0` 印出來不一樣，
 * 而全部回 `double` 會讓 `print(3)` 印出 `3.0`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:literal_number', async (node) => {
    const raw = String(node.properties.value ?? '0')
    const n = Number(raw)
    // 原文裡有小數點或指數 → 它是小數，即使值剛好是整數（`3.0`）。
    const isFloat = /[.eE]/.test(raw)
    return { type: isFloat ? ('double' as const) : ('int' as const), value: n }
  })
}
