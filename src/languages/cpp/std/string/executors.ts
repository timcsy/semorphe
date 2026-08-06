/**
 * `<string>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/strings.ts`，讓核心層認識了 17 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_string_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'str')
    // ⚠️ **初始值原本被完全忽略**——`string s = "abc";` 之後 `s` 是 `""`。
    //
    // 於是 `s.length()` 回 0、`s.substr(0,3)` 回空字串、`cout << s` 印不出
    // 東西——而**沒有任何錯誤訊息**。每一個用到字串初始值的程式都安靜地錯，
    // 而那些測試被停用時標成 `[UNVERIFIED]`（連理由都不知道）。
    //
    // 辨識器把初始值放在 `initializer`（與 `var_declare` 同名）。
    const init = node.children.initializer ?? node.children.value ?? []
    if (init.length > 0) {
      const v = await ctx.evaluate(init[0])
      ctx.scope.declare(name, { type: 'string', value: String(v.value) })
      return
    }
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
    // ⚠️ 辨識器把引數放在 `value`（見 `METHOD_CHILD_SLOT`），而這裡原本只讀
    // `char`——**於是 push_back 完全沒有作用，而且不出聲**。
    //
    // 076 把 `s.push_back(c)` 從通用容器版導到字串專屬版時，沒有人檢查子槽名
    // 對不對。第十條護欄（宣告的子節點名沒有人讀）抓不到這種——它查「有沒有
    // 人讀」，不查「**讀對不對**」。那條邊界寫在它的「不檢測什麼」裡。
    const charNodes = node.children.value ?? node.children.char ?? []
    if (charNodes.length === 0) return
    const ch = await ctx.evaluate(charNodes[0])
    // 字元字面可能求值成**數字碼**（`'x'` → 120）。直接串接會把 "ab" 變成
    // "ab120"——與 082 在陣列初始化列表遇到的是同一個病。
    const chStr =
      typeof ch.value === 'number' ? String.fromCharCode(ch.value) : String(ch.value)
    ctx.scope.set(obj, { type: 'string', value: String(val.value) + chStr })
  })

  register('cpp_string_clear', async (node, ctx) => {
    const obj = String(node.properties.obj)
    ctx.scope.set(obj, { type: 'string', value: '' })
  })

  register('cpp_string_at', async (node, ctx) => {
    const obj = String(node.properties.obj)
    const val = ctx.scope.get(obj)
    const str = String(val.value)
    const indexNodes = node.children.index ?? []
    const idx = indexNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(indexNodes[0])) : 0
    if (idx < 0 || idx >= str.length) throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE)
    return { type: 'string', value: str[idx] }
  })

  // cstring (C-style string functions)
}
