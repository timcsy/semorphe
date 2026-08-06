/**
 * C++ 的註解語法。
 *
 * 這一份**原本住在核心層**（`src/core/projection/code-generator.ts` 產生、
 * `src/core/lift/lifter.ts` 剝除）。搬過來的理由是 P9：拔掉 C++ 之後，核心
 * 不該還會寫 `//`——Python 要 `#`。
 *
 * 中立性護欄**看不見那筆耦合**，因為它找的是元件身分字串，而這裡寫死的是
 * 語法符號。見 `src/core/comment-syntax.ts` 的說明。
 *
 * 搬移是純位置改動，產出的每一個字元都與搬移前相同——由
 * `tests/integration/comment-projection-snapshot.test.ts` 逐一釘住。
 */
import type { CommentSyntax } from '../../../core/comment-syntax'

export const cppCommentSyntax: CommentSyntax = {
  line: (text, indent) => `${indent}// ${text}\n`,

  block: (text, indent) => {
    if (text.includes('\n')) {
      let result = `${indent}/*\n`
      for (const line of text.split('\n')) result += `${indent} * ${line.trim()}\n`
      result += `${indent} */\n`
      return result
    }
    return `${indent}/* ${text} */\n`
  },

  doc: (properties, ind) => {
    let result = `${ind}/**\n`
    if (properties.brief) {
      const briefText = String(properties.brief)
      const hasTags = properties.param_0_name !== undefined || properties.return_desc !== undefined
      if (briefText.includes('\n') && !hasTags) {
        for (const line of briefText.split('\n')) result += `${ind} * ${line}\n`
      } else if (briefText.includes('\n')) {
        const lines = briefText.split('\n')
        result += `${ind} * @brief ${lines[0]}\n`
        for (let j = 1; j < lines.length; j++) result += `${ind} * ${lines[j]}\n`
      } else {
        result += `${ind} * @brief ${briefText}\n`
      }
    }
    let i = 0
    while (properties[`param_${i}_name`] !== undefined) {
      const name = properties[`param_${i}_name`]
      const desc = properties[`param_${i}_desc`] ?? ''
      result += `${ind} * @param ${name}${desc ? ' ' + desc : ''}\n`
      i++
    }
    if (properties.return_desc) result += `${ind} * @return ${properties.return_desc}\n`
    result += `${ind} */\n`
    return result
  },

  trailing: (code, text) => `${code} // ${text}`,

  strip: (raw) => raw.replace(/^\/\/\s?/, '').replace(/^\/\*\s?|\s?\*\/$/g, ''),
}
