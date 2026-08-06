/**
 * `istringstream` 的執行——從一個字串讀資料。
 *
 * ## 表示法
 *
 * 串流的狀態是「**還沒讀的 token**」。宣告時把來源字串切開存進去，
 * 每次讀取取走一個。用陣列表示，`>>` 那一路就不需要新的值型別。
 *
 * ⚠️ 同模組的 `cpp_stringstream_declare` 被宣告成 `declarative`
 * （刻意不執行）。**那個宣告對輸入串流不成立**——宣告一個串流卻什麼都不做，
 * 之後 `in >> x` 就沒東西可讀。與 091 的列舉是同一個病：
 * 「刻意不執行」的理由**經不起一支會用到它的程式**。
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_istringstream_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'in')
    const src = node.children.source ?? []
    const text = src.length > 0 ? String((await ctx.evaluate(src[0])).value) : ''
    // 以**空白**切開，與 C++ 的 `>>` 一致（連續空白算一個分隔）
    const tokens = text.split(/\s+/).filter((s) => s.length > 0)
    ctx.scope.declare(name, {
      type: 'array',
      value: tokens.map((s) => ({ type: 'string' as const, value: s })),
    })
  })
}
