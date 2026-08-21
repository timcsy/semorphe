/**
 * `python:try_catch` 的 **lift** 路。
 *
 * ⚠️ **為什麼不是純資料**：`except_clause` 是 `try_statement` 的**兄弟子節點**
 * （不是欄位），而它自己底下才是那個 `block`。樣式的 `fieldMappings` 走不到那一層。
 *
 * 🔴 **多個分支收得了**（2026-08-21）。第一版只收一個，理由是
 * 「收一半會產出少了分支的合法程式」——那是對的，而教學語料的第一段就有兩個。
 *
 * ⚠️ **`else`／`finally` 仍然整顆降級**——同一個理由，還沒有地方放。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import type { AstNode } from '../../../core/lift/types'
import type { LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
// 🔴 **呼叫兄弟膠囊的建構子**——身分只留在它自己的資料夾裡。
import { buildExceptionCase } from '../exception_case/build'

/** `block` 節點由核心的 `_compound` 樣式拆開——這裡把它攤平成一串語句。 */
function statementsOf(block: AstNode | null, ctx: LiftContext): SemanticNode[] {
  const lifted = block ? ctx.lift(block) : null
  if (!lifted) return []
  return lifted.componentId === '_compound' ? (lifted.children.body ?? []) : [lifted]
}

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftTry', (node, ctx) => {
    const excepts = node.namedChildren.filter((c) => c.type === 'except_clause')
    if (excepts.length === 0) return null // 只有 finally 的還沒收

    const handlers = excepts.map((clause) => {
      // `except ValueError:` 的名字在 `value` 欄位；`except:` 沒有那一格。
      // 🔴 而 `except ValueError as e:` 的 `value` 是**整串 `ValueError as e`**
      //    ——拆成兩格，因為執行時要拿 `e` 去宣告一個變數。
      const raw = clause.childForFieldName('value')?.text ?? ''
      const m = /^(.*?)\s+as\s+([A-Za-z_]\w*)$/.exec(raw)
      return buildExceptionCase(
        (m ? m[1] : raw).trim(),
        statementsOf(clause.namedChildren.find((c) => c.type === 'block') ?? null, ctx),
        m ? m[2] : '',
      )
    })

    // 🟢 `else`（沒出錯才跑）與 `finally`（出不出錯都跑）——各自是一段語句
    const clause = (t: string): SemanticNode[] => {
      const c = node.namedChildren.find((x) => x.type === t)
      return c ? statementsOf(c.namedChildren.find((x) => x.type === 'block') ?? null, ctx) : []
    }
    return createNode('python:try_catch', {}, {
      body: statementsOf(node.childForFieldName('body'), ctx),
      handlers,
      orelse: clause('else_clause'),
      ensure: clause('finally_clause'),
    })
  })
}
