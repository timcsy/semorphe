import type { ConceptExecutor } from '../executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'

export function registerOperatorExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:arithmetic', async (node, ctx) => {
    const op = String(node.properties.operator)
    const left = await ctx.evaluate(node.children.left[0])

    // 左邊是物件時，問它的型別有沒有多載這個運算子。
    //
    // ⚠️ **重用上面那次求值，不要再求一次。** 第一版在函式開頭多求值了一次
    // 左運算元，於是每個算術節點的工作量翻倍——遞迴的 fibonacci 直接爆
    // 步數上限。單元測試全綠，抓到它的是**跑真實程式**的那批測試。
    if (left.type === 'object') {
      const m = ctx.structs.method(left.structName ?? '', `operator${op}`)
      if (m) {
        const r = await ctx.structs.invoke(left, m, [node.children.right[0]])
        if (r !== undefined) return r
      }
      // 落到下面的數值運算會把物件轉成 NaN，而那會印出一個數字，
      // 看起來像跑成功了。出聲。
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${left.structName ?? '物件'} 沒有多載 operator${op}`,
      })
    }

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

  register('cpp:compare', async (node, ctx) => {
    const op = String(node.properties.operator)
    const left = await ctx.evaluate(node.children.left[0])
    const right = await ctx.evaluate(node.children.right[0])

    // ⚠️ **字串要比內容。**
    //
    // 原本一律走 `toNumber`，而 `Number('abc') || 0` 是 0——**兩個字串都變成
    // 0，於是 `==` 恆真、`!=` 恆假**。`if (p == "abc")` 對任何字串都成立，
    // 而程式跑完、印出一個數字、那個數字是錯的。
    //
    // 字元（char）不走這裡：C++ 的 `'a' < 'b'` 比的是碼值，而現有行為已對。
    if (left.type === 'string' || right.type === 'string') {
      const ls = String(left.value)
      const rs = String(right.value)
      let r: boolean
      switch (op) {
        case '<': r = ls < rs; break
        case '>': r = ls > rs; break
        case '<=': r = ls <= rs; break
        case '>=': r = ls >= rs; break
        case '==': r = ls === rs; break
        case '!=': r = ls !== rs; break
        default: r = false
      }
      return { type: 'bool', value: r }
    }

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

  register('cpp:logic', async (node, ctx) => {
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




}
