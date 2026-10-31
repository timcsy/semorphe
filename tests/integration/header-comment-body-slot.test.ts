/**
 * 結構的標頭註解，在主體不叫 `body` 的結構上（`cpp:if` 是 `then_body`）。
 *
 * 🔴 2026-10-31，StudyCpp 218 支裡唯一的走樣（`tioj_godteach/pratice_question/8_toj120.cpp`）：
 *
 * ```
 * if (y > z)
 *     // 註解
 *     swap(y, z);
 * ```
 *
 * 修之前：第一次 lift 把註解掛成行末標註 → 產成 `if (y > z) { // 註解` →
 * 再 lift 一次它變成本體的第一句 ⟹ 來回一趟換了一棵樹。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { createTestLifter } from '../helpers/setup-lifter'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const SRC = 'int main() {\n  int y = 2, z = 1;\n  if (y > z)\n    // 排一下\n    swap(y, z);\n  cout << y;\n}\n'

function lifter(blocks: boolean) {
  const l = createTestLifter()
  l.setCommentsAsBlocks(() => blocks)
  return (c: string) => l.lift(parser.parse(c)!.rootNode as never) as SemanticNode
}
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as unknown as StylePreset)
const ifOf = (t: SemanticNode): SemanticNode => {
  const walk = (n: SemanticNode): SemanticNode | undefined =>
    n.componentId === 'cpp:if' ? n : Object.values(n.slots ?? {}).flat().map(walk).find(Boolean)
  return walk(t)!
}

describe('標頭註解跟著它後面的敘述進正確的槽', () => {
  it('★ 註解是積木：進 then_body 當第一句，來回一趟不變', () => {
    const lift = lifter(true)
    const t = lift(SRC)
    expect(ifOf(t).slots.then_body?.map((n) => n.componentId)).toEqual(['cpp:comment', 'cpp:var_swap'])
    const once = gen(t)
    expect(once).not.toContain('{ //')
    expect(gen(lift(once))).toBe(once)
  })

  it('★ 註解不是積木：掛在 if 上，來回一趟不變', () => {
    const lift = lifter(false)
    const once = gen(lift(SRC))
    expect(gen(lift(once))).toBe(once)
    expect(ifOf(lift(once)).slots.then_body?.map((n) => n.componentId)).toEqual(['cpp:var_swap'])
  })
})
