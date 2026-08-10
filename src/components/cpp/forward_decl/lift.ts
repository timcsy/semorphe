/**
 * `cpp:forward_decl` 的 **lift** 路——**一個建構子**
 *
 * `int f(int a, int b);`（只有宣告沒有本體）。共用檔在 `liftDeclaration` 裡
 * 偵測到 `function_declarator` 時呼叫它。
 *
 * ⚠️ **參數列的解析留在共用檔**（`parseParamDeclaration`）——那是 C++ 語法的
 * 知識，不是這顆元件的。這顆元件知道的是「這種形狀叫 forward_decl，
 * 而它的參數放在 `params` 子節點」。
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建前置宣告(回傳型別: string, 名稱: string, 參數: SemanticNode[]): SemanticNode {
  return createNode('cpp:forward_decl', { return_type: 回傳型別, name: 名稱 }, { params: 參數 })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
