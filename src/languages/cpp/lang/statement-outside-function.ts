/**
 * **「這一行寫在函式外面」**——C++ 那側的確定推論（2026-11-07；固定等待換成等條件那一刀在 e2e 裡撞到）。
 *
 * 敘述（`cout << …;`、`x = 3;`、`if …`）只能寫在函式本體裡。寫在檔案範圍時，tree-sitter 的錯誤恢復會隨手補一個
 * 它覺得可能的 token——那一次補的是 `...`，於是學生看到「這裡少了一個 `...`」，完全看不出是放錯了地方。
 *
 * ## 判準：量得到才說
 *
 * 出錯的那一段在**檔案範圍**（往上找不到函式本體、類別本體），而把那幾行原樣包進一個函式本體重新剖析**沒有任何錯誤**
 * ——那它們就是一串放錯地方的敘述。這不是猜：包進去之後合法是可以量的事實，所以不標 likely。
 * 量不到（包進去還是錯、或根本不在檔案範圍）就什麼都不說，交回解析器指名的缺口與其他推論。
 */
import type { AstNode } from '../../../core/lift/types'
import type { SyntaxGap } from '../../../core/diagnostics'
import { parserFor } from './misparse'

/** 這一段的上層是函式本體或類別本體 ⟹ 不是「寫在函式外面」 */
const INSIDE = new Set(['function_definition', 'compound_statement', 'field_declaration_list', 'lambda_expression'])

function hasError(n: AstNode): boolean {
  if (n.type === 'ERROR' || n.isMissing === true) return true
  return n.children.some(hasError)
}

export function inferStatementOutsideFunction(node: AstNode): SyntaxGap[] {
  for (let p: AstNode | null = node.parent; p; p = p.parent) if (INSIDE.has(p.type)) return []
  const parser = parserFor(node)
  if (!parser) return []
  let root = node
  while (root.parent) root = root.parent
  const lines = root.text.split('\n')
  const first = node.startPosition.row
  const last = Math.min(node.endPosition.row, lines.length - 1)
  const segment = lines.slice(first, last + 1)
  if (segment.every((l) => l.trim() === '' || l.trim().startsWith('#'))) return []
  const probe = parser.parse(`void __semorphe_probe() {\n${segment.join('\n')}\n}\n`)
  if (!probe || hasError(probe.rootNode as unknown as AstNode)) return []
  // 只收「真的是敘述」的：整段都是宣告的話，它在檔案範圍本來就合法，錯在別處
  const body = (probe.rootNode as unknown as AstNode).children[0]?.childForFieldName('body')
  const stmts = body?.namedChildren ?? []
  if (!stmts.some((s) => s.type !== 'declaration' && s.type !== 'comment')) return []
  const at = segment.findIndex((l) => l.trim() !== '' && !l.trim().startsWith('//'))
  const row = first + Math.max(0, at)
  return [{ missing: '', line: row, column: (lines[row] ?? '').search(/\S/), outsideFunction: true }]
}
