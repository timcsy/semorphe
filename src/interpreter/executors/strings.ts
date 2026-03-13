import type { ConceptExecutor } from '../executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerStringExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp_string_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'str')
    ctx.scope.declare(name, { type: 'string', value: '' })
  })

  register('cpp_string_length', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    return { type: 'int', value: str.length }
  })

  register('cpp_string_substr', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    const posNodes = node.children.pos ?? []
    const lenNodes = node.children.len ?? []
    const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
    const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : str.length - pos
    return { type: 'string', value: str.substring(pos, pos + len) }
  })

  register('cpp_string_find', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    const argNodes = node.children.arg ?? []
    if (argNodes.length === 0) return { type: 'int', value: -1 }
    const sub = String((await ctx.evaluate(argNodes[0])).value)
    const idx = str.indexOf(sub)
    return { type: 'int', value: idx === -1 ? 4294967295 : idx } // string::npos approximation
  })

  register('cpp_string_append', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const appendVal = await ctx.evaluate(valueNodes[0])
    ctx.scope.set(obj, { type: 'string', value: String(val.value) + String(appendVal.value) })
  })

  register('cpp_string_c_str', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    return { type: 'string', value: String(val.value) }
  })

  register('cpp_getline', async (node, ctx) => {
    const name = String(node.properties.name)
    const line = ctx.io.read()
    try {
      ctx.scope.set(name, { type: 'string', value: line ?? '' })
    } catch {
      ctx.scope.declare(name, { type: 'string', value: line ?? '' })
    }
  })

  register('cpp_to_string', async (node, ctx) => {
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'string', value: '' }
    const val = await ctx.evaluate(valueNodes[0])
    return { type: 'string', value: String(val.value) }
  })

  register('cpp_stoi', async (node, ctx) => {
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    const n = parseInt(String(val.value), 10)
    if (isNaN(n)) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'int' })
    return { type: 'int', value: n }
  })

  register('cpp_stod', async (node, ctx) => {
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'double', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    const n = parseFloat(String(val.value))
    if (isNaN(n)) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'double' })
    return { type: 'double', value: n }
  })

  register('cpp_string_empty', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    return { type: 'bool', value: String(val.value).length === 0 }
  })

  register('cpp_string_erase', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    const posNodes = node.children.pos ?? []
    const lenNodes = node.children.len ?? []
    const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
    const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : str.length - pos
    ctx.scope.set(obj, { type: 'string', value: str.substring(0, pos) + str.substring(pos + len) })
  })

  register('cpp_string_insert', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    const posNodes = node.children.pos ?? []
    const valueNodes = node.children.value ?? []
    const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
    const insertStr = valueNodes.length > 0 ? String((await ctx.evaluate(valueNodes[0])).value) : ''
    ctx.scope.set(obj, { type: 'string', value: str.substring(0, pos) + insertStr + str.substring(pos) })
  })

  register('cpp_string_replace', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    const posNodes = node.children.pos ?? []
    const lenNodes = node.children.len ?? []
    const valueNodes = node.children.value ?? []
    const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
    const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : 0
    const replaceStr = valueNodes.length > 0 ? String((await ctx.evaluate(valueNodes[0])).value) : ''
    ctx.scope.set(obj, { type: 'string', value: str.substring(0, pos) + replaceStr + str.substring(pos + len) })
  })

  register('cpp_string_push_back', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const charNodes = node.children.char ?? []
    if (charNodes.length === 0) return
    const ch = await ctx.evaluate(charNodes[0])
    ctx.scope.set(obj, { type: 'string', value: String(val.value) + String(ch.value) })
  })

  register('cpp_string_clear', async (node, ctx) => {
    const obj = String(node.properties.obj)
    ctx.scope.set(obj, { type: 'string', value: '' })
  })
}
