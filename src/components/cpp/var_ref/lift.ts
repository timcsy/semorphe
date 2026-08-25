/**
 * `cpp:var_ref` 的 **lift** 路——**建構子**
 *
 * 判別走 `lift-pattern.json`；共用檔另外有幾處要**直接建一顆變數參照**
 * （`scanf` 缺參數時的預設、抽取器把欄位文字包成節點…），走這個建構子。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildVarRef(name: string): SemanticNode {
  return createNode('cpp:var_ref', { name })
}

/**
 * 判別走 pattern；這裡只提供建構子。
 *
 * 🪦 **「我可以被寫回」的宣告已於 2026-08-25 搬到 `execute.ts`**——
 * 它從一個 `kind` 字串變成一個**解析函式**，而函式要用到執行環境。
 */
export function registerLift(): void {
  // 這顆沒有其他 lift 期的登記——建構子由共用檔直接 import。
}
