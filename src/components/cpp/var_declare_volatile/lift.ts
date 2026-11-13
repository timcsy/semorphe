/**
 * `cpp:var_declare_volatile` 的 **lift** 路——**一個建構子**（438）
 *
 * `volatile bool pressed = false;`——Arduino 的中斷旗標：中斷函式改它、`loop()` 讀它。
 * 434 之前 `volatile` 被**安靜地丟掉**（產回去是 `bool pressed`，另一支程式），434 讓整句誠實降級成原文；
 * 這一顆讓它有自己的積木。判別留在共用檔的宣告策略（照同族那顆靜態變數）。
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildVolatileVar(type: string, name: string, initial: SemanticNode | null): SemanticNode {
  // 三態：沒有初始值時**不設**欄位，不是設成空陣列（照同族）
  return initial
    ? createNode('cpp:var_declare_volatile', { name, type }, { initializer: [initial] })
    : createNode('cpp:var_declare_volatile', { name, type })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
