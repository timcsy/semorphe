/** `python:compare` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:compare', async (node, ctx) => {
    const op = String(node.properties.operator ?? '<')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])
    // 兩邊都是字串時比字典序 —— Python 的字串是可比較的。
    const bothStr = l.type === 'string' && r.type === 'string'
    const a: string | number = bothStr ? String(l.value) : ctx.toNumber(l)
    const b: string | number = bothStr ? String(r.value) : ctx.toNumber(r)
    switch (op) {
      case '<': return { type: 'bool', value: a < b }
      case '>': return { type: 'bool', value: a > b }
      case '<=': return { type: 'bool', value: a <= b }
      case '>=': return { type: 'bool', value: a >= b }
      case '==': return { type: 'bool', value: a === b }
      case '!=': return { type: 'bool', value: a !== b }
      default: throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': op })
    }
  })
}
