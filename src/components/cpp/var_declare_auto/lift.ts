/**
 * `cpp:var_declare_auto` 的 **lift** 路——**一個建構子**
 *
 * `auto x = expr;`。共用檔在 `liftDeclaration` 偵測到 `auto` 型別修飾詞時呼叫它。
 *
 * ⚠️ 有初始值與沒有初始值走**同一個建構子**——那是三態的第一態
 * （沒有初始值時不設 `initializer` 欄位，而不是設成空陣列）。
 *
 * > **「沒有」與「空的」要分得出來**，否則投影會畫出一個空的插槽，
 * > 而使用者看到的是「這裡少了東西」而不是「這裡不需要東西」。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildAutoDeclare(name: string, initial: SemanticNode | null): SemanticNode {
  return initial
    ? createNode('cpp:var_declare_auto', { name: name }, { initializer: [initial] })
    : createNode('cpp:var_declare_auto', { name: name })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
