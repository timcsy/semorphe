/**
 * `cpp:var_ref` 的 **lift** 路——**建構子**
 *
 * 判別走 `lift-pattern.json`；共用檔另外有幾處要**直接建一顆變數參照**
 * （`scanf` 缺參數時的預設、抽取器把欄位文字包成節點…），走這個建構子。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { declareLvalue } from '../../../core/component/lvalue-nodes'

export function buildVarRef(name: string): SemanticNode {
  return createNode('cpp:var_ref', { name })
}

/** 判別走 pattern；這裡只提供建構子。 */
export function registerLift(): void {
  // **這種節點可以被寫回**——一個名字（`x`）——寫回作用域。
  // 宣告在這裡而不是寫進共用檔，否則這顆元件永遠搬不動。
  declareLvalue('cpp:var_ref', 'name')
}
