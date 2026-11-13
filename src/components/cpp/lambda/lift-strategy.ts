/** `cpp:lambda` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { liftParamList, extractBody, normalizeParamType } from '../../../languages/cpp/lang/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // lambda_expression: [capture](params) -> ret { body }
    registry.register('cpp:liftLambda', (node, ctx) => {
      const captureSpec = node.namedChildren.find(c => c.type === 'lambda_capture_specifier')
      let capture = '&'
      if (captureSpec) {
        const inner = captureSpec.text.slice(1, -1) // strip [ ]
        capture = inner || ''
      }
      const declNode = node.namedChildren.find(c => c.type === 'abstract_function_declarator')
      // 🔴 **宣告子上的修飾詞（`mutable`／`constexpr`／`noexcept`…）整顆走誠實降級**（444，2026-11-13）：
      //    語義樹沒有放它們的地方，原本靜默拿掉——`[c]() mutable { c++; }` 產回去是 `[c]() { c++; }`，
      //    那是一個改了以值擷取的變數、編不過的程式。收下它要動三路（屬性、產生器、積木），在那之前照原文保留
      const declText = (declNode?.text ?? '').replace(/\([^]*\)/, '')
      if (/\b(mutable|constexpr|consteval|noexcept|throw)\b/.test(declText)) return null
      const paramList = declNode?.namedChildren.find(c => c.type === 'parameter_list') ?? null
      const params = liftParamList(paramList, ctx)
      const trailingReturn = declNode?.namedChildren.find(c => c.type === 'trailing_return_type')
      const returnType = trailingReturn ? trailingReturn.text.replace(/^->\s*/, '') : ''
      const bodyNode = node.namedChildren.find(c => c.type === 'compound_statement') ?? null
      // 🔴 參數要進作用域（同函式定義那一條）——2026-11-08 學生語料 w/APCS/o713 抓到：本體裡的 `r < M && c > -1`
      //    被 tree-sitter 剖成樣板，而 misparse 的修補 ②（「宣告過的變數不可能是樣板」）問作用域時不知道 `r` 是 lambda 的參數
      //    ⟹ 整段降級，程式翻不出。推進一層，免得參數名洩漏到外面
      ctx.data.pushScope()
      try {
        for (const p of params) {
          const pname = p.properties?.name
          const ptype = p.properties?.type
          if (typeof pname === 'string' && pname !== '' && typeof ptype === 'string') ctx.data.declare(pname, normalizeParamType(ptype))
        }
        const body = extractBody(bodyNode, ctx)
        return createNode('cpp:lambda', { capture, return_type: returnType }, { params, body })
      } finally {
        ctx.data.popScope()
      }
    })
}
