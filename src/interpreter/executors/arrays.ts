import type { ConceptExecutor } from '../executor-registry'
import { defaultValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerArrayExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('array_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')

    const sizeChildren = node.children.size ?? []
    let size: number
    if (sizeChildren.length > 0) {
      const sizeVal = await ctx.evaluate(sizeChildren[0])
      size = ctx.toNumber(sizeVal)
    } else {
      const sizeRaw = node.properties.size
      size = Number(sizeRaw || 0)
      if (isNaN(size) && typeof sizeRaw === 'string') {
        try {
          const sizeVal = ctx.scope.get(sizeRaw)
          size = ctx.toNumber(sizeVal)
        } catch {
          size = 0
        }
      }
    }

    const elements: import('../types').RuntimeValue[] = []
    for (let i = 0; i < size; i++) {
      elements.push(defaultValue(type))
    }
    ctx.scope.declare(name, { type: 'array', value: elements })
  })

  register('array_access', async (node, ctx) => {
    const name = String(node.properties.name)
    const indexNodes = node.children.index
    if (!indexNodes || indexNodes.length === 0) return defaultValue('int')

    const indexVal = await ctx.evaluate(indexNodes[0])
    const index = ctx.toNumber(indexVal)
    const arr = ctx.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (index < 0 || index >= arr.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }
    return arr.value[index]
  })

  register('array_assign', async (node, ctx) => {
    const name = String(node.properties.name)
    const indexNodes = node.children.index
    const valueNodes = node.children.value
    if (!indexNodes || indexNodes.length === 0 || !valueNodes || valueNodes.length === 0) return

    const indexVal = await ctx.evaluate(indexNodes[0])
    const index = ctx.toNumber(indexVal)
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (index < 0 || index >= arr.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }
    arr.value[index] = val
  })
}
