import type { ConceptExecutor } from '../executor-registry'
import { defaultValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerArrayExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('lang:array_declare', async (node, ctx) => {
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

    // 初始值：`int a[3] = {3,1,2}`
    //
    // 辨識那半在 specs/050 就修好了（初始值進 `children.values`），**執行這半
    // 沒有接上**——於是 `int a[3]={3,1,2}; cout << a[0]` 輸出 0。
    // 半條路修好比沒修更難察覺：語義樹裡看得到值，跑起來卻是零。
    const init = node.children.values ?? []
    // `char s[4] = "ab"` —— 初始值是一個字串字面，要**拆成字元**再填。
    // 不拆的話整個字串會塞進 s[0]，於是 s[1] 是空的、cout << s 也不對。
    if (type.includes('char') && init.length === 1) {
      const v = await ctx.evaluate(init[0])
      if (typeof v.value === 'string' && v.value.length > 1) {
        for (let i = 0; i < v.value.length && i < elements.length; i++) {
          elements[i] = { type: 'char', value: v.value[i] }
        }
        if (v.value.length < elements.length) {
          elements[v.value.length] = { type: 'char', value: '\0' }
        }
        ctx.scope.declare(name, { type: 'array', value: elements })
        return
      }
    }
    for (let i = 0; i < init.length && i < elements.length; i++) {
      // **轉成陣列的元素型別**——C++ 會轉，而不轉的話 `char s[4]={'a','1'}`
      // 的元素會留著字元字面求值出來的數字碼，於是 `cout << s[0]` 印出 97
      // 而不是 `a`，`isdigit(s[0])` 也會因為看到 `'9'` 而回傳真。
      //
      // **程式跑完、印出東西、而它是錯的**——這正是「靜默降級」的形狀。
      elements[i] = ctx.coerceType(await ctx.evaluate(init[i]), type)
    }
    // 宣告時沒寫大小（`int a[] = {1,2,3}`）→ 長度由初始值決定
    if (size === 0 && init.length > 0) {
      for (const n of init) elements.push(await ctx.evaluate(n))
    }

    ctx.scope.declare(name, { type: 'array', value: elements })
  })

  register('lang:array_access', async (node, ctx) => {
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

  register('lang:array_assign', async (node, ctx) => {
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
}
