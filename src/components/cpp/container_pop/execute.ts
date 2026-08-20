/** `cpp:container_pop` 的 **execute** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { heapTopIndex } from '../../../languages/cpp/core/runtime/heap'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_pop', async (node, ctx) => {
      const name = String(node.properties.obj)
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (arr.value.length > 0) {
        if (arr.tag === 'queue') {
          arr.value.shift()
        } else if (arr.tag === 'priority_queue') {
          // 🔴 **拿掉的必須是 `top()` 剛給你的那一顆**，不是最後推入的。
          // 原本走 `pop()`（陣列末端），於是「看一眼再拿掉」這個最常見的
          // 用法會拿掉另一顆——而堆裡還剩幾個元素看起來完全正常。
          const i = heapTopIndex(arr.value, arr.heapOrder ?? 'max')
          if (i !== -1) arr.value.splice(i, 1)
        } else {
          arr.value.pop()
        }
      }
    })
}
