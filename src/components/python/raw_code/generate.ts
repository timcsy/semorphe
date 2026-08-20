/**
 * `python:raw_code` 的 **generate** 路——原文原樣產回去。
 *
 * ⚠️ **沒有分號**（與 C++ 那顆的差別）：`indent(ctx)` ＋ 原文 ＋ 換行就是全部。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:raw_code', (node, ctx) => {
    const code = String(node.properties.code ?? '')
    return `${indent(ctx)}${code}\n`
  })
}
