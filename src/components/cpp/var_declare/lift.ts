/**
 * `cpp:var_declare` 的 **lift** 路——**建構子**
 *
 * ⚠️ 這顆是**建立點最多的一顆**（共用檔九處、抽取器四處）。判別散在
 * `liftDeclaration` 的各個分支裡——那是 C++ 宣告語法的知識，留在共用檔；
 * **節點的形狀**在這裡，於是那十三處只剩下「呼叫」。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建var_declare(
  props: { name?: unknown; type?: unknown; init_style?: unknown },
  children?: Record<string, SemanticNode[]>,
): SemanticNode {
  const p: Record<string, string> = {}
  if (props.name !== undefined) p.name = String(props.name)
  if (props.type !== undefined) p.type = String(props.type)
  if (props.init_style !== undefined) p.init_style = String(props.init_style)
  return children ? createNode('cpp:var_declare', p, children) : createNode('cpp:var_declare', p)
}

/** 判別走 pattern 與共用檔；這裡提供建構子。 */
export function registerLift(): void {}
