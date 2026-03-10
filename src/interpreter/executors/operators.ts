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

  register('bitwise_not', async (node, ctx) => {
    const operand = await ctx.evaluate(node.children.operand[0])
    const val = ctx.toNumber(operand)
    return { type: 'int', value: ~Math.trunc(val) }
  })

  register('cpp_ternary', async (node, ctx) => {
    const condNodes = node.children.condition ?? []
    const trueNodes = node.children.true_expr ?? []
    const falseNodes = node.children.false_expr ?? []
    if (condNodes.length === 0) return { type: 'int', value: 0 }

    const condition = await ctx.evaluate(condNodes[0])
    if (ctx.toBool(condition)) {
      return trueNodes.length > 0 ? await ctx.evaluate(trueNodes[0]) : { type: 'int', value: 0 }
    } else {
      return falseNodes.length > 0 ? await ctx.evaluate(falseNodes[0]) : { type: 'int', value: 0 }
    }
  })

  register('cpp_cast', async (node, ctx) => {
    const targetType = String(node.properties.target_type ?? 'int')
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    const num = ctx.toNumber(val)
    if (targetType === 'int' || targetType === 'long' || targetType === 'short' || targetType === 'char') {
      return { type: 'int', value: Math.trunc(num) }
    }
    if (targetType === 'double' || targetType === 'float') {
      return { type: 'double', value: num }
    }
    return val
  })

  register('cpp_comma_expr', async (node, ctx) => {
    const exprs = node.children.exprs ?? []
    let last: import('../types').RuntimeValue = { type: 'int', value: 0 }
    for (const expr of exprs) {
      last = (await ctx.executeNode(expr)) as import('../types').RuntimeValue ?? last
    }
    return last
  })
}
