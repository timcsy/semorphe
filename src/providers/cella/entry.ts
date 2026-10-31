/**
 * **補上進入點**（spec 182）——學生的樹在骨架隱藏時只有本體（L0 的 body-only），
 * `int main() {` 是產生器包上去的文字。Cella 判的是一支完整的程式，所以交出去之前照**同一條規則**包好：
 *
 * ```
 * 函式定義、`#` 開頭的 raw、include   留在頂層     （`components/cpp/program/generate.ts` 的 mustStayTopLevel）
 * 其餘                                進 hostsBody 那一顆進入點（Arduino 是 loop）
 * 進入點的回傳型別                     讀骨架宣告的 `open` 那一行（`int main() {`）
 * ```
 *
 * 合成的函式 id 是 `<program>/<名字>`——判決指到它時，`ownerOf` 歸到 program 那一顆（學生看得到的最近的一塊）。
 */
import type { SemanticNode } from '../../core/types'
import { skeletonById, skeletonPresent } from '../../core/skeleton'
import { isFunctionDefinition } from '../../core/component/traits'
import { registeredComponents } from '../../core/component/registry'
import { isIncludeDirective } from '../../languages/cpp/lang/node-traits'

const topLevel = (n: SemanticNode): boolean => {
  if (isFunctionDefinition(n.componentId) || isIncludeDirective(n.componentId)) return true
  const raw = (n.metadata as { rawCode?: string } | undefined)?.rawCode
  return typeof raw === 'string' && raw.trimStart().startsWith('#')
}

export function withEntryFunctions(tree: SemanticNode, skeletonId: string): SemanticNode {
  const skeleton = skeletonById(skeletonId)
  const body = tree.slots?.body ?? []
  const fns = skeleton?.entryFunctions ?? []
  if (fns.length === 0) return tree
  if (skeletonPresent(skeleton, (name) => body.some((n) => isFunctionDefinition(n.componentId) && n.properties?.name === name))) return tree
  // 「函式定義」是哪一顆，問宣告（`traits.functionDefinition`）——同一個語言範圍裡的那顆，不寫死身分
  const scope = tree.componentId.split(':')[0]
  const funcDef = registeredComponents().find((c) => c.componentId.startsWith(`${scope}:`) && isFunctionDefinition(c.componentId))?.componentId
  if (!funcDef) return tree
  const host = fns.find((f) => f.hostsBody) ?? fns[0]
  const entries: SemanticNode[] = fns.map((f) => {
    const ret = /^\s*([A-Za-z_][\w\s*&:<>]*?)\s+[A-Za-z_]\w*\s*\(/.exec(f.open[0]?.code ?? '')?.[1] ?? 'void'
    return {
      id: `${tree.id}/${f.name}`,
      componentId: funcDef,
      properties: { name: f.name, return_type: ret },
      slots: { params: [], body: f === host ? body.filter((n) => !topLevel(n)) : [] },
    } as SemanticNode
  })
  return { ...tree, slots: { ...tree.slots, body: [...body.filter(topLevel), ...entries] } }
}
