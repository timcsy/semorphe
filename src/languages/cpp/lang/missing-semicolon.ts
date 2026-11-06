/**
 * **「上一行的結尾可能少了 `;`」**——C++ 那側的缺口推論（2026-11-06；使用者同意窗口的提議：學生常看不出是少了分號）。
 *
 * tree-sitter 在「下一行是宣告／return／`}`」時補得出 MISSING「;」；下一行是 cout、cin、賦值、呼叫函式時
 * 它把兩行讀成一段 ERROR——於是學生看到「這一行的語法不完整」。
 *
 * ## 判準：量得到才說，而且說「可能」
 *
 * 對出錯那一段的每一行（由上往下）：這一行沒以 `;`／`{`／`}`／`,`／`:`／`(` 結尾、不是前處理指示、不是空行，
 * 就在**行尾補一個 `;`、整份重新剖析**——那一段的錯誤**全部消失**，才回報「這一行的結尾可能少了 `;`」。
 * 第一個成立的就是它（最上面的那一行最可能是學生忘了的那一行）。
 *
 * ⚠️ 量不到就什麼都不加（回空陣列）：認不得的輸入、打錯的關鍵字補了分號也不會好——`syntax-gap` 那幾支「不亂猜」照樣成立。
 * ⚠️ 只在 core 已經判定這一段有語法錯誤、而解析器又沒指名缺口的時候才會被問（見 `core/lift/syntax-inference.ts`）。
 */
import type { AstNode } from '../../../core/lift/types'
import type { SyntaxGap } from '../../../core/diagnostics'
import { parserFor } from './misparse'

const ENDS_OK = /[;{},:(]$/
const MAX_TRIES = 30

function rootOf(node: AstNode): AstNode {
  let n = node
  while (n.parent) n = n.parent
  return n
}

/** 這一段（列的範圍）裡還有沒有 ERROR／MISSING */
function brokenWithin(root: AstNode, first: number, last: number): boolean {
  let bad = false
  const walk = (n: AstNode): void => {
    if (bad || n.endPosition.row < first || n.startPosition.row > last) return
    if (n.type === 'ERROR' || n.isMissing === true) { bad = true; return }
    for (const c of n.children) walk(c)
  }
  walk(root)
  return bad
}

export function inferMissingSemicolon(node: AstNode): SyntaxGap[] {
  const parser = parserFor(node)
  if (!parser) return []
  const source = rootOf(node).text
  const lines = source.split('\n')
  const first = node.startPosition.row
  const last = Math.min(node.endPosition.row, lines.length - 1)
  let tries = 0
  for (let row = first; row <= last && tries < MAX_TRIES; row++) {
    const raw = lines[row] ?? ''
    const code = raw.replace(/\/\/.*$/, '').replace(/\s+$/, '')
    const trimmed = code.trim()
    if (trimmed === '' || trimmed.startsWith('#') || ENDS_OK.test(trimmed)) continue
    // 下一行（跳過空行）要存在——「換行之後接著另一句」才是這個形狀
    if (!lines.slice(row + 1).some((l) => l.trim() !== '')) continue
    tries++
    const patched = [...lines.slice(0, row), code + ';' + raw.slice(code.length), ...lines.slice(row + 1)].join('\n')
    const tree = parser.parse(patched)
    if (!tree) continue
    if (!brokenWithin(tree.rootNode as unknown as AstNode, first, last)) {
      return [{ missing: ';', line: row, column: code.length, likely: true }]
    }
  }
  return []
}
