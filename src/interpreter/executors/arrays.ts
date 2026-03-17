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
    const container = ctx.scope.get(name)

    // String subscript: s[i] returns char
    if (container.type === 'string' && typeof container.value === 'string') {
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      return { type: 'char', value: container.value[index] }
    }

    if (container.type !== 'array' || !Array.isArray(container.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (index < 0 || index >= container.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }
    return container.value[index]
  })

  register('array_assign', async (node, ctx) => {
    const name = String(node.properties.name)
    const indexNodes = node.children.index
    const valueNodes = node.children.value
    if (!indexNodes || indexNodes.length === 0 || !valueNodes || valueNodes.length === 0) return

    const indexVal = await ctx.evaluate(indexNodes[0])
    const index = ctx.toNumber(indexVal)
    const val = await ctx.evaluate(valueNodes[0])
    const container = ctx.scope.get(name)

    // String subscript assign: s[i] = 'x'
    if (container.type === 'string' && typeof container.value === 'string') {
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      const ch = typeof val.value === 'string' ? val.value[0] ?? '' : String.fromCharCode(ctx.toNumber(val))
      const chars = container.value.split('')
      chars[index] = ch
      ctx.scope.set(name, { type: 'string', value: chars.join('') })
      return
    }

    if (container.type !== 'array' || !Array.isArray(container.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (index < 0 || index >= container.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }
    container.value[index] = val
  })

  register('cpp_array_2d_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    const rows = Number(node.properties.rows || 0)
    const cols = Number(node.properties.cols || 0)

    const elements: import('../types').RuntimeValue[] = []
    for (let i = 0; i < rows; i++) {
      const row: import('../types').RuntimeValue[] = []
      for (let j = 0; j < cols; j++) {
        row.push(defaultValue(type))
      }
      elements.push({ type: 'array', value: row })
    }
    ctx.scope.declare(name, { type: 'array', value: elements })
  })

  register('cpp_array_2d_access', async (node, ctx) => {
    const name = String(node.properties.name)
    const rowNodes = node.children.row
    const colNodes = node.children.col
    if (!rowNodes?.length || !colNodes?.length) return defaultValue('int')

    const row = ctx.toNumber(await ctx.evaluate(rowNodes[0]))
    const col = ctx.toNumber(await ctx.evaluate(colNodes[0]))
    const arr = ctx.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    const rowArr = arr.value[row]
    if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
    }
    return rowArr.value[col] ?? defaultValue('int')
  })

  register('cpp_array_2d_assign', async (node, ctx) => {
    const name = String(node.properties.name)
    const rowNodes = node.children.row
    const colNodes = node.children.col
    const valueNodes = node.children.value
    if (!rowNodes?.length || !colNodes?.length || !valueNodes?.length) return

    const row = ctx.toNumber(await ctx.evaluate(rowNodes[0]))
    const col = ctx.toNumber(await ctx.evaluate(colNodes[0]))
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    const rowArr = arr.value[row]
    if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
    }
    rowArr.value[col] = val
  })

  // enum is a type declaration — no runtime effect
  register('cpp_enum', async () => {})
}
