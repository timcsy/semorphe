/**
 * arrays 的語言專屬執行路——4 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { defaultValue } from '../../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

export function registerArraysCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:array_2d_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    const rows = Number(node.properties.rows || 0)
    const cols = Number(node.properties.cols || 0)

    const elements: import('../../../../interpreter/types').RuntimeValue[] = []
    for (let i = 0; i < rows; i++) {
      const row: import('../../../../interpreter/types').RuntimeValue[] = []
      for (let j = 0; j < cols; j++) {
        row.push(defaultValue(type))
      }
      elements.push({ type: 'array', value: row })
    }
    ctx.scope.declare(name, { type: 'array', value: elements })
  })

  register('cpp:array_2d_access', async (node, ctx) => {
    const name = String(node.properties.name)
    const rowNodes = node.children.row
    const colNodes = node.children.col
    if (!rowNodes?.length || !colNodes?.length) return defaultValue('int')

    const row = ctx.toNumber(await ctx.evaluate(rowNodes[0]))
    const col = ctx.toNumber(await ctx.evaluate(colNodes[0]))
    const arr = ctx.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    const rowArr = arr.value[row]
    if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
    }
    return rowArr.value[col] ?? defaultValue('int')
  })

  register('cpp:array_2d_assign', async (node, ctx) => {
    const name = String(node.properties.name)
    const rowNodes = node.children.row
    const colNodes = node.children.col
    const valueNodes = node.children.value
    if (!rowNodes?.length || !colNodes?.length || !valueNodes?.length) return

    const row = ctx.toNumber(await ctx.evaluate(rowNodes[0]))
    const col = ctx.toNumber(await ctx.evaluate(colNodes[0]))
    const val = await ctx.evaluate(valueNodes[0])
    const arr = ctx.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    const rowArr = arr.value[row]
    if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
    }
    rowArr.value[col] = val
  })

  // enum is a type declaration — no runtime effect

  /**
   * `enum Color { RED = 1, GREEN = 5, BLUE = 9 };`
   *
   * ⚠️ 原本是**空操作**，而且被宣告成 `declarative`（刻意不執行）。
   * **那個宣告是錯的**——列舉要把它的常數放進作用域，不放的話 `GREEN`
   * 是一個未宣告變數，程式直接中斷。
   *
   * 「刻意不執行」與「還沒實作」的分界在 history/018：前者要說得出理由，
   * 而這裡的理由（declarative）**經不起一支會用到那些常數的程式**。
   *
   * 值以字串存著（`"RED = 1, GREEN = 5, BLUE = 9"`）——那是既有的技術債
   * （同 func_def 的參數），不在這一刀的範圍。沒寫值的成員依 C++ 規則
   * 從前一個 +1 開始。
   */
  register('cpp:enum', async (node, ctx) => {
    const raw = String(node.properties.values ?? '')
    let next = 0
    for (const part of raw.split(',')) {
      const s = part.trim()
      if (!s) continue
      const eq = s.indexOf('=')
      const name = (eq >= 0 ? s.slice(0, eq) : s).trim()
      if (!name) continue
      if (eq >= 0) {
        const v = Number(s.slice(eq + 1).trim())
        if (!Number.isNaN(v)) next = v
      }
      ctx.scope.declare(name, { type: 'int', value: next })
      next += 1
    }
  })
}
