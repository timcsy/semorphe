/**
 * `cpp:logic` 的自證測（471）：C++ 的替代拼法 `and`／`or`（以及同一張表的 `not`、`not_eq`）是**同一個記號**——
 * 語義樹只記主拼法。之前 `or` 認不得、落到算術的兜底（身分錯：積木是算術那一顆、下拉沒有 `or` 這個值）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)
function nodes(n: SemanticNode | null, out: SemanticNode[] = []): SemanticNode[] {
  if (!n) return out
  out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) nodes(k, out)
  return out
}
const ops = (n: SemanticNode | null, id: string): string[] => nodes(n).filter((x) => x.componentId === id).map((x) => String(x.properties.operator ?? ''))

describe('cpp:logic — 替代拼法（471）', () => {
  it('`or`／`and` lift 成 logic、運算子記主拼法；`not` 是 logic_not、`not_eq` 是 compare 的 !=', () => {
    const tree = lift('int main() { int x = 5, y = 0; if (x > 100 or x < 0 and not y) x = 1; if (x not_eq y) x = 2; }')
    expect(ops(tree, 'cpp:logic').sort()).toEqual(['&&', '||'])
    expect(nodes(tree).some((x) => x.componentId === 'cpp:logic_not')).toBe(true)
    expect(ops(tree, 'cpp:compare')).toContain('!=')
    // 負向：算術那一顆沒有認領到任何一個替代拼法
    expect(ops(tree, 'cpp:arithmetic').filter((o) => /^[a-z_]+$/.test(o))).toEqual([])
  })
  it('轉一圈回來是主拼法，再 lift 是同一棵樹', () => {
    const out = generateCode(lift('int main() { int x = 5; if (x > 100 or x < 0) x = 1; }')!, 'cpp', style)
    expect(out).toContain('x > 100 || x < 0')
    expect(generateCode(lift(out)!, 'cpp', style)).toBe(out)
  })
  it('執行：`or`／`and`／`not` 的意思與主拼法相同（Cella）', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nint main() { int x = 150; bool f = false; cout << (x > 100 or x < 0) << (x > 1 and not f) << (x not_eq 150); }', '110')
  })
})
