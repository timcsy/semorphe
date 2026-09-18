/**
 * `cpp:var_declare_sequence` 的 **lift** 路——**一個建構子**
 *
 * `auto [a, b] = e;`。共用檔在 `liftDeclaration` 看到宣告子是
 * 一串名字（`structured_binding_declarator`）時呼叫它。
 *
 * 🔴 **在它之前那一串名字被塞進自動型別宣告的名字那一格**，於是執行期
 * 宣告了一個真的叫 `[pt,d]` 的變數——而下一行用到 `pt` 時說
 * 「沒有宣告過這個名字」。**錯誤指著使用的那一行，而問題在宣告那一行。**
 *
 * ⚠️ `param_decl` 是**核心的共用結構節點**（同族函式定義的參數也用它），
 *    不是某一顆膠囊的身分——所以這裡直接建，沒有跨膠囊的外洩。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildDeclareSequence(
  names: readonly string[], binding: 'value' | 'reference', initial: SemanticNode | null,
): SemanticNode {
  return createNode('cpp:var_declare_sequence', { binding }, {
    targets: names.map((n) => createNode('param_decl', { type: '', name: n })),
    value: initial ? [initial] : [],
  })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
