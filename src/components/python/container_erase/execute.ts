/**
 * `python:container_erase` 的 **execute** 路——`del d["a"]`／`del xs[0]`。
 *
 * 🔴 **求值的是「容器」那一格，不是整個左邊**——與同族的索引指派同一個理由：
 * 整個左邊求值會讀出那一格的值，而我們要的是那個容器本身。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_erase', async (node, ctx) => {
    const at = (node.children.target ?? [])[0]
    const inner = at?.children?.target?.[0]
    const keyNode = at?.children?.key?.[0]
    if (!inner || !keyNode) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個左邊不是「容器的某一格」' })
    }
    const container = await ctx.evaluate(inner)
    const key = await ctx.evaluate(keyNode)

    if (container.type === 'object') {
      const k = String(key.value)
      const m = container.value as ObjectFields
      // ⚠️ **刪一個不存在的鍵在 Python 是 KeyError**——不要靜靜略過
      if (!m.has(k)) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': k })
      m.delete(k)
      container.keyValues?.delete(k)
      return
    }
    if (container.type === 'array') {
      const xs = container.value as RuntimeValue[]
      let i = Math.trunc(ctx.toNumber(key))
      if (i < 0) i += xs.length
      if (i < 0 || i >= xs.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(key.value) })
      }
      xs.splice(i, 1)
      return
    }
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個東西刪不動' })
  })
}
