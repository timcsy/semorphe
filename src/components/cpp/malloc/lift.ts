/**
 * `cpp:malloc` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * ⚠️ `type` 是**轉型型別**（指標），不是元素型別——產生器寫的是 `(${type})malloc(…)`。
 * `void*` ＝ **沒有轉型**（`int *a = malloc(n);`，C 的慣用寫法；malloc 本來就回傳 `void*`）——產生器不寫轉型。
 */
import type { SemanticNode } from '../../../core/types'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'

export function buildMalloc(type: string, size: SemanticNode | null, sizeofType = 'none'): SemanticNode {
  return createNode('cpp:malloc', { type, sizeof_type: sizeofType }, { size: size ? [size] : [] })
}

/** 積木上「乘以 sizeof 哪個型別」的下拉選得到的（`forms/blocks.json` 的 SIZEOF_TYPE） */
const SIZEOF_CHOICES = new Set(['int', 'float', 'double', 'char'])

/**
 * malloc 的引數拆成「個數 × sizeof(型別)」——**積木上那兩格的形狀**。
 *
 * 🔴 2026-11-07 瀏覽器驗收抓到：lift 只把整個引數放進 `size`、`sizeof_type` 空著，而積木的下拉一定有值（預設 int）
 *    ⟹ 走一趟積木 `malloc(3 * sizeof(int))` 變成 `malloc(3 * sizeof(int) * sizeof(int))`、`(char*)malloc(10)` 變成
 *    `malloc(10 * sizeof(int))`——**配置的大小靜靜地變了**。
 * 拆得開（`X * sizeof(T)`、T 在下拉裡）就拆；拆不開的 `sizeof_type` 是 `none`（直接寫位元組數）。
 */
export function liftMallocArg(
  arg: AstNode | undefined, lift: (n: AstNode) => SemanticNode | null,
): { size: SemanticNode | null; sizeofType: string } {
  if (!arg) return { size: null, sizeofType: 'none' }
  if (arg.type === 'binary_expression' && arg.childForFieldName('operator')?.text === '*') {
    const left = arg.childForFieldName('left')
    const right = arg.childForFieldName('right')
    const t = right?.type === 'sizeof_expression' ? right.childForFieldName('type')?.text?.trim() : undefined
    if (left && t && SIZEOF_CHOICES.has(t)) return { size: lift(left), sizeofType: t }
  }
  return { size: lift(arg), sizeofType: 'none' }
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
