/**
 * `cpp:array_declare` 的 **lift** 路——**一個建構子，不是一個分支**
 *
 * ## 為什麼是建構子
 *
 * `strategies.ts` 裡有**四處**建立這顆元件：一般陣列、指標陣列（兩種寫法）、
 * 帶初始值的陣列。它們的差別只有「型別要不要帶星號」與「要不要接初始值」
 * ——**節點的形狀四處完全相同**。
 *
 * 那不是「一個分支」，是**四個地方都認為自己在造它**。
 *
 * > **同一顆元件在同一個檔裡被建立四次，該收的不是分支，是建構子。**
 *
 * 收進膠囊之後共用檔呼叫 `建陣列宣告(…)`——**身分字串只留在這裡一處**，
 * 而就近性護欄要的正是這件事。
 */
import type { SemanticNode } from '../../../core/types'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'

/**
 * 從一個 `array_declarator` 造出這顆元件。
 *
 * @param type 元素型別。指標陣列傳 `int*` 這種**已經帶星號**的
 * @param arrayDeclarator tree-sitter 的 `array_declarator` 節點
 */
export function buildArrayDeclare(type: string, arrayDeclarator: AstNode, ctx: LiftContext): SemanticNode {
  const sizeNode = arrayDeclarator.namedChildren[1]
  // 大小 lift 成子節點而不是屬性——投影要把它畫成一個可以放運算式的插槽
  const size = sizeNode ? ctx.lift(sizeNode) : null
  return createNode('cpp:array_declare', {
    type: type,
    name: arrayDeclarator.namedChildren[0]?.text ?? 'arr',
  }, { size: size ? [size] : [] })
}

/** 這顆沒有要登錄的判別——它由共用檔的四個位置**呼叫**，不是被問。 */
export function registerLift(): void {}
