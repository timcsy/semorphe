import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerMutationExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  const execIncrement: ConceptExecutor = async (node, ctx) => {
    const name = String(node.properties.name)
    const op = String(node.properties.operator)
    const position = String(node.properties.position ?? 'postfix')

    // Array/string element increment
    const indexNodes = node.children.index ?? []
    if (indexNodes.length > 0) {
      const container = ctx.scope.get(name)
      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)

      // String subscript increment: s[i]++ (operates on char code)
      if (container.type === 'string' && typeof container.value === 'string') {
        if (index >= 0 && index < container.value.length) {
          const charCode = container.value.charCodeAt(index)
          const newCharCode = op === '++' ? charCode + 1 : charCode - 1
          const chars = container.value.split('')
          const oldChar = chars[index]
          chars[index] = String.fromCharCode(newCharCode)
          ctx.scope.set(name, { type: 'string', value: chars.join('') })
          const oldRv: RuntimeValue = { type: 'char', value: oldChar }
          const newRv: RuntimeValue = { type: 'char', value: chars[index] }
          return position === 'prefix' ? newRv : oldRv
        }
        return { type: 'char', value: '' }
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (index >= 0 && index < container.value.length) {
        const current = container.value[index]
        const val = ctx.toNumber(current)
        const newVal = op === '++' ? val + 1 : val - 1
        const newRv: RuntimeValue = current.type === 'int'
          ? { type: 'int', value: Math.trunc(newVal) }
          : { type: 'double', value: newVal }
        const oldRv: RuntimeValue = { ...current }
        container.value[index] = newRv
        return position === 'prefix' ? newRv : oldRv
      }
      return { type: 'int', value: 0 }
    }

    const current = ctx.scope.get(name)
    const val = ctx.toNumber(current)
    const newVal = op === '++' ? val + 1 : val - 1
    const newRv: RuntimeValue = current.type === 'int'
      ? { type: 'int', value: Math.trunc(newVal) }
      : { type: 'double', value: newVal }
    const oldRv: RuntimeValue = { type: current.type as any, value: val }
    ctx.scope.set(name, newRv)
    return position === 'prefix' ? newRv : oldRv
  }

  register('cpp_increment', execIncrement)
  register('cpp_increment_expr', execIncrement)

  const execCompoundAssign: ConceptExecutor = async (node, ctx) => {
    const name = String(node.properties.name)
    const op = String(node.properties.operator)
    const rhs = await ctx.evaluate(node.children.value[0])
    const rv = ctx.toNumber(rhs)

    // Array/string element compound assign
    const indexNodes = node.children.index ?? []
    if (indexNodes.length > 0) {
      const container = ctx.scope.get(name)
      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)

      // String subscript compound assign: s[i] -= 7 (operates on char code)
      if (container.type === 'string' && typeof container.value === 'string') {
        if (index >= 0 && index < container.value.length) {
          const charCode = container.value.charCodeAt(index)
          const result = computeCompound(op, charCode, rv)
          const chars = container.value.split('')
          chars[index] = String.fromCharCode(Math.trunc(result))
          ctx.scope.set(name, { type: 'string', value: chars.join('') })
        }
        return
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (index >= 0 && index < container.value.length) {
        const current = container.value[index]
        const result = computeCompound(op, ctx.toNumber(current), rv)
        container.value[index] = current.type === 'int' && rhs.type === 'int'
          ? { type: 'int', value: Math.trunc(result) }
          : { type: 'double', value: result }
      }
      return
    }

    const current = ctx.scope.get(name)
    const lv = ctx.toNumber(current)
    const result = computeCompound(op, lv, rv)
    if (current.type === 'int' && rhs.type === 'int') {
      ctx.scope.set(name, { type: 'int', value: Math.trunc(result) })
    } else {
      ctx.scope.set(name, { type: 'double', value: result })
    }
  }

  register('compound_assign', execCompoundAssign)
  register('cpp_compound_assign', execCompoundAssign)
  register('cpp_compound_assign_expr', execCompoundAssign)
}

function computeCompound(op: string, lv: number, rv: number): number {
  switch (op) {
    case '+=': return lv + rv
    case '-=': return lv - rv
    case '*=': return lv * rv
    case '/=':
      if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
      return lv / rv
    case '%=':
      if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
      return lv % rv
    case '&=': return lv & rv
    case '|=': return lv | rv
    case '^=': return lv ^ rv
    case '<<=': return lv << rv
    case '>>=': return lv >> rv
    default: return lv
  }
}
