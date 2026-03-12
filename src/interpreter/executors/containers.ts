import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { defaultValue, valueToString } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

function mapFind(pairs: RuntimeValue[], keyVal: RuntimeValue): number {
  const keyStr = valueToString(keyVal)
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 1) {
      if (valueToString(pair.value[0]) === keyStr) return i
    }
  }
  return -1
}

export function registerContainerExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  // ─── Vector ───

  register('cpp_vector_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_vector_push_back', async (node, ctx) => {
    const name = String(node.properties.vector)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.push(val)
  })

  register('cpp_vector_size', async (node, ctx) => {
    const name = String(node.properties.vector)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'int', value: 0 }
    }
    return { type: 'int', value: arr.value.length }
  })

  register('cpp_vector_pop_back', async (node, ctx) => {
    const name = String(node.properties.vector)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (arr.value.length > 0) {
      arr.value.pop()
    }
  })

  register('cpp_vector_clear', async (node, ctx) => {
    const name = String(node.properties.vector)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.length = 0
  })

  register('cpp_vector_empty', async (node, ctx) => {
    const name = String(node.properties.vector)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'bool', value: true }
    }
    return { type: 'bool', value: arr.value.length === 0 }
  })

  register('cpp_vector_back', async (node, ctx) => {
    const name = String(node.properties.vector)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[arr.value.length - 1]
  })

  // ─── Stack (simulated with array: push=push, pop=pop, top=last) ───

  register('cpp_stack_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_stack_push', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.push(val)
  })

  register('cpp_stack_pop', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (arr.value.length > 0) {
      arr.value.pop()
    }
  })

  register('cpp_stack_top', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[arr.value.length - 1]
  })

  register('cpp_stack_empty', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'bool', value: true }
    }
    return { type: 'bool', value: arr.value.length === 0 }
  })

  // ─── Queue (simulated with array: push=push, pop=shift, front=first) ───

  register('cpp_queue_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_queue_push', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    arr.value.push(val)
  })

  register('cpp_queue_pop', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    if (arr.value.length > 0) {
      arr.value.shift()
    }
  })

  register('cpp_queue_front', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[0]
  })

  register('cpp_queue_empty', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'bool', value: true }
    }
    return { type: 'bool', value: arr.value.length === 0 }
  })

  // ─── Map (simulated with array of [key, value] pairs) ───
  // Stored as { type: 'array', value: [ {type:'array', value:[keyRV, valRV]}, ... ] }

  register('cpp_map_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_map_access', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return defaultValue('int')
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      return defaultValue('int')
    }
    const idx = mapFind(map.value, keyVal)
    if (idx === -1) {
      // C++ map auto-inserts default on access
      const newVal = defaultValue('int')
      const pair: RuntimeValue = { type: 'array', value: [keyVal, newVal] }
      map.value.push(pair)
      return newVal
    }
    const pair = map.value[idx]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 2) {
      return pair.value[1]
    }
    return defaultValue('int')
  })

  register('cpp_map_erase', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) return
    const idx = mapFind(map.value, keyVal)
    if (idx !== -1) {
      map.value.splice(idx, 1)
    }
  })

  register('cpp_map_count', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return { type: 'int' as const, value: 0 }
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      return { type: 'int' as const, value: 0 }
    }
    const idx = mapFind(map.value, keyVal)
    return { type: 'int' as const, value: idx !== -1 ? 1 : 0 }
  })

  register('cpp_map_empty', async (node, ctx) => {
    const name = String(node.properties.obj)
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      return { type: 'bool', value: true }
    }
    return { type: 'bool', value: map.value.length === 0 }
  })

  // ─── Set (simulated with array + uniqueness) ───

  register('cpp_set_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

  register('cpp_set_insert', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    // Uniqueness check: compare by value
    const exists = arr.value.some((v: RuntimeValue) => v.value === val.value)
    if (!exists) {
      arr.value.push(val)
      // Keep sorted (by value)
      arr.value.sort((a: RuntimeValue, b: RuntimeValue) => {
        if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value
        return String(a.value).localeCompare(String(b.value))
      })
    }
  })

  register('cpp_set_erase', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    const idx = arr.value.findIndex((v: RuntimeValue) => v.value === val.value)
    if (idx !== -1) {
      arr.value.splice(idx, 1)
    }
  })

  register('cpp_set_count', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int' as const, value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'int' as const, value: 0 }
    }
    const exists = arr.value.some((v: RuntimeValue) => v.value === val.value)
    return { type: 'int' as const, value: exists ? 1 : 0 }
  })

  register('cpp_set_empty', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      return { type: 'bool', value: true }
    }
    return { type: 'bool', value: arr.value.length === 0 }
  })
}
