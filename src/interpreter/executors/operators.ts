import type { ConceptExecutor } from '../executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerOperatorExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('arithmetic', async (node, ctx) => {
    const op = String(node.properties.operator)
    const left = await ctx.evaluate(node.children.left[0])
    const right = await ctx.evaluate(node.children.right[0])
    const lv = ctx.toNumber(left)
    const rv = ctx.toNumber(right)

    let result: number
    switch (op) {
      case '+': result = lv + rv; break
      case '-': result = lv - rv; break
      case '*': result = lv * rv; break
      case '/':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv / rv; break
      case '%':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv % rv; break
      case '&': result = lv & rv; break
      case '|': result = lv | rv; break
      case '^': result = lv ^ rv; break
      case '<<': result = lv << rv; break
      case '>>': result = lv >> rv; break
      default: result = 0
    }

    if (left.type === 'int' && right.type === 'int') {
      return { type: 'int', value: Math.trunc(result) }
    }
    return { type: 'double', value: result }
  })

  register('compare', async (node, ctx) => {
    const op = String(node.properties.operator)
    const left = await ctx.evaluate(node.children.left[0])
    const right = await ctx.evaluate(node.children.right[0])
    const lv = ctx.toNumber(left)
    const rv = ctx.toNumber(right)

    let result: boolean
    switch (op) {
      case '<': result = lv < rv; break
      case '>': result = lv > rv; break
      case '<=': result = lv <= rv; break
      case '>=': result = lv >= rv; break
      case '==': result = lv === rv; break
      case '!=': result = lv !== rv; break
      default: result = false
    }
    return { type: 'bool', value: result }
  })

  register('logic', async (node, ctx) => {
    const op = String(node.properties.operator)
    const left = await ctx.evaluate(node.children.left[0])

    if (op === '&&') {
      if (!ctx.toBool(left)) return { type: 'bool', value: false }
      const right = await ctx.evaluate(node.children.right[0])
      return { type: 'bool', value: ctx.toBool(right) }
    }
    if (op === '||') {
      if (ctx.toBool(left)) return { type: 'bool', value: true }
      const right = await ctx.evaluate(node.children.right[0])
      return { type: 'bool', value: ctx.toBool(right) }
    }
    return { type: 'bool', value: false }
  })

  register('logic_not', async (node, ctx) => {
    const operand = await ctx.evaluate(node.children.operand[0])
    return { type: 'bool', value: !ctx.toBool(operand) }
  })

  register('negate', async (node, ctx) => {
    const operand = await ctx.evaluate(node.children.value[0])
    const val = ctx.toNumber(operand)
    return operand.type === 'int'
      ? { type: 'int', value: -Math.trunc(val) }
      : { type: 'double', value: -val }
  })
}
