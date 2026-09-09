/**
 * `cpp:comma_expr` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/**
 * 🔴 **巢狀的逗號要拉平**（2026-09-09）。
 *
 * tree-sitter 把 `a, b, c` 解析成 `comma_expr(a, comma_expr(b, c))`
 * ——那是**文法的結合律**，不是語義：逗號在語句與 `for` 的三格裡只表示順序，
 * 而順序沒有巢狀。
 *
 * ## ⚠️ 不拉平的症狀，只有使用者看得到
 *
 * 這顆積木是變長的（學生按 `+` 加第三格）。不拉平的話：
 *
 * ```
 * 學生按 +      → 一顆積木，三格
 * 產出          → a, b, c            ✅ 對的
 * 同步一趟回來  → 兩顆巢狀的積木     🔴 他的積木自己裂開了
 * ```
 *
 * 🟢 拉平之後那一趟是**不動點**：三格進、三格出。
 *
 * > **一個「結合律不影響語義」的地方，如果投影記得那個結合方式，
 * > 使用者就會看到他沒有做過的改動。**
 */
export function buildCommaExpr(exprs: SemanticNode[]): SemanticNode {
  const flat: SemanticNode[] = []
  for (const e of exprs) {
    if (e?.componentId === 'cpp:comma_expr') flat.push(...(e.children.exprs ?? []))
    else flat.push(e)
  }
  return createNode('cpp:comma_expr', {}, { exprs: flat })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
