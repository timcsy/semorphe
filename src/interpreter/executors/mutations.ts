import type { ComponentExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import { resolvePlace } from '../lvalue'

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
 * 遞增／遞減（`i++`／`a[i]--`／`o.x++`／`(*q)++`／`s[i]++`）。
 *
 * ## 🪦 這裡本來列舉運算元的形狀
 *
 * 舊版讀 `properties.name`（一個字串）＋ 一個可有可無的 `index` 接點，
 * 於是它只認得**兩種**：一個名字、或「一個名字加一個下標」。
 *
 * 🟢 2026-08-25：運算元是 `target` 接點，解析走 `resolvePlace`
 * ——**加一種新的左值形狀不改這個檔**。見 `knowledge/concepts/左值.md`。
 *
 * ⚠️ **前綴與後綴回傳的東西不同**：`++i` 給新值，`i++` 給舊值。
 * 🔴 而**字元那一格要保持 char**（`s[i]++` 加完仍然是一個字元）——
 * `cpp:string_at` 的解法讀寫都用碼位，所以這裡只要不改型別就對了。
 */
export const execIncrement: ComponentExecutor = async (node, ctx) => {
  const op = String(node.properties.operator)
  const position = String(node.properties.position ?? 'postfix')
  const targetNode = (node.children.target ?? [])[0]
  if (!targetNode) {
    // 認得出來而拆不開＝上游給了一個沒有運算元的節點，**出聲不要猜**
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個遞增沒有運算元' })
  }
  const place = await resolvePlace(targetNode, ctx)
  const current = place.read()
  const delta = op === '++' ? 1 : -1
  const n = ctx.toNumber(current) + delta
  const next: RuntimeValue = current.type === 'char'
    ? { type: 'char', value: Math.trunc(n) }
    : current.type === 'int'
      ? { type: 'int', value: Math.trunc(n) }
      : { type: 'double', value: n }
  place.write(next)
  return position === 'prefix' ? next : current
}

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
