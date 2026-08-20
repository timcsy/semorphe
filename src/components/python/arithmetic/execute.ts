/** `python:arithmetic` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:arithmetic', async (node, ctx) => {
    const op = String(node.properties.operator ?? '+')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])
    // 字串相加是 Python 的合法運算，而 `+` 以外都不是。
    if (op === '+' && l.type === 'string' && r.type === 'string') {
      return { type: 'string', value: String(l.value) + String(r.value) }
    }
    const a = ctx.toNumber(l), b = ctx.toNumber(r)
    switch (op) {
      case '+': return { type: 'double', value: a + b }
      case '-': return { type: 'double', value: a - b }
      case '*': return { type: 'double', value: a * b }
      // Python 的 `/` 一律是浮點除法 —— 與 C++ 的整數除法【不同】。
      case '/':
        if (b === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO, {})
        return { type: 'double', value: a / b }
      case '//':
        if (b === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO, {})
        return { type: 'int', value: Math.floor(a / b) }
      case '%':
        if (b === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO, {})
        // Python 的取餘數跟著除數的正負號 —— `-7 % 3` 是 2，不是 -1。
        return { type: 'double', value: ((a % b) + b) % b }
      case '**': return { type: 'double', value: a ** b }
      default:
        // 判不出來就丟錯，不要回 0。
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': op })
    }
  })
}
