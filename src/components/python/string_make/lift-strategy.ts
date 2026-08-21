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
import { createNode } from '../../../core/semantic-tree'
// 🔴 **呼叫兄弟膠囊匯出的建構子，不要自己寫下它們的身分**——
//    身分字串留在別人的資料夾裡，那顆改名時這裡不會有人發現。
import { buildLiteralString } from '../literal_string/build'
import { buildStringInsert } from '../string_insert/build'

/**
 * 前綴帶不帶 `f`。
 *
 * ⚠️ **不是只看第一個字元**：`rf"…"`／`fr"…"`／`F"…"`／`Rb"…"` 都合法，
 * 而只比 `startsWith('f')` 會把 `rf"{x}"` 判成普通字串——
 * 症狀是那一段插值被當成字面文字印出來（**看起來像使用者打錯字**）。
 */
const isFormatted = (prefix: string): boolean => /^[a-zA-Z]*$/.test(prefix.replace(/['"].*$/s, ''))
  && /f/i.test(prefix.replace(/['"].*$/s, ''))

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftStringMake', (node, ctx) => {
    const start = node.namedChildren.find((c) => c.type === 'string_start')
    if (!start || !isFormatted(start.text)) return null // 普通字串 → 讓下一筆樣式接手

    const parts: SemanticNode[] = []
    for (const child of node.namedChildren) {
      if (child.type === 'string_content') {
        parts.push(buildLiteralString(child.text))
        continue
      }
      if (child.type !== 'interpolation') continue // string_start／string_end 是引號，不是內容

      const expr = child.childForFieldName('expression')
      const fmt = child.childForFieldName('format_specifier')
      // ⚠️ `format_specifier` 的原文含前導冒號（`:.1f`），而冒號是**語法**不是格式。
      const format = fmt ? fmt.text.replace(/^:/, '') : ''
      const lifted = expr ? ctx.lift(expr) : null
      parts.push(buildStringInsert(format, lifted))
    }
    return createNode('python:string_make', {}, { parts })
  })
}
