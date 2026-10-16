/**
 * 字串字面的**本體**——屬性 `value` 存的那個樣子，以及它怎麼放回引號裡。
 *
 * ## 🔴 一個寫法，不是原文
 *
 * `value` 是「**放進一對雙引號就是合法 Python** 的那段文字」，跳脫序列照原樣留著
 * （還原是 execute 的事，與 C++ 那顆同一個體例）。
 *
 * ```
 * 原文              value          為什麼
 * 'say "hi"'        say \"hi\"     換成雙引號，裡面的 " 要跳脫
 * r"a\nb"           a\\nb          raw 的反斜線是字面的
 * """a"b<換行>c"""   a\"b\nc        三引號拆掉、換行寫成跳脫
 * f"{{x}}"（片段）   {x}            大括號是字面的；產回 f-string 時再加倍
 * ```
 *
 * ⚠️ 修之前 `value` 是「去掉頭尾引號的原文」：`r` 前綴、三引號的另外兩個 `"`
 * 都留在值裡被印出來，`'say "hi"'` 產回去是 `"say "hi""`（語法錯）。
 */
import type { AstNode as Node } from '../../../core/lift/types'

/** 字串的前綴與引號——`string_start` 的文字，例如 `rf"`、`'''`。 */
export interface StringStart {
  raw: boolean
  bytes: boolean
  formatted: boolean
}

export function parseStart(text: string): StringStart {
  const prefix = text.replace(/['"]+$/, '').toLowerCase()
  return { raw: prefix.includes('r'), bytes: prefix.includes('b'), formatted: prefix.includes('f') }
}

/**
 * 一段 `string_content` → `value` 的寫法。
 *
 * - 非 raw：跳脫序列照留；只補「沒跳脫的 `"`」與真正的換行字元（三引號裡才有）。
 * - raw：每個反斜線都是字面的，所以加倍。
 * - f-string：`{{`／`}}` 是字面的大括號，存成一個。
 */
export function bodyOf(content: Node, start: StringStart): string {
  const text = content.text
  const base = content.startIndex
  const escapes = new Map<number, string>()
  for (const c of content.namedChildren) {
    if (c.type === 'escape_sequence' || c.type === 'escape_interpolation') escapes.set(c.startIndex - base, c.text)
  }
  let out = ''
  for (let i = 0; i < text.length;) {
    const esc = escapes.get(i)
    if (esc !== undefined) {
      out += esc === '{{' ? '{' : esc === '}}' ? '}' : esc
      i += esc.length
      continue
    }
    const ch = text[i]
    if (ch === '\\') {
      if (start.raw) {
        out += '\\\\'
      } else {
        // 認不得的跳脫（`\d`）：Python 照字面留，unescapeC 也照字面留——兩個字一起搬
        out += text.slice(i, i + 2)
        i += 2
        continue
      }
    } else if (ch === '"') out += '\\"'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (start.formatted && (ch === '{' || ch === '}') && text[i + 1] === ch) {
      // raw f-string 沒有 escape_interpolation 子節點，大括號照字面成對出現
      out += ch
      i += 2
      continue
    } else out += ch
    i++
  }
  return out
}

/**
 * `value` 放回雙引號裡。
 *
 * 🔴 **沒跳脫的 `"` 補一個反斜線**——積木上打的字不經過 `bodyOf`，
 * 而一個裸的 `"` 會讓產出的程式碼在那裡就結束。
 * 前面有奇數個反斜線的 `"` 已經跳脫過了，不再動。
 */
export function quoteBody(value: string): string {
  return value.replace(/(\\*)"/g, (m, bs: string) => (bs.length % 2 === 0 ? `${bs}\\"` : m))
}
