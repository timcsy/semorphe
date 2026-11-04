/** `cpp:print` 的 **generate** 路——從共用檔原封剪過來（批次第三十九批）；printf 那一半照型別產（spec 215）。 */
import type { NodeGenerator, GeneratorContext } from '../../../core/projection/code-generator'
import type { SemanticNode, StylePreset } from '../../../core/types'
// ⚠️ 共用的是**演算法**（`<<` 的排版），不是身分。
import { needsParensInCout } from '../../../languages/cpp/std/iostream/generators'
import { indent, generateExpression } from '../../../core/projection/code-generator'
import { commentSyntax } from '../../../core/comment-syntax'
import { isStringLiteral, isLineBreak } from '../../../languages/cpp/lang/node-traits'
import {
  printfLine, streamFacts, everyIostreamConvertible, declareConvertible,
  KEEP_COUT_NOTE, KEEP_STATE_NOTE, KEEP_UNSYNC_NOTE, C_FALLBACK_NOTE,
} from '../../../languages/cpp/printf-types'
import { isCDialect } from '../../../languages/cpp/target-dialect'

const textOf = (v: SemanticNode): string | null => (isStringLiteral(v.componentId) ? String(v.properties.value ?? '') : null)
const isBreak = (v: SemanticNode): boolean => isLineBreak(v.componentId)

/** 這一行的 printf 寫法；`null` ＝ 推不出（保留 cout）。改過串流格式的程式只換純文字的那幾行。 */
export function printfPlan(node: SemanticNode, ctx: GeneratorContext): { fmt: string; args: string[] } | null {
  const values = node.slots.values ?? []
  if (streamFacts(ctx.root).stateChanged && values.some((v) => textOf(v) === null && !isBreak(v))) return null
  return printfLine(values, ctx, (v) => generateExpression(v, ctx), textOf, isBreak)
}

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  declareConvertible('cpp:print', (n, ctx) => printfPlan(n, ctx) !== null)
  g.set('cpp:print', (node, ctx) => {
    const values = node.slots.values ?? []
    const cout = (): string => {
      const parts = values.map((v) => {
        const expr = generateExpression(v, ctx)
        return needsParensInCout(v) ? `(${expr})` : expr
      })
      return `${indent(ctx)}cout << ${parts.join(' << ')};`
    }
    if (style.io_style === 'cout') return `${cout()}\n`

    // 🔴 printf 的格式要照型別（spec 215）——原本每一個運算式都寫 `%d`：字元印成數字、double 是未定義行為。
    //    推不出的那一行保留 cout、行尾註明（使用者 2026-11-04 定 A）；註明讀回來時核心會拿掉（generated-notes）。
    // ⚠️ 運算式位置（`cout << "x", n++;` 的逗號運算式裡）不加註明——註解會吃掉同一行後面的運算式（學生語料 21_d518 抓到）
    const keep = (note: string): string => (ctx.isExpression ? `${cout()}\n` : `${commentSyntax().trailing(cout(), note)}\n`)
    const facts = streamFacts(ctx.root)
    if (facts.unsynced && ctx.root && !everyIostreamConvertible(ctx.root, ctx)) return keep(KEEP_UNSYNC_NOTE)
    const plan = printfPlan(node, ctx)
    if (!plan && isCDialect(style)) {
      // C 目標：保留 cout 編不過——推不出的那一格暫用 %d，照實註明
      const c = printfLine(values, ctx, (v) => generateExpression(v, ctx), textOf, isBreak, '%d')!
      const call = `printf("${c.fmt}"${c.args.length > 0 ? `, ${c.args.join(', ')}` : ''})`
      return ctx.isExpression ? `${indent(ctx)}${call};\n` : `${commentSyntax().trailing(`${indent(ctx)}${call};`, C_FALLBACK_NOTE)}\n`
    }
    if (!plan) return keep(facts.stateChanged ? KEEP_STATE_NOTE : KEEP_COUT_NOTE)
    if (plan.args.length > 0) return `${indent(ctx)}printf("${plan.fmt}", ${plan.args.join(', ')});\n`
    return `${indent(ctx)}printf("${plan.fmt}");\n`
  })
}
