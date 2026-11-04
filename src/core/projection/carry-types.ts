/**
 * **把一棵樹的運算式型別，對到形狀相同的另一棵樹**（spec 215）。
 *
 * 判決提供者給的型別以節點 id 為鍵（Cella 的 `types().nodes`），而從積木抽回來的樹每次都是新的 id。
 * 形狀相同（拿掉 id 與 metadata 之後逐欄相同）時照走訪順序一一對應；**形狀不同回 `null`**——
 * 不靠積木 id 硬對：學生把 `int x` 改成 `double x` 時，引用 `x` 的那顆積木沒變，而它的型別已經過期，
 * 硬對會產出錯的格式（`%d` 印 double）。回 `null` 時產生器保守（保留 cout），等新的型別來了再重產。
 */
import type { SemanticNode } from '../types'

function shape(n: SemanticNode): unknown {
  return [n.componentId, n.properties ?? {}, Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)])]
}

function order(n: SemanticNode, acc: SemanticNode[] = []): SemanticNode[] {
  acc.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids) order(k, acc)
  return acc
}

export function carryTypes(from: SemanticNode, types: Readonly<Record<string, string>>, to: SemanticNode): Record<string, string> | null {
  if (from === to) return { ...types }
  if (JSON.stringify(shape(from)) !== JSON.stringify(shape(to))) return null
  const a = order(from), b = order(to)
  const out: Record<string, string> = {}
  a.forEach((n, i) => { const t = types[n.id]; if (t !== undefined) out[b[i].id] = t })
  return out
}
