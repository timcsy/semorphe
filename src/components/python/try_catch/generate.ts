/** `python:try_catch` 的 **generate** 路——縮排不是大括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, generateNode } from '../../../core/projection/code-generator'
import { commentSyntax } from '../../../core/comment-syntax'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:try_catch', (node, ctx) => {
    const inner = indented(ctx)
    const block = (ns: typeof node.children.body): string =>
      (ns ?? []).length > 0 ? generateBody(ns!, inner) : `${indent(inner)}pass\n`
    // 每個分支自己產自己那一段（見同族的分支元件）
    const handlers = (node.children.handlers ?? []).map((h) => generateNode(h, ctx)).join('')
    // ⚠️ **空的那一段不寫**——產出一個 `finally:` ＋ `pass` 就是改了使用者的碼
    /** 這一段標頭那一行的註解——核心的「第一行」規則只放得了 `try:` 那一行。 */
    const note = (slot: string): string => {
      const hit = (node.annotations ?? []).filter((a) => a.slot === slot).map((a) => a.text)
      return hit.length > 0 ? commentSyntax().trailing('', hit.join('; ')).trimStart().replace(/^/, '  ') : ''
    }
    const tail = (kw: string, slot: string, ns: typeof node.children.body): string =>
      (ns ?? []).length > 0 ? `${indent(ctx)}${kw}:${note(slot)}\n${block(ns)}` : ''
    return `${indent(ctx)}try:\n${block(node.children.body)}${handlers}`
      + tail('else', 'orelse', node.children.orelse) + tail('finally', 'ensure', node.children.ensure)
  })
}
