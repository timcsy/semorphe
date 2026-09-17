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
 * **這顆節點是一個裸的變數名嗎——如果是，那個名字是什麼。**
 *
 * ⚠️ 問的人是建構式的成員初始化列（`: x(x)`）：它要分辨「左值是一個單純的
 * 名字」與「左值是別的東西」（基底類別的建構 `: Base(x)`、陣列成員），
 * 因為**只有前者查的是自己的欄位**。
 *
 * 🔴 **判別住在這裡，不住在問的人那邊**：`'cpp:var_ref'` 這個字串出現在
 * 膠囊資料夾外，就近性護欄兩個方向都會報——而那條規則是對的，
 * 一個身分散在幾個檔裡，改名字的那天會漏掉其中一個。
 */
export function varRefName(node: SemanticNode | undefined): string | null {
  if (!node || node.componentId !== 'cpp:var_ref') return null
  const n = node.properties?.name
  return typeof n === 'string' && n !== '' ? n : null
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
