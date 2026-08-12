/**
 * `cpp:var_declare_static` 的 **lift** 路——**一個建構子**
 *
 * `static int n;` **在函式裡**——跨呼叫保留的區域變數。
 * 與 `cpp:member_static`（在類別裡）的差別是**位置**，而那個判別是
 * C++ 語法的知識，留在共用檔。
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建靜態變數(型別: string, name: string, 初始值: SemanticNode | null): SemanticNode {
  // 三態：沒有初始值時**不設**欄位，不是設成空陣列（見 `var_declare_auto`）
  return 初始值
    ? createNode('cpp:var_declare_static', { name: name, type: 型別 }, { initializer: [初始值] })
    : createNode('cpp:var_declare_static', { name: name, type: 型別 })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
