/**
 * **printf／scanf 的格式字串解析** —— 與身分無關的演算法
 *
 * 原本住在 `core/runtime/printf.ts`，而那個檔的 `registerCstdioLifters`
 * 在兩顆元件搬進膠囊之後空了。
 */
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { buildPrintFormatted } from '../../../components/cpp/print_formatted/lift'
import { buildInputFormatted } from '../../../components/cpp/input_formatted/lift'
import { buildVarRef } from '../../../components/cpp/var_ref/lift'



export function extractPrintf(argsNode: AstNode | null, ctx: LiftContext) {
  if (!argsNode) return buildPrintFormatted('', [])
  const args = argsNode.namedChildren
  const formatStr = args[0]?.text?.replace(/^"|"$/g, '') ?? '%d\\n'
  const values = args.slice(1).map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
  return buildPrintFormatted(formatStr, values)
}

export function extractScanf(argsNode: AstNode | null, ctx: LiftContext) {
  if (!argsNode) return buildInputFormatted('%d', [buildVarRef('x')])
  const args = argsNode.namedChildren
  const formatStr = args[0]?.text?.replace(/^"|"$/g, '') ?? '%d'
  const values = args.slice(1).map(varArg => {
    if (varArg.type === 'unary_expression' || varArg.type === 'pointer_expression') {
      const inner = varArg.namedChildren[0]
      // 🔴 `&` 後面不是單純的名字（`&a[i]`、`&d[i].x`、`&p->x`）：照一般的運算式讀回。
      //    原本只認下標，其餘把原文當成一個名字——`&d1[i].x` 變成名字叫 `d1[i].x` 的變數，結構整個丟了，
      //    Cella 判「不是左值」（spec 215 量學生語料 I/O 切換時抓到；cin 那一側一直是對的）。
      if (inner && inner.type !== 'identifier') {
        const lifted = ctx.lift(inner)
        if (lifted) return lifted
      }
      const varName = inner?.text ?? 'x'
      return buildVarRef(varName)
    }
    const rawText = varArg.text
    const varName = rawText.startsWith('&') ? rawText.slice(1) : rawText
    return buildVarRef(varName)
  })
  return buildInputFormatted(formatStr, values)
}

