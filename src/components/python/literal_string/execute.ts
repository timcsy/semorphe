/**
 * `python:literal_string` 的 **execute** 路。
 *
 * 🔴 **屬性存的是「使用者寫的樣子」**（`第一行\\n第二行`），跳脫在這裡才還原
 * ——與 C++ 那顆一字不差的做法。少了這一步的症狀是 `print("a\\nb")` 印出
 * 一個反斜線加一個 n：不報錯、有輸出、而**看得見地錯**。
 *
 * ⚠️ 共用 `unescapeC`：`\\n`／`\\t`／`\\"`／`\\\\` 兩個語言完全相同。
 * Python 多出來的 `\\N{…}`／`\\u` 這個工具還沒有——那是一個**已知的邊界**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { unescapeC } from '../../../core/registry/transform-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:literal_string', async (node) => ({
    type: 'string' as const,
    value: unescapeC(String(node.properties.value ?? '')),
  }))
}
