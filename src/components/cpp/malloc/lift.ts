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
import { createNode } from '../../../core/semantic-tree'

export function buildMalloc(type: string, size: SemanticNode | null): SemanticNode {
  return createNode('cpp:malloc', { type }, { size: size ? [size] : [] })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
