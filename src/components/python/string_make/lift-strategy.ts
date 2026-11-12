/**
 * `python:string_make` 的 **lift** 路——一個具名策略。
 *
 * ## 為什麼不能是純資料
 *
 * tree-sitter-python 的 f-string 與普通字串**是同一個節點型別**（`string`）：
 *
 * ```
 * string  «f"hi {name} 分數 {s:.1f}"»          string  «"plain"»
 *   string_start  «f"»      ← 差別只在這裡        string_start  «"»
 *   string_content  «hi »                        string_content  «plain»
 *   interpolation [expression]  «{name}»         string_end  «"»
 *   string_content  « 分數 »
 *   interpolation [expression, format_specifier]  «{s:.1f}»
 *   string_end  «"»
 * ```
 *
 * 樣式比對表達不了「第一個子節點的文字以 f 開頭」，所以走策略。
 *
 * 🟢 **不是 f-string 就回 `null`**——比對迴圈會落到下一筆樣式，
 * 由同族那顆字面值元件接手。**這是刻意的分工，不是漏接。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
// 🔴 **呼叫兄弟膠囊匯出的建構子，不要自己寫下它們的身分**——
//    身分字串留在別人的資料夾裡，那顆改名時這裡不會有人發現。
import { buildLiteralString } from '../literal_string/build'
import { buildStringInsert } from '../string_insert/build'
import { bodyOf, parseStart } from '../literal_string/body'

/**
 * 前綴帶不帶 `f`。
 *
 * ⚠️ **不是只看第一個字元**：`rf"…"`／`fr"…"`／`F"…"`／`Rb"…"` 都合法，
 * 而只比 `startsWith('f')` 會把 `rf"{x}"` 判成普通字串——
 * 症狀是那一段插值被當成字面文字印出來（**看起來像使用者打錯字**）。
 */
const isFormatted = (prefix: string): boolean => /^[a-zA-Z]*$/.test(prefix.replace(/['"].*$/s, ''))
  && /f/i.test(prefix.replace(/['"].*$/s, ''))

/**
 * 自我說明（`{x=}`）那一段：`''`＝沒有；`null`＝有而收不下（整個 f-string 降級）。
 *
 * 🔴 **Python 印的是運算式的【原文】**（`{x+1=}` 印 `x+1=`），而我們產回去的是**重新產生**的文字。
 * 兩者一字不差才收，所以只收：
 * - 運算式是名字或屬性鏈（`x`、`self.n`）——產碼對它們不做任何正規化
 * - `{` 與運算式之間沒有空白（`{ x=}` 會把那個空白也印出來）
 * - `=` 兩側是 `=` 或 ` = `——積木上的下拉只有這兩種
 *
 * 第 410 刀（盲測抓到）起整段降級；第 418 刀起名字與屬性鏈收成插值那一格的 `selfDoc`。
 */
function selfDocOf(interp: AstNode, expr: AstNode | null): string | null {
  const eq = interp.children.find((c) => !c.isNamed && c.type === '=')
  if (!eq) return ''
  if (!expr || !/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/.test(expr.text)) return null
  // 用文字比，不用位移：插值的原文以 `{` 開頭、緊接運算式（中間有空白就收不下）
  if (!interp.text.startsWith('{' + expr.text)) return null
  const m = /^\s*=\s*/.exec(interp.text.slice(1 + expr.text.length))
  return m && (m[0] === '=' || m[0] === ' = ') ? m[0] : null
}

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftStringMake', (node, ctx) => {
    const start = node.namedChildren.find((c) => c.type === 'string_start')
    if (!start || !isFormatted(start.text)) return null // 普通字串 → 讓下一筆樣式接手

    const parts: SemanticNode[] = []
    for (const child of node.namedChildren) {
      if (child.type === 'string_content') {
        // 🔴 片段存成字面那顆的寫法（`{{` → `{`、raw 的反斜線加倍）——見 `literal_string/body.ts`
        parts.push(buildLiteralString(bodyOf(child, parseStart(start.text))))
        continue
      }
      if (child.type !== 'interpolation') continue // string_start／string_end 是引號，不是內容

      // 轉換（`!r`／`!s`／`!a`）在第 412 刀有了自己的一格——410 時它在這裡降級，
      // 再更早是被安靜丟掉（`f'{s!r:<6}'` 產回去是 `f"{s:<6}"`，印出來少了引號）。
      const convNode = child.namedChildren.find((c) => c.type === 'type_conversion')
      const conversion = convNode ? convNode.text.replace(/^!/, '') : ''
      if (conversion && !/^[rsa]$/.test(conversion)) return null // 文法收得下、Python 不收的字母——不猜
      const expr = child.childForFieldName('expression')
      const selfDoc = selfDocOf(child, expr)
      if (selfDoc === null) return null
      const fmt = child.childForFieldName('format_specifier')
      // ⚠️ `format_specifier` 的原文含前導冒號（`:.1f`），而冒號是**語法**不是格式。
      const format = fmt ? fmt.text.replace(/^:/, '') : ''
      const lifted = expr ? ctx.lift(expr) : null
      parts.push(buildStringInsert(format, lifted, conversion, selfDoc))
    }
    return createNode('python:string_make', {}, { parts })
  })
}
