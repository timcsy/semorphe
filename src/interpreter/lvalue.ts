/**
 * **寫回一個位置** —— 與身分無關的演算法
 *
 * `swap(a[j], a[j+1])` 要對調兩格的值，而 `ctx.evaluate` 給的是**值**。
 * 這裡把「這個節點指的是哪一格」解出來，讀寫各一次。
 *
 * ⚠️ **問角色不問身分**：怎麼解由元件自己宣告（`declareLvalue`），
 * 這個檔一個 C++ 的名字都沒有。
 *
 * 🔴 **2026-08-25：分派從三個 kind 換成一個函式**——見 `lvalue-nodes.ts` 的檔頭。
 * 加一種新的左值形狀（`*q`、`a.b.c`、`d["k"]`）**不改這個檔**，
 * 那是路線圖「左值是接點，不是字串」的驗收②。
 */
import type { SemanticNode } from '../core/types'
import type { RuntimeValue } from './types'
import type { ExecutionContext } from './executor-registry'
import { lvalueResolverOf } from '../core/component/lvalue-nodes'
import { RuntimeError, RUNTIME_ERRORS } from './errors'

/** 一個解出來的位置：讀得到也寫得回 */
export interface Place {
  read(): RuntimeValue
  write(v: RuntimeValue): void
}

/**
 * 把一個節點解成一個位置。**解不出來就丟錯**——回一個假的位置的話，
 * 寫回會靜靜地丟掉，而程式看起來跑完了。
 */
export async function resolvePlace(node: SemanticNode, ctx: ExecutionContext): Promise<Place> {
  const resolve = lvalueResolverOf(node.componentId)
  if (!resolve) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
      '%1': '這個東西不能被指定值（它不是一個位置）',
    })
  }
  return (await resolve(node, ctx as never)) as Place
}
