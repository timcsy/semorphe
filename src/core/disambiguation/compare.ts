/**
 * **比對器**（spec 218）——同一批情境下，學生的程式與每個解讀的參考解答各交判決，回報一致／不一致／不可比。
 *
 * 🔴 純模組：不 import DOM、`node:fs`、任何提供者——判決由呼叫端注入（瀏覽器包 Cella 的 worker；cos-mos 的 Node 批次與我們的測試各包自己的）。
 *    兩個宿主跑同一份（P9 宿主獨立）。護欄 `audit-disambiguation` 在量它的 import。
 * 🔴 判決不是成功執行（accept）的情境照實標「不可比」，不算一致也不算不一致（P6 誠實降級，FR-008）。
 */
import type { SemanticNode } from '../types'
import type { ComparisonResult, Incomparable, InterpretationResult, Judge, RunOutcome, Scenario } from './types'

const comparable = (o: RunOutcome): boolean => o.verdict === 'accept'
const why = (o: RunOutcome): string => o.problems.map((p) => (p.reason ? `${p.kind}：${p.reason}` : p.kind)).join('；') || o.verdict
const same = (a: RunOutcome, b: RunOutcome): boolean =>
  a.out === b.out && JSON.stringify(a.board ?? null) === JSON.stringify(b.board ?? null)

export async function compareInterpretations(
  student: SemanticNode,
  references: readonly { id: string; label: string; tree: SemanticNode }[],
  scenarios: readonly Scenario[],
  judge: Judge,
): Promise<ComparisonResult> {
  // 每支程式每個情境只判一次（同一份解答被兩個解讀共用時也一樣）
  const cache = new Map<SemanticNode, RunOutcome[]>()
  const runAll = async (tree: SemanticNode): Promise<RunOutcome[]> => {
    const hit = cache.get(tree)
    if (hit) return hit
    const outs: RunOutcome[] = []
    for (const s of scenarios) outs.push(await judge(tree, s))
    cache.set(tree, outs)
    return outs
  }
  const studentOuts = await runAll(student)
  const refOuts: RunOutcome[][] = []
  const results: InterpretationResult[] = []
  for (const ref of references) {
    const outs = await runAll(ref.tree)
    refOuts.push(outs)
    const incomparable: Incomparable[] = []
    let firstMismatch: InterpretationResult['firstMismatch']
    let compared = 0
    scenarios.forEach((scenario, i) => {
      const st = studentOuts[i], rf = outs[i]
      if (!comparable(st)) { incomparable.push({ scenario, side: 'student', verdict: st.verdict, reason: why(st) }); return }
      if (!comparable(rf)) { incomparable.push({ scenario, side: 'reference', verdict: rf.verdict, reason: why(rf) }); return }
      compared++
      if (!firstMismatch && !same(st, rf)) firstMismatch = { scenario, student: st, reference: rf }
    })
    const status = firstMismatch ? 'inconsistent' : compared === 0 ? 'incomparable' : 'consistent'
    results.push({ id: ref.id, label: ref.label, status, ...(firstMismatch ? { firstMismatch } : {}), incomparable })
  }
  // 分不出的解讀群：每個情境兩邊都可比、而且輸出完全相同
  const indistinguishable: string[][] = []
  const used = new Set<number>()
  references.forEach((_, i) => {
    if (used.has(i)) return
    const group = [i]
    for (let j = i + 1; j < references.length; j++) {
      if (used.has(j)) continue
      const alike = scenarios.every((_, k) => comparable(refOuts[i][k]) && comparable(refOuts[j][k]) && same(refOuts[i][k], refOuts[j][k]))
      if (alike) group.push(j)
    }
    if (group.length > 1) { group.forEach((g) => used.add(g)); indistinguishable.push(group.map((g) => references[g].id)) }
  })
  return { results, indistinguishable, scenarios: [...scenarios] }
}
