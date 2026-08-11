/**
 * `cpp:template_function` 的 **lift** 路——**一個建構子**
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建樣板函式(t: string, returnType: string, funcName: string, params: SemanticNode[], body: SemanticNode[]): SemanticNode {
  return createNode('cpp:template_function', { t, return_type: returnType, func_name: funcName }, { params, body })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
