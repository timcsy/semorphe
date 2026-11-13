/**
 * **這個接收者是不是 Arduino 的 `String`**——435 那幾顆 String 方法（trim／indexOf／substring／toInt）的 lift 共用的判別。
 *
 * 🔴 **判的是型別，不是方法名**：`trim`、`indexOf` 這些名字使用者自己的類別也可能有，
 * 一張只看方法名的表會把它們搶成 Arduino 的 String 方法。
 *
 * 認得的只有兩種，其餘一律「不是」（留在通用的方法呼叫——猜一個錯的專屬身分比誠實降級更糟，`servo_attach/lift.ts` 同一條）：
 *
 * ```
 * String s = …;  s.trim()                    宣告型別記成 String（lifter.ts 的 recordDeclaration）
 * line.substring(a).toInt()                  接收者本身 lift 成一顆宣告了 returnsArduinoString 的元件
 * Serial.readStringUntil('\n').trim()        同上
 * ```
 *
 * ⚠️ 問的是**性狀**（`traits.returnsArduinoString`）不是身分字串——那幾顆改名時這裡不會安靜地失效。
 */
import type { AstNode, LiftContext } from '../../core/lift/types'
import type { SemanticNode } from '../../core/types'
import { componentTraits } from '../../core/component/traits'

/** 接收者是 Arduino String 的話回傳它 lift 出來的樹（接進 `obj` 槽），否則回 null。 */
export function liftArduinoStringReceiver(obj: string, objNode: AstNode | null | undefined, ctx: LiftContext): SemanticNode | null {
  if (!objNode) return null
  if (/^[A-Za-z_]\w*$/.test(obj)) {
    return ctx.data.getType(obj) === 'String' ? ctx.lift(objNode) : null
  }
  if (objNode.type !== 'call_expression') return null
  const n = ctx.lift(objNode)
  return n && componentTraits(n.componentId)?.returnsArduinoString === true ? n : null
}
