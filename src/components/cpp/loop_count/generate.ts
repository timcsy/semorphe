/** `cpp:loop_count` 的 **generate** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:loop_count', (node, ctx) => {
      const varName = node.properties.var_name ?? 'i'
      const from = generateExpression((node.slots.from ?? [])[0], ctx)
      const to = generateExpression((node.slots.to ?? [])[0], ctx)
      const body = node.slots.body ?? []
      const inclusive = node.properties.inclusive === 'TRUE'
      const op = inclusive ? '<=' : '<'
      /**
       * 🔴 **原文可能是用一個巨集寫的**（2026-09-20）。
       *
       * ```cpp
       * #define rep(i,n) for(int i=0;i<n;i++)
       * rep(i,m) s += i;        ← 學生寫的
       * ```
       *
       * 兩種拼法是同一個迴圈，而**印回去要是他寫的那一種**。拼法存在
       * `metadata.layoutHints.macroHeader`（見 `core/types.ts` 那一格的檔頭：
       * 「投影記住它，積木看不到它」），由 `lang/macro-expand.ts` 的樹修復掛上。
       *
       * ⚠️ **積木那側改過之後這一格會不在**，那時印的是展開後的 `for (…)`
       * ——而那**不是退步，是安全性質**：迴圈的界線一旦被改過，
       * 再印 `rep(i,m)` 就是一句謊話。
       */
      const macroHeader = node.metadata?.layoutHints?.macroHeader
      const written = typeof macroHeader === 'string' && macroHeader.length > 0
        ? macroHeader
        : `for (int ${varName} = ${from}; ${varName} ${op} ${to}; ${varName}++)`
      const header = `${indent(ctx)}${written}${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
