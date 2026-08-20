/**
 * `python:comment` 的 **generate** 路——**問登記處，不寫死 `#`**。
 *
 * `commentSyntax()` 是語言中立的登記處（spec 168 起**依語言存**），
 * 而「Python 用 `#`」那句話住在 `languages/python/comment-syntax.ts`。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'
import { commentSyntax } from '../../../core/comment-syntax'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:comment', (node, ctx) =>
    commentSyntax().line(String(node.properties.text ?? ''), indent(ctx)))
}
