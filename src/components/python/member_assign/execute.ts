/**
 * `python:member_assign` 的 **execute** 路——`self.name = v`／`d.age = 3`。
 *
 * 🔴 **求值的是接收者，不是整個左邊**——整個左邊求值會讀出那個欄位現在的值。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:member_assign', async (node, ctx) => {
    const at = (node.children.target ?? [])[0]
    const recvNode = at?.children?.obj?.[0]
    const field = String(at?.properties?.member ?? '')
    if (!recvNode || !field) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個左邊不是「某個東西的欄位」' })
    }
    const recv = await ctx.evaluate(recvNode)
    const v = await ctx.evaluate(node.children.value[0])
    if (recv.type !== 'object') {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${field} 的接收者不是一個物件` })
    }
    ;(recv.value as ObjectFields).set(field, v)
  })
}
