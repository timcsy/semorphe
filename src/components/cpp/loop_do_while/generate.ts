/**
 * `cpp:loop_do_while` 的 **generate** 路
 *
 * ⚠️ **第六種形狀：產生器依 `style` 的閉包。**
 * 共用檔的 `openBrace` 是 `registerStatementGenerators` 內部捕獲 `style` 的閉包
 * （`brace_style === 'Allman'` 時大括號換行）。膠囊拿不到閉包，自己從 `style` 算。
 *
 * ⚠️ **少接這個參數不會紅**——排版差異多數測試不比。
 */
import type { StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = style.brace_style === 'Allman'
    ? (ctx: Parameters<NodeGenerator>[1]) => `\n${indent(ctx)}{`
    : () => ' {'
  g.set('cpp:loop_do_while', (node, ctx) => {
    const body = node.children.body ?? []
    const cond = generateExpression((node.children.cond ?? [])[0], ctx)
    const header = `${indent(ctx)}do${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    const tail = `${indent(ctx)}} while (${cond});`
    trackOwnText(ctx, tail)
    return code + tail
  })
}
