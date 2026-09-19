import type { ComponentExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import { isCellPointer, movePointer } from '../pointer'
import { resolvePlace } from '../lvalue'
import { keepDeclaredType } from '../assign-type'
import { big, narrow, needsBig } from '../int64'

/**
 * 🔴 **64 位元那一段**（2026-09-19）——與 `cpp:arithmetic` 是同一個不變式。
 *
 * `for(ll jp=1e12; jp>0; jp>>=1)` 的 `jp>>=1` 走的是**這裡**，不是那顆元件，
 * 於是那一刀修了 `a >> b` 而 `a >>= b` 照樣被截成 32 位元。
 *
 * > **同一個運算有二元形式與複合形式時，修一個不會修到另一個
 * > ——而它們錯的是同一件事。**（這個檔自己在字串 `+=` 上記過一模一樣的話。）
 *
 * ⚠️ 判準與那邊一致：**位元運算一律 bigint，算術只在失真時升上去**。
 * ⚠️ 型別由呼叫端判（只有整數型別才進來）——`double` 不得被升上去。
 */
function compoundBig(op: string, a: bigint, b: bigint): bigint {
  switch (op) {
    case '+=': return a + b
    case '-=': return a - b
    case '*=': return a * b
    case '/=':
      if (b === 0n) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
      return a / b
    case '%=':
      if (b === 0n) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
      return a % b
    case '&=': return a & b
    case '|=': return a | b
    case '^=': return a ^ b
    case '<<=': return a << b
    case '>>=': return a >> b
    default: return a
  }
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

  /**
   * 🔴 **位元運算與大數走 bigint**——見 `compoundBig` 的檔頭。
   * ⚠️ 只在**兩邊都是整數型別**時：`double` 的 `*=` 不得被升上去。
   */
  const INT_TYPES = new Set(['int', 'char', 'bool'])
  const bothInt = INT_TYPES.has(current.type) && INT_TYPES.has(rhs.type)
  const BITWISE_ASSIGN = new Set(['&=', '|=', '^=', '<<=', '>>='])
  if (bothInt && (BITWISE_ASSIGN.has(op)
      || needsBig(typeof current.value === 'bigint' ? current.value : ctx.toNumber(current))
      || needsBig(typeof rhs.value === 'bigint' ? rhs.value : ctx.toNumber(rhs)))) {
    const a = big(typeof current.value === 'bigint' ? current.value : ctx.toNumber(current))
    const b = big(typeof rhs.value === 'bigint' ? rhs.value : ctx.toNumber(rhs))
    const out = { type: 'int' as const, value: narrow(compoundBig(op, a, b)) }
    const kept = keepDeclaredType(current, out, ctx)
    place.write(kept)
    return kept
  }

  const result = computeCompound(op, ctx.toNumber(current), ctx.toNumber(rhs))
  // ⚠️ **複合指定是一個運算式，它產出指定後的值。**
  //
  // `int b = (a += 3);` 的 b 應該是 5。在此之前這裡什麼都不回傳，於是
  // 運算式位置拿到 0——而**測試沒有碰過那個位置**，因為敘述位置不用回傳值。
  // 這個缺陷在合併 statement／expression 雙版本時才現形（兩個身分共用同一個
  // 執行器，所以兩邊一樣壞）。與 095 讓 `var_assign` 回傳指定值同一個形狀。
  //
  /**
   * 🔴 **那一格的型別由【它自己】決定，不由右邊決定**（2026-09-18 收斂）。
   *
   * 這裡本來是一條三層的三元式（char 保持 char、int＋int 才是 int、其餘 double）
   * ——而 `int x; x += 0.5;` 會走到最後那一支變成 **double**，
   * 那是右邊在決定左邊的型別。
   * ⚠️ `s[i] -= 7` 仍然是一個字元（那一條原本就對，現在由同一份規則涵蓋）。
   *
   * > **一個「看右邊是什麼」的型別規則，在左邊已經宣告過的語言裡是反的。**
   */
  const newValue = keepDeclaredType(current, { type: 'double' as const, value: result }, ctx)
  place.write(newValue)
  return newValue
}

export function registerMutationExecutors(register: (component: string, executor: ComponentExecutor) => void): void {

  register('compound_assign', execCompoundAssign)
}
