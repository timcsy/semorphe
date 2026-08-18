/** `cpp:servo_declare` 的 **generate** 路——⚠️ 建構參數個數是**動態**的（不同板子接法不同）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:servo_declare', (node, ctx) => {
    const name = String(node.properties.name ?? 'myServo')
    const args = (node.children.initializer ?? []).map((a) => generateExpression(a, ctx))
    // 🔴 沒有引數時**不得產出空的括號**——`Servo s();` 在 C++ 裡是一個
    //    函式宣告，不是一個物件（最令人困惑的解析）。
    if (args.length === 0) return `${indent(ctx)}Servo ${name};\n`
    return `${indent(ctx)}Servo ${name}(${args.join(', ')});\n`
  })
}
