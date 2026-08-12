/**
 * `cpp:func_def` 的 **lift** 路——**建構子**
 *
 * 判別（`function_definition` 的各種形狀）是 C++ 語法的知識，留在共用檔。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildFuncDef(
  name: string,
  returnType: string,
  children: Record<string, SemanticNode[]>,
): SemanticNode {
  return createNode('cpp:func_def', { name, return_type: returnType }, children)
}

/** 判別走共用檔；這裡提供建構子。 */
export function registerLift(): void {}
