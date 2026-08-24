/** `python:try_catch` 的 **generate** 路——縮排不是大括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, generateNode, trackOwnText} from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:try_catch', (node, ctx) => {
    const inner = indented(ctx)
    const block = (ns: typeof node.children.body): string =>
      (ns ?? []).length > 0 ? generateBody(ns!, inner) : `${indent(inner)}pass\n`
    // 每個分支自己產自己那一段（見同族的分支元件）
    const handlers = (node.children.handlers ?? []).map((h) => generateNode(h, ctx)).join('')
    // ⚠️ **空的那一段不寫**——產出一個 `finally:` ＋ `pass` 就是改了使用者的碼
    // 🔴 **每一段標頭都要先算進行號**（2026-08-24）——否則那一段主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    const tail = (kw: string, ns: typeof node.children.body): string => {
      if ((ns ?? []).length === 0) return ''
      const head = `${indent(ctx)}${kw}:\n`
      trackOwnText(ctx, head)
      return head + block(ns)
    }
    const tryHead = `${indent(ctx)}try:\n`
    trackOwnText(ctx, tryHead)
    return tryHead + block(node.children.body) + handlers
      + tail('else', node.children.orelse) + tail('finally', node.children.ensure)
  })
}
