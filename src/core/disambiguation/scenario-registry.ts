/**
 * **情境的登記處**（spec 218）——領域套件登記自己的情境種類與產生器；核心**不寫出任何一種種類的名字**（護欄在量）。
 * 產生器必須是決定性的（同一棵樹 → 同一批情境、順序固定）：比對結果要可重現（SC-001）。
 */
import type { SemanticNode } from '../types'
import type { Scenario } from './types'

/** 每個種類最多幾筆（第一版保守的上限；大量情境的批次由 cos-mos 決定環境） */
export const SCENARIO_LIMIT = 20

type Generator = (tree: SemanticNode) => Scenario[]
const kinds = new Map<string, Generator>()

export function registerScenarioKind(kind: string, generate: Generator): void {
  if (kinds.has(kind)) throw new Error(`情境種類「${kind}」登記了兩次`)
  kinds.set(kind, generate)
}

/** 所有登記的種類各產生一批、合併（登記順序；每種最多 SCENARIO_LIMIT 筆） */
export function scenariosFor(tree: SemanticNode): Scenario[] {
  const out: Scenario[] = []
  for (const [kind, generate] of kinds) {
    const got = generate(tree)
    const wrong = got.find((s) => s.kind !== kind)
    if (wrong) throw new Error(`情境種類「${kind}」的產生器回了別的種類「${wrong.kind}」`)
    out.push(...got.slice(0, SCENARIO_LIMIT))
  }
  return out
}

/** 只給測試用：清空登記處 */
export function resetScenarioKindsForTest(): void {
  kinds.clear()
}
