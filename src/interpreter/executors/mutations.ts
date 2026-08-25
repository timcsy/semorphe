import type { ComponentExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import { resolvePlace } from '../lvalue'

export const execIncrement: ComponentExecutor = async (node, ctx) => {
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

/**
 * 複合指定（`x += 1`／`a[i] *= 2`／`o.x -= 3`／`*q /= 2`／`s[i] -= 7`）。
 *
 * ## 🪦 這裡本來列舉左值的形狀
 *
 * 舊版讀 `properties.name`（一個字串）＋ 一個可有可無的 `index` 接點，
 * 於是它只認得**兩種**左值：一個名字、或「一個名字加一個下標」。
 * `o.x += 1`／`p->x += 1`／`*q += 1`／`a[i][j] += 1` 全部會去
 * `ctx.scope.get("o.x")` 查一個不存在的變數名。
 *
 * 🟢 2026-08-25：左值是 `target` 接點，解析走 `resolvePlace`
 * ——**加一種新的左值形狀不改這個檔**。見 `knowledge/concepts/左值.md`。
 *
 * ⚠️ 兩個特例留著，而它們現在表達在 `Place` 上：
 * - **字串那一格**（`s[i] -= 7`）——`cpp:array_at` 的解法會重建整個字串再寫回
 * - **字串的 `+=` 是串接不是相加**——見下面那一段（它踩過兩次）
 */
export const execCompoundAssign: ComponentExecutor = async (node, ctx) => {
  const op = String(node.properties.operator)
  const targetNode = (node.children.target ?? [])[0]
  if (!targetNode) {
    // 認得出來而拆不開＝上游給了一個沒有左邊的節點，**出聲不要猜**
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這一行沒有左邊' })
  }
  const place = await resolvePlace(targetNode, ctx)
  const current = place.read()
  const rhs = await ctx.evaluate(node.children.value[0])

  // `digits += input[i]` —— **字串的 `+=` 是串接，不是數值相加**。
  //
  // 🔴 走數值路徑的話 `toNumber("")` 是 0、右邊是碼位，於是
  // `"" += 'a'` 變成 **97**——而它看起來像一個合理的數字。
  // ⚠️ 這一筆在 `cpp:string_at` 改成回碼位（2026-08-13）之後**症狀變了但沒變好**：
  // 原本是 `Number('a')||0` 也錯，現在是「把碼位當數字加」。
  // **同一個缺陷的兩種面貌，而兩次都不會報錯。**
  if (current.type === 'string' && op === '+=') {
    // char 在這個直譯器裡是碼位（見 `cpp:literal_char`／`cpp:string_at`），
    // 串接時要還原成字元；string 直接接；其餘照它的字面。
    const piece =
      rhs.type === 'char'
        ? String.fromCharCode(ctx.toNumber(rhs))
        : typeof rhs.value === 'string'
          ? rhs.value
          : String(rhs.value)
    const appended = { type: 'string' as const, value: String(current.value) + piece }
    place.write(appended)
    return appended
  }

  const result = computeCompound(op, ctx.toNumber(current), ctx.toNumber(rhs))
  // ⚠️ **複合指定是一個運算式，它產出指定後的值。**
  //
  // `int b = (a += 3);` 的 b 應該是 5。在此之前這裡什麼都不回傳，於是
  // 運算式位置拿到 0——而**測試沒有碰過那個位置**，因為敘述位置不用回傳值。
  // 這個缺陷在合併 statement／expression 雙版本時才現形（兩個身分共用同一個
  // 執行器，所以兩邊一樣壞）。與 095 讓 `var_assign` 回傳指定值同一個形狀。
  //
  // ⚠️ **字元那一格保持 char**——`s[i] -= 7` 減完仍然是一個字元，
  //    轉成 int 的話寫回去會變成一個數字。
  const newValue = current.type === 'char'
    ? { type: 'char' as const, value: Math.trunc(result) }
    : current.type === 'int' && rhs.type === 'int'
      ? { type: 'int' as const, value: Math.trunc(result) }
      : { type: 'double' as const, value: result }
  place.write(newValue)
  return newValue
}

export function registerMutationExecutors(register: (component: string, executor: ComponentExecutor) => void): void {

  register('compound_assign', execCompoundAssign)
}
