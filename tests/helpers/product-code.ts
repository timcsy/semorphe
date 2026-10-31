/**
 * 用**產品的產碼路徑**產一段程式碼——語言產生器表（`languageGenerators`），不帶任何旁路。
 *
 * 🔴 2026-10-31（第 384 刀）：`roundtrip-l1`／`roundtrip-l2`／`p3-json-only`／`roundtrip-all`
 * 原本各自 `new TemplateGenerator()` 再餵 `codeTemplate`——**產品從不裝那一套**
 * （`setTemplateGenerator` 在 `src/` 零呼叫），於是它們驗的是一條使用者跑不到的路。
 * 那一套已刪除；這些測試改走這裡。
 *
 * 位置由**元件的 role** 決定（與產品一致）：`expression` 走運算式那一路（無分號、無縮排），
 * 其餘走敘述那一路。要強制某個位置就傳 `position`。
 */
import { generateCode, generateExpressionCode } from '../../src/core/projection/code-generator'
import { roleOf } from '../../src/core/component/traits'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { SemanticNode, StylePreset } from '../../src/core/types'

export const APCS_STYLE: StylePreset = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout', naming_convention: 'camelCase',
  indent_size: 4, brace_style: 'K&R',
  namespace_style: 'using', header_style: 'individual',
}

let installed = false

export function productCode(
  node: SemanticNode,
  opts: { style?: StylePreset; position?: 'statement' | 'expression' } = {},
): string {
  if (!installed) { registerCppLanguage(); installed = true }
  const style = opts.style ?? APCS_STYLE
  const position = opts.position ?? (roleOf(node.componentId) === 'expression' ? 'expression' : 'statement')
  return position === 'expression'
    ? generateExpressionCode(node, 'cpp', style)
    : generateCode(node, 'cpp', style)
}
