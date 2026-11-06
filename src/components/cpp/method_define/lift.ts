/**
 * `cpp:method_define` 的 **lift** 路——**一個建構子**（第 322 刀）。
 * 判別（函式定義的名字是 `類別::名字`）留在共用檔 `cpp:liftFunctionDef`。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildMethodDefine(props: Record<string, PropertyValue>, slots?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:method_define', props, slots)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
