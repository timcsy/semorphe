/**
 * Python 怎麼寫註解——**這個語言套件推，核心讀**。
 *
 * ⚠️ Python **沒有真的區塊註解**：多行註解的慣例是「每行一個 `#`」，
 * 而三引號字串是**字串**不是註解（它會被求值，只是通常沒有人接住它）。
 * 所以 `block` 也是逐行加 `#`——**那不是偷懶，那是這個語言的樣子**。
 */
import type { CommentSyntax } from '../../core/comment-syntax'

export const pythonCommentSyntax: CommentSyntax = {
  line: (text, indent) => `${indent}# ${text}\n`,
  block: (text, indent) =>
    text.split('\n').map((l) => `${indent}# ${l}`).join('\n') + '\n',
  doc: (properties, indent) => {
    // Python 的文件註解是函式體第一句的 docstring —— 而那由 `func_def` 產。
    // 這裡只在它被單獨產出時給一個誠實的形狀。
    const brief = String(properties.brief ?? '')
    return `${indent}"""${brief}"""\n`
  },
  trailing: (code, text) => `${code}  # ${text}`,
  // 剝掉開頭的 `#` 與緊接的一個空白。⚠️ 只剝一個空白——
  // `#   縮排的註解` 的其餘空白是使用者打的，不是語法。
  strip: (raw) => raw.replace(/^#[ ]?/, ''),
}
