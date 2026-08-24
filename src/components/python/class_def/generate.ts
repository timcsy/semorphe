/** `python:class_def` 的 **generate** 路——縮排不是大括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText} from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:class_def', (node, ctx) => {
    const inner = indented(ctx)
    const methods = node.children.methods ?? []
    // ⚠️ **欄位排在方法之前**——Python 的慣例，而使用者的碼要一字不差地回去
    const fields = node.children.fields ?? []
    // ⚠️ 沒有父類別時**不能產出一對空括號**——`class C():` 與 `class C:`
    //    在 Python 是同一件事，而來回轉換要一字不差。
    const base = String(node.properties.base ?? '')
    // 🔴 **標頭那一行要先算進行號**（2026-08-24）——否則主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    //    見 `core/projection/code-generator.ts` 的 `trackOwnText`。
    const head = `${indent(ctx)}class ${node.properties.name ?? 'MyClass'}${base ? `(${base})` : ''}:\n`
    trackOwnText(ctx, head)
    const body = fields.length + methods.length > 0
      ? generateBody([...fields, ...methods], inner)
      : `${indent(inner)}pass\n`
    return head + body
  })
}
