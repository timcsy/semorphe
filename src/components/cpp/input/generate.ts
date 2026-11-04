/** `cpp:input` 的 **generate** 路——從共用檔原封剪過來（批次第三十九批）；scanf 那一半照型別產（spec 215）。 */
import type { NodeGenerator, GeneratorContext } from '../../../core/projection/code-generator'
import type { SemanticNode, StylePreset } from '../../../core/types'
import { indent, generateExpression } from '../../../core/projection/code-generator'
import { commentSyntax } from '../../../core/comment-syntax'
import { scanfOf, streamFacts, everyIostreamConvertible, declareConvertible, KEEP_CIN_NOTE, KEEP_UNSYNC_NOTE, C_FALLBACK_NOTE } from '../../../languages/cpp/printf-types'
import { isCDialect } from '../../../languages/cpp/target-dialect'

/** 每一個讀取目標的 scanf 轉換；`null` ＝ 有一個推不出（保留 cin）。字串串流（`in >> a`）不是標準輸入，不換。 */
function scanfPlan(node: SemanticNode, ctx: GeneratorContext): string[] | null {
  if (node.properties.from !== undefined) return null
  const vals = node.slots.values ?? []
  if (vals.length === 0) return null
  const convs = vals.map((v) => scanfOf(ctx.expressionTypes?.[v.id]))
  return convs.every((c): c is string => c !== null) ? convs : null
}

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  declareConvertible('cpp:input', (n, ctx) => scanfPlan(n, ctx) !== null)
  g.set('cpp:input', (node, ctx) => {
    const valueNodes = node.slots.values ?? []
    const vars = valueNodes.length > 0
      ? valueNodes.map(v => generateExpression(v, ctx))
      : [String(node.properties.variable ?? 'x')]
    // 來源可能是一個**字串串流變數**（`in >> a`），不一定是標準輸入。
    // 一律產成 `cin` 的話，`istringstream` 的程式來回轉換之後會讀錯地方。
    const cin = (): string => `${node.properties.from !== undefined ? String(node.properties.from) : 'cin'} >> ${vars.join(' >> ')}`
    if (style.io_style === 'cout') {
      if (ctx.isExpression) return cin()
      return `${indent(ctx)}${cin()};\n`
    }
    // 🔴 scanf 的格式要照型別（spec 215）——原本一律 `%d`：double 讀進來是未定義行為。
    //    推不出的保留 cin、行尾註明（使用者 2026-11-04 定 A）。
    const facts = streamFacts(ctx.root)
    const unsyncBlocked = facts.unsynced && ctx.root !== undefined && !everyIostreamConvertible(ctx.root, ctx)
    let plan = unsyncBlocked ? null : scanfPlan(node, ctx)
    let cNote: string | null = null
    if (!plan && isCDialect(style) && node.properties.from === undefined) {
      // C 目標：保留 cin 編不過——推不出的那一格暫用 %d，照實註明
      plan = valueNodes.map((v) => scanfOf(ctx.expressionTypes?.[v.id]) ?? '%d')
      cNote = C_FALLBACK_NOTE
    }
    if (!plan) {
      if (ctx.isExpression) return cin()
      return `${commentSyntax().trailing(`${indent(ctx)}${cin()};`, unsyncBlocked ? KEEP_UNSYNC_NOTE : KEEP_CIN_NOTE)}\n`
    }
    const call = `scanf("${plan.join('')}", ${vars.map((v) => `&${v}`).join(', ')})`
    // ⚠️ 運算式位置（`while (cin >> x)`）：scanf 回的是讀到幾個，檔尾是 EOF（-1，**真**）——要比對個數，不然是無窮迴圈
    if (ctx.isExpression) return `${call} == ${plan.length}`
    return cNote ? `${commentSyntax().trailing(`${indent(ctx)}${call};`, cNote)}\n` : `${indent(ctx)}${call};\n`
  })
}
