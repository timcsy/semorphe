/**
 * `cpp:sizeof` 的自證測（355）：對象是運算式時住在接點 `expr`，不壓成一串文字。
 * 來源：C 盲測第二輪的覆蓋缺口表（`sizeof a.bytes`，tests/reports/fuzz-cpp-union-20261108.md）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import cStyle from '../../../languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, acc: SemanticNode[] = []): SemanticNode[] => { acc.push(n); Object.values(n.slots ?? {}).flat().forEach((c) => all(c, acc)); return acc }
const sizeofs = (src: string): SemanticNode[] => all(lift(src)).filter((n) => n.componentId === 'cpp:sizeof')
const gen = (src: string): string => generateCode(lift(src), 'cpp', cStyle as StylePreset)

const PROG = '#include <stdio.h>\nstruct P {\n    char bytes[12];\n    int n;\n};\nint main(void) {\n    struct P a;\n    int v[5];\n    int* p = v;\n    printf("%d %d %d %d %d %d\\n", (int)sizeof(a.bytes), (int)sizeof(v[0]), (int)sizeof(v), (int)sizeof(int), (int)sizeof(*p), (int)sizeof(a.n + 1));\n    return 0;\n}\n'

describe('cpp:sizeof', () => {
  it('lift：運算式住在接點、型別與單一名字住在文字', () => {
    const got = sizeofs(PROG).map((n) => n.slots?.expr?.length ? `expr:${n.slots.expr[0].componentId}` : `target:${n.properties.target}`)
    expect(got).toEqual(['expr:cpp:struct_at_member', 'expr:cpp:array_at', 'target:v', 'target:int', 'expr:cpp:pointer_deref', 'expr:cpp:arithmetic'])
    for (const n of sizeofs(PROG).filter((x) => x.slots?.expr?.length)) {
      expect(n.properties).toEqual({ operand_kind: 'expression' })   // 不留一份文字（雙重真相）
    }
  })
  it('產碼來回一字不差；沒括號的寫法正規化成 sizeof(…)', () => {
    expect(gen(PROG).trimEnd()).toBe(PROG.trimEnd())
    expect(gen('int main(void) {\n    int v[3];\n    int k = sizeof v[0];\n}\n')).toContain('int k = sizeof(v[0]);')
  })
  it('★ Cella 判得出（以前三個運算式是 unknown）', async () => {
    await expectCellaOut(gen(PROG), '12 4 20 4 4 4\n', { lang: 'c' })
  }, 120_000)
})
