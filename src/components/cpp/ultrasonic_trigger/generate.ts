/**
 * `cpp:ultrasonic_trigger` 的 **generate** 路——**一顆積木、五行程式碼**。
 *
 * ⚠️ 產出的每一行學生在網路教學上都看得到，一個字都沒有多。
 * 🟢 那是 Sc1「認知鷹架可退場」真的成立的樣子：他後期把這顆拆開，
 * 看到的就是他本來就會看到的那五行。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:ultrasonic_trigger', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    const i = indent(ctx)
    return (
      `${i}digitalWrite(${pin}, LOW);\n` +
      `${i}delayMicroseconds(2);\n` +
      `${i}digitalWrite(${pin}, HIGH);\n` +
      `${i}delayMicroseconds(10);\n` +
      `${i}digitalWrite(${pin}, LOW);\n`
    )
  })
}
