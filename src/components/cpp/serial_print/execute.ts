/**
 * `cpp:serial_print` 的 **execute** 路——🔴 **接【現有的】主控台**。
 *
 * `ctx.io` 是 `cpp:print`（`cout`）與 `cpp:print_formatted`（`printf`）
 * 走的同一個出口。**不新開面板**——序列埠監控視窗與主控台在教學上是同一件事，
 * 而多開一個面板會讓學生要看兩個地方。
 *
 * ⚠️ 而三顆概念宣告了同一個 `ioRole: 'print'`：那是**一條等價邊**，
 * 不是「剛好都會輸出」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { valueToString } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:serial_print', async (node, ctx) => {
    const value = (node.slots.value ?? [])[0]
    const formatNode = (node.slots.format ?? [])[0]
    if (value) {
      const v = await ctx.evaluate(value)
      if (formatNode && v.type === 'double') {
        // 浮點的 `Serial.print(v, 3)` ＝ 固定三位小數（整數的第二個引數是進位，見下一支）。
        const digits = ctx.toNumber(await ctx.evaluate(formatNode))
        ctx.io.write(Number.isFinite(digits) ? Number(v.value).toFixed(Math.max(0, Math.trunc(digits))) : valueToString(v))
      } else if (formatNode && (v.type === 'int' || v.type === 'char' || v.type === 'bool')) {
        // 🔴 整數的第二個引數是**進位**（`HEX`／`BIN`…是 Print.h 的具名常數），不是小數位數
        //    ——修之前它被靜默丟掉，`Serial.print(255, HEX)` 印 `255`。
        ctx.io.write(printNumber(ctx.toNumber(v), ctx.toNumber(await ctx.evaluate(formatNode))))
      } else {
        ctx.io.write(valueToString(v))
      }
    }
    if (String(node.properties.newline ?? 'true') === 'true') ctx.io.writeNewline()
  })
}

/**
 * Arduino `Print::print(long n, int base)` 的印法：基數 < 2 當 10；十進位照正負號印，
 * 其他進位把值當 32 位元無號數（`unsigned long`）印、大寫。
 * ⚠️ 基數 0 在 Arduino 是「當成一個位元組寫出去」——當成字元印。
 */
function printNumber(n: number, base: number): string {
  const b = Math.trunc(base)
  if (b === 0) return String.fromCharCode(n & 0xff)
  if (b < 2 || b === 10) return String(Math.trunc(n))
  return (Math.trunc(n) >>> 0).toString(Math.min(b, 36)).toUpperCase()
}
