import type { ConceptExecutor } from '../executor-registry'

export function registerCmathExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:math_pow', async (node, ctx) => {
    const base = await ctx.evaluate((node.children.base ?? [])[0])
    const exponent = await ctx.evaluate((node.children.exponent ?? [])[0])
    const result = Math.pow(ctx.toNumber(base), ctx.toNumber(exponent))
    return { type: 'double', value: result }
  })

  register('cpp:math_unary', async (node, ctx) => {
    const func = String(node.properties.func ?? 'abs')
    const value = await ctx.evaluate((node.children.value ?? [])[0])
    const v = ctx.toNumber(value)

    let result: number
    switch (func) {
      case 'abs': case 'fabs': result = Math.abs(v); break
      case 'sqrt': result = Math.sqrt(v); break
      case 'ceil': result = Math.ceil(v); break
      case 'floor': result = Math.floor(v); break
      case 'round': result = Math.round(v); break
      case 'log': result = Math.log(v); break
      case 'log2': result = Math.log2(v); break
      case 'log10': result = Math.log10(v); break
      case 'exp': result = Math.exp(v); break
      case 'sin': result = Math.sin(v); break
      case 'cos': result = Math.cos(v); break
      case 'tan': result = Math.tan(v); break
      case 'asin': result = Math.asin(v); break
      case 'acos': result = Math.acos(v); break
      case 'atan': result = Math.atan(v); break
      case 'trunc': result = Math.trunc(v); break
      case 'cbrt': result = Math.cbrt(v); break
      default: result = v
    }
    return { type: 'double', value: result }
  })

  register('cpp:math_binary', async (node, ctx) => {
    const func = String(node.properties.func ?? 'fmod')
    const arg1 = await ctx.evaluate((node.children.arg1 ?? [])[0])
    const arg2 = await ctx.evaluate((node.children.arg2 ?? [])[0])
    const v1 = ctx.toNumber(arg1)
    const v2 = ctx.toNumber(arg2)

    let result: number
    switch (func) {
      case 'fmod': result = v1 % v2; break
      case 'fmax': case 'max': result = Math.max(v1, v2); break
      case 'fmin': case 'min': result = Math.min(v1, v2); break
      case 'atan2': result = Math.atan2(v1, v2); break
      case 'hypot': result = Math.hypot(v1, v2); break
      default: result = 0
    }
    return { type: 'double', value: result }
  })
}
