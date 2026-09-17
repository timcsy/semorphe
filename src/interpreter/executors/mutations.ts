import type { ComponentExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import { isCellPointer, movePointer } from '../pointer'
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
  const targetNode = (node.slots.target ?? [])[0]
  if (!targetNode) {
    // 認得出來而拆不開＝上游給了一個沒有運算元的節點，**出聲不要猜**
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個遞增沒有運算元' })
  }
  const place = await resolvePlace(targetNode, ctx)
  const current = place.read()
  const delta = op === '++' ? 1 : -1
  /**
   * 🔴 **`++p` 在一個【位置】上是「往後一格」，不是「值加一」**（2026-09-17）。
   *
   * 走下面那條數值路徑的話：`toNumber(一串格子)` 回 **1**（那是刻意的，
   * 見 `interpreter.ts`——少了它 `while (p != NULL)` 對剛配好的節點是假），
   * 於是 `++p` 寫回一個 `double 2`，**指標當場被毀掉**。
   *
   * ⚠️ 而它**不在這一行報錯**：症狀出現在下一次解參考
   * （`*p` → `TYPE_MISMATCH: pointer`），於是看起來像是解參考壞了。
   *
   * > **一個把值換成別的型別的寫入，它的錯誤訊息會指向下一個讀它的人。**
   *
   * 🟢 `p = p + 1` 早就對了（`cpp:arithmetic` 有完整的指標算術）
   * ——缺的一直只是**原地改**那幾個形式。
   */
  if (isCellPointer(current)) {
    const moved = movePointer(current, delta)
    place.write(moved)
    // ⚠️ 後置回傳**舊的位置**、前置回傳新的。那個差別在 `it = s.erase(it++)`
    //    這種「邊走邊刪」的寫法裡是關鍵，不是修辭。
    return position === 'prefix' ? moved : current
  }
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
  const targetNode = (node.slots.target ?? [])[0]
  if (!targetNode) {
    // 認得出來而拆不開＝上游給了一個沒有左邊的節點，**出聲不要猜**
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這一行沒有左邊' })
  }
  const place = await resolvePlace(targetNode, ctx)
  const current = place.read()
  const rhs = await ctx.evaluate(node.slots.value[0])

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

  /**
   * 🔴 **`p += n` 在一個【位置】上是「往後 n 格」**——與 `++p` 同一個理由
   *    （見 `execIncrement` 裡那段）。少了這一條，`it += 2` 把迭代器
   *    變成一個數字，而錯誤訊息會出現在下一次解參考那裡。
   * ⚠️ 只接 `+=`／`-=`：`p *= 2` 在 C++ 裡本來就不合法，**不要替它發明一個答案**。
   */
  if (isCellPointer(current) && (op === '+=' || op === '-=')) {
    const step = ctx.toNumber(rhs)
    const moved = movePointer(current, op === '+=' ? step : -step)
    place.write(moved)
    return moved
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
